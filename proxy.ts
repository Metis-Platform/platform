import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { REQUEST_ID_HEADER } from '@/lib/request-correlation'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/cron/(.*)', // Cron routes use their own CRON_SECRET auth, not Clerk
  '/api/webhooks/(.*)', // Stripe webhooks use their own signature verification
  '/api/health', // Uptime monitor — no auth needed
  '/admin(.*)', // Super-admin routes use their own isSuperAdmin() guard
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const requestId = crypto.randomUUID()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
  const withRequestId = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
  const { userId, orgId } = await auth()

  // Public routes: always allow
  if (isPublicRoute(req)) return next()

  // Not signed in: redirect to sign-in
  if (!userId) {
    const { redirectToSignIn } = await auth()
    return withRequestId(await redirectToSignIn())
  }

  // Signed in but no active org: redirect to onboarding
  if (!orgId && !isOnboardingRoute(req)) {
    return withRequestId(NextResponse.redirect(new URL('/onboarding', req.url)))
  }

  return next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
