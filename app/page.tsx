import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const { userId } = await auth()

  // Already signed in: go straight to the app
  if (userId) redirect('/dashboard')

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Metis Platform
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600">
        AI-powered real estate investment management. Track tax liens, manage
        deals, and never miss a deadline.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  )
}
