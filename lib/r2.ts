import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let client: S3Client | null = null

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function getR2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return client
}

function bucketName(): string {
  return required('R2_BUCKET_NAME')
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) return undefined
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata
  return typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined
}

/** Presigned URL for a direct browser → R2 PUT (15 min expiry). */
export async function getUploadUrl(key: string, mimeType: string): Promise<string> {
  return getSignedUrl(
    getR2(),
    new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: mimeType }),
    { expiresIn: 900 },
  )
}

/** Presigned URL for a browser download/view (60 min expiry). */
export async function getDownloadUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    getR2(),
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: 3600 },
  )
}

/** Delete an object from R2. */
export async function deleteObject(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }))
}

/**
 * Create a server-owned immutable object. Existing keys are never overwritten.
 * A concurrent conditional-write conflict is retried; a pre-existing key is returned as-is.
 */
export async function putObjectIfAbsent(input: {
  key: string
  body: Uint8Array
  contentType: string
  metadata: Record<string, string>
}): Promise<'created' | 'exists'> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await getR2().send(new PutObjectCommand({
        Bucket: bucketName(),
        Key: input.key,
        Body: input.body,
        ContentLength: input.body.byteLength,
        ContentType: input.contentType,
        Metadata: input.metadata,
        IfNoneMatch: '*',
      }))
      return 'created'
    } catch (error) {
      const status = statusCode(error)
      if (status === 412) return 'exists'
      if (status !== 409 || attempt === 1) throw error
    }
  }
  throw new Error('R2 conditional write did not complete')
}

export async function headObject(key: string): Promise<{
  contentLength?: number
  contentType?: string
  metadata: Record<string, string>
}> {
  const result = await getR2().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }))
  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
    metadata: result.Metadata ?? {},
  }
}
