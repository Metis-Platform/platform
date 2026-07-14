import { evaluateIntegrationResetPreflight } from './integration-reset-guard'

export function evaluateE2eMutationGuard(
  env: Readonly<Record<string, string | undefined>>,
  confirmation: string | undefined,
) {
  const baseUrl = env.E2E_BASE_URL?.trim()
  const errors = [...evaluateIntegrationResetPreflight(env, confirmation).errors]
  if (!baseUrl) errors.push('E2E_BASE_URL must identify the isolated integration application.')
  if (baseUrl?.includes('metisplatforms.com')) errors.push('E2E_BASE_URL must not target the production domain.')
  return { ok: errors.length === 0, errors }
}
