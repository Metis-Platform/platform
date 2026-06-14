import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

/**
 * Syncs the authenticated Clerk user and their active organization to our
 * database. Creates Tenant and User rows on first visit if they don't exist.
 *
 * Returns null if the user is not signed in or has no active organization.
 */
export async function syncUserToDatabase() {
  const { userId, orgId, orgRole } = await auth()

  if (!userId || !orgId) return null

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  // ── Tenant (org) ────────────────────────────────────────────────────────
  let tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })

  if (!tenant) {
    const client = await clerkClient()
    const clerkOrg = await client.organizations.getOrganization({
      organizationId: orgId,
    })

    tenant = await db.tenant.create({
      data: {
        clerkOrgId: orgId,
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? orgId,
        plan: 'STARTER',
      },
    })
  }

  // ── User ─────────────────────────────────────────────────────────────────
  // Scoped per tenant: a Clerk user in multiple orgs gets one row per tenant,
  // each with its own role — roles must never carry across tenants (issue #24).
  let user = await db.user.findUnique({
    where: { clerkUserId_tenantId: { clerkUserId: userId, tenantId: tenant.id } },
  })

  if (!user) {
    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? ''

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || null

    // Org admins (the org creator) become OWNER; invited members start at
    // READ_ONLY and are promoted by an owner from the team settings page.
    user = await db.user.create({
      data: {
        clerkUserId: userId,
        tenantId: tenant.id,
        email,
        name,
        role: orgRole === 'org:admin' ? 'OWNER' : 'READ_ONLY',
        lastActiveAt: new Date(),
      },
    })
  } else {
    // Debounce: only write if lastActiveAt is null or older than 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (user.lastActiveAt == null || user.lastActiveAt < fiveMinAgo) {
      await db.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
      user = { ...user, lastActiveAt: new Date() }
    }
  }

  return { tenant, user }
}
