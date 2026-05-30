import { currentUser } from '@clerk/nextjs/server'

/** Returns true if the signed-in user is in the SUPER_ADMIN_EMAILS env var. */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false

  const allowed = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const email = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress ?? ''

  return allowed.includes(email.toLowerCase())
}
