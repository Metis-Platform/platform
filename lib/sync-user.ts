import { auth, currentUser, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

/**
 * Syncs the authenticated Clerk user and their active organization to our
 * database. Creates Tenant and User rows on first visit if they don't exist.
 *
 * Returns null if the user is not signed in or has no active organization.
 */
export async function syncUserToDatabase() {
  const { userId, orgId, orgSlug } = await auth()

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
  let user = await db.user.findUnique({ where: { clerkUserId: userId } })

  if (!user) {
    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? ''

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || null

    user = await db.user.create({
      data: {
        clerkUserId: userId,
        tenantId: tenant.id,
        email,
        name,
        role: 'OWNER',
      },
    })
  }

  return { tenant, user }
}
