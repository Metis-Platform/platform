import { createClerkClient, type ClerkClient } from '@clerk/backend'
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import type {
  ClerkFixtureInspection,
  ClerkFixtureProvider,
  FixtureResourceState,
  R2FixtureProvider,
} from './integration-full-reset'
import type { IntegrationFixtureManifest } from '../prisma/fixtures/integration-v1'

type EnvironmentMap = Readonly<Record<string, string | undefined>>

function required(env: EnvironmentMap, variable: string): string {
  const value = env[variable]?.trim()
  if (!value) throw new Error(`${variable} is required.`)
  return value
}

function hasFixtureTag(
  metadata: unknown,
  manifest: IntegrationFixtureManifest
): boolean {
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    (metadata as Record<string, unknown>).metisFixture === manifest.externalMetadataTag
  )
}

function resourceState(
  resource: { privateMetadata: unknown } | null,
  manifest: IntegrationFixtureManifest
): FixtureResourceState {
  if (!resource) return 'missing'
  return hasFixtureTag(resource.privateMetadata, manifest) ? 'tagged' : 'untagged'
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status?: number }).status === 404
  )
}

export class ClerkSdkFixtureProvider implements ClerkFixtureProvider {
  constructor(private readonly client: ClerkClient) {}

  private async findOrganization(manifest: IntegrationFixtureManifest) {
    try {
      return await this.client.organizations.getOrganization({ slug: manifest.tenant.slug })
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  private async findUser(manifest: IntegrationFixtureManifest) {
    const response = await this.client.users.getUserList({
      externalId: [manifest.clerkExternalId],
      limit: 2,
    })
    if (response.data.length > 1) throw new Error('Clerk fixture external ID is not unique')
    return response.data[0] ?? null
  }

  async inspect(manifest: IntegrationFixtureManifest): Promise<ClerkFixtureInspection> {
    const [instance, organization, user] = await Promise.all([
      this.client.instance.get(),
      this.findOrganization(manifest),
      this.findUser(manifest),
    ])
    return {
      instanceId: instance.id,
      environmentType: instance.environmentType,
      organization: {
        state: resourceState(organization, manifest),
        id: organization?.id ?? null,
      },
      user: {
        state: resourceState(user, manifest),
        id: user?.id ?? null,
      },
    }
  }

  async recreate(input: {
    manifest: IntegrationFixtureManifest
    ownerEmail: string
    ownerPassword: string
  }) {
    const inspection = await this.inspect(input.manifest)
    if (
      inspection.organization.state === 'untagged' ||
      inspection.user.state === 'untagged'
    ) {
      throw new Error('Refusing to replace an untagged Clerk resource')
    }

    if (inspection.organization.id) {
      await this.client.organizations.deleteOrganization(inspection.organization.id)
    }
    if (inspection.user.id) {
      await this.client.users.deleteUser(inspection.user.id)
    }

    const privateMetadata = { metisFixture: input.manifest.externalMetadataTag }
    const user = await this.client.users.createUser({
      externalId: input.manifest.clerkExternalId,
      emailAddress: [input.ownerEmail],
      password: input.ownerPassword,
      firstName: 'Integration Test',
      lastName: 'Owner',
      privateMetadata,
      skipPasswordChecks: false,
      skipLegalChecks: true,
    })
    const organization = await this.client.organizations.createOrganization({
      name: input.manifest.tenant.name,
      slug: input.manifest.tenant.slug,
      createdBy: user.id,
      privateMetadata,
    })

    return {
      clerkOrgId: organization.id,
      clerkUserId: user.id,
      ownerEmail: input.ownerEmail,
    }
  }
}

export class S3FixtureProvider implements R2FixtureProvider {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined
    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }))
      for (const object of response.Contents ?? []) {
        if (object.Key) keys.push(object.Key)
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)
    return keys
  }

  async deleteKeys(prefix: string, keys: readonly string[]): Promise<void> {
    if (keys.some(key => !key.startsWith(prefix))) {
      throw new Error('Refusing to delete an R2 object outside the fixture prefix')
    }
    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000)
      if (batch.length === 0) continue
      const response = await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true },
      }))
      if ((response.Errors?.length ?? 0) > 0) {
        throw new Error('R2 reported one or more object deletion errors')
      }
    }
  }
}

export function createClerkFixtureProvider(env: EnvironmentMap): ClerkFixtureProvider {
  return new ClerkSdkFixtureProvider(createClerkClient({
    secretKey: required(env, 'CLERK_SECRET_KEY'),
  }))
}

export function createR2FixtureProvider(env: EnvironmentMap): R2FixtureProvider {
  const accountId = required(env, 'R2_ACCOUNT_ID')
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required(env, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: required(env, 'R2_SECRET_ACCESS_KEY'),
    },
  })
  return new S3FixtureProvider(client, required(env, 'R2_BUCKET_NAME'))
}
