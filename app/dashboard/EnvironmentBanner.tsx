import { getEnvironmentIdentity, type EnvironmentIdentity } from '@/lib/environment'

export function EnvironmentBanner({
  identity = getEnvironmentIdentity(),
}: {
  identity?: EnvironmentIdentity
}) {
  if (identity.isProduction) return null

  return (
    <div
      data-environment={identity.appEnvironment}
      className="w-full bg-amber-400 px-6 py-2 text-center text-sm font-semibold text-amber-950"
    >
      {identity.label} · {identity.environmentId}
    </div>
  )
}
