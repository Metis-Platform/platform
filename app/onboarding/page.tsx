import { CreateOrganization } from '@clerk/nextjs'

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center py-16 px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Create your portfolio
        </h1>
        <p className="mt-2 text-zinc-600">
          Set up your organization to start managing deals.
        </p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
    </main>
  )
}
