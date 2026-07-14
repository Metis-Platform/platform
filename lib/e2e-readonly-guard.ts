export function evaluateE2eReadOnlyGuard(env: Readonly<Record<string, string | undefined>>) {
  const baseUrl = env.E2E_BASE_URL?.trim()
  const errors: string[] = []
  if (!baseUrl) errors.push('E2E_BASE_URL must identify a non-production application.')
  if (baseUrl?.includes('metisplatforms.com')) errors.push('E2E_BASE_URL must not target the production domain.')
  try {
    if (baseUrl) new URL(baseUrl)
  } catch {
    errors.push('E2E_BASE_URL must be an absolute URL.')
  }
  return { ok: errors.length === 0, errors }
}
