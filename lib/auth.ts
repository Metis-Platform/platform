import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import type { UserRole } from '@/app/generated/prisma'

const ROLE_RANK: Record<UserRole, number> = {
  OWNER: 5,
  ANALYST: 4,
  ATTORNEY: 3,
  ASSISTANT: 2,
  READ_ONLY: 1,
}

/** Returns the current tenant + user from the database, or null if not authenticated. */
export async function getCurrentUser() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return null

  const tenant = await db.tenant.findUnique({ where: { clerkOrgId: orgId } })
  if (!tenant) return null

  const user = await db.user.findUnique({ where: { clerkUserId: userId } })
  if (!user) return null

  return { tenant, user }
}

/** Returns true if the user's role is at least `minimum`. */
export function hasRole(userRole: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimum]
}
