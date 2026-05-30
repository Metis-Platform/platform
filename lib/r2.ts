import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const accountId  = process.env.R2_ACCOUNT_ID!
const bucketName = process.env.R2_BUCKET_NAME!

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

/** Presigned URL for a direct browser → R2 PUT (15 min expiry). */
export async function getUploadUrl(key: string, mimeType: string): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: mimeType }),
    { expiresIn: 900 },
  )
}

/** Presigned URL for a browser download/view (60 min expiry). */
export async function getDownloadUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: 3600 },
  )
}

/** Delete an object from R2. */
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}
