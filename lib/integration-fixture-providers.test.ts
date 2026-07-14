import { describe, expect, it, vi } from 'vitest'
import type { ClerkClient } from '@clerk/backend'
import type { S3Client } from '@aws-sdk/client-s3'
import { INTEGRATION_FIXTURE_MANIFEST } from '../prisma/fixtures/integration-v1'
import { ClerkSdkFixtureProvider, S3FixtureProvider } from './integration-fixture-providers'

function clerkClient(input?: { tagged?: boolean; missing?: boolean }) {
  const privateMetadata = input?.tagged === false
    ? { customer: true }
    : { metisFixture: INTEGRATION_FIXTURE_MANIFEST.externalMetadataTag }
  const organization = input?.missing ? null : {
    id: 'org-old',
    privateMetadata,
  }
  const user = input?.missing ? null : {
    id: 'user-old',
    privateMetadata,
  }
  const organizations = {
    getOrganization: vi.fn(async () => {
      if (!organization) throw Object.assign(new Error('not found'), { status: 404 })
      return organization
    }),
    deleteOrganization: vi.fn(async () => organization),
    createOrganization: vi.fn(async () => ({ id: 'org-new' })),
  }
  const users = {
    getUserList: vi.fn(async () => ({ data: user ? [user] : [] })),
    deleteUser: vi.fn(async () => user),
    createUser: vi.fn(async () => ({ id: 'user-new' })),
  }
  return {
    provider: new ClerkSdkFixtureProvider({
      instance: { get: vi.fn(async () => ({ id: 'ins_integration', environmentType: 'production' })) },
      organizations,
      users,
    } as unknown as ClerkClient),
    organizations,
    users,
  }
}

describe('Clerk fixture provider', () => {
  it('looks up deterministic identifiers and distinguishes tagged resources', async () => {
    const fake = clerkClient({ tagged: true })
    await expect(fake.provider.inspect(INTEGRATION_FIXTURE_MANIFEST)).resolves.toEqual({
      instanceId: 'ins_integration',
      environmentType: 'production',
      organization: { state: 'tagged', id: 'org-old' },
      user: { state: 'tagged', id: 'user-old' },
    })
    expect(fake.organizations.getOrganization).toHaveBeenCalledWith({
      slug: INTEGRATION_FIXTURE_MANIFEST.tenant.slug,
    })
    expect(fake.users.getUserList).toHaveBeenCalledWith({
      externalId: [INTEGRATION_FIXTURE_MANIFEST.clerkExternalId],
      limit: 2,
    })
  })

  it('never deletes an untagged deterministic-name collision', async () => {
    const fake = clerkClient({ tagged: false })
    await expect(fake.provider.recreate({
      manifest: INTEGRATION_FIXTURE_MANIFEST,
      ownerEmail: 'fixture@example.test',
      ownerPassword: 'a-long-fixture-password',
    })).rejects.toThrow('untagged Clerk resource')
    expect(fake.organizations.deleteOrganization).not.toHaveBeenCalled()
    expect(fake.users.deleteUser).not.toHaveBeenCalled()
  })

  it('replaces tagged anchors and tags both recreated resources', async () => {
    const fake = clerkClient({ tagged: true })
    await expect(fake.provider.recreate({
      manifest: INTEGRATION_FIXTURE_MANIFEST,
      ownerEmail: 'fixture@example.test',
      ownerPassword: 'a-long-fixture-password',
    })).resolves.toEqual({
      clerkOrgId: 'org-new',
      clerkUserId: 'user-new',
      ownerEmail: 'fixture@example.test',
    })
    expect(fake.users.createUser).toHaveBeenCalledWith(expect.objectContaining({
      externalId: INTEGRATION_FIXTURE_MANIFEST.clerkExternalId,
      privateMetadata: { metisFixture: INTEGRATION_FIXTURE_MANIFEST.externalMetadataTag },
    }))
    expect(fake.organizations.createOrganization).toHaveBeenCalledWith(expect.objectContaining({
      slug: INTEGRATION_FIXTURE_MANIFEST.tenant.slug,
      createdBy: 'user-new',
      privateMetadata: { metisFixture: INTEGRATION_FIXTURE_MANIFEST.externalMetadataTag },
    }))
  })
})

describe('R2 fixture provider', () => {
  it('paginates prefix discovery and batches deletion at the S3 limit', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'prefix/a' }],
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'prefix/b' }], IsTruncated: false })
    const provider = new S3FixtureProvider({ send } as unknown as S3Client, 'integration-bucket')
    await expect(provider.listKeys('prefix/')).resolves.toEqual(['prefix/a', 'prefix/b'])

    send.mockReset()
    send.mockResolvedValue({ Errors: [] })
    await provider.deleteKeys(
      'prefix/',
      Array.from({ length: 1001 }, (_, index) => `prefix/${index}`)
    )
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('refuses deletion outside the asserted prefix before S3 access', async () => {
    const send = vi.fn()
    const provider = new S3FixtureProvider({ send } as unknown as S3Client, 'integration-bucket')
    await expect(provider.deleteKeys('fixture/', ['customer/private.pdf'])).rejects.toThrow(
      'outside the fixture prefix'
    )
    expect(send).not.toHaveBeenCalled()
  })
})
