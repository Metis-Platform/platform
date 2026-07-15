import { config } from 'dotenv'

type EnvironmentMap = Record<string, string | undefined>

/**
 * Loads ignored local operator configuration without replacing explicit shell
 * or CI values. This module is only imported by command-line operator scripts.
 */
export function loadLocalOperatorEnvironment(
  env: EnvironmentMap = process.env,
  path = '.env.local'
): void {
  config({ path, processEnv: env, quiet: true })
}
