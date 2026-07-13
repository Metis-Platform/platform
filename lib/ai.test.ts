import { describe, expect, it } from 'vitest'
import { getAnthropic } from './ai'
import { getPlatformAnthropic } from './jurisdiction-extraction'

describe('getAnthropic integration safety', () => {
  it('blocks before SDK creation in reset-safe integration mode', () => {
    expect(() =>
      getAnthropic('synthetic-key', {
        APP_ENV: 'integration',
        INTEGRATION_AI_MODE: 'disabled',
      })
    ).toThrow('ai is blocked by the environment side-effect policy')
  })

  it('allows explicit local development behavior', () => {
    expect(() => getAnthropic('synthetic-key', { APP_ENV: 'local' })).not.toThrow()
  })

  it('blocks the platform Anthropic client before SDK creation', () => {
    expect(() =>
      getPlatformAnthropic({
        APP_ENV: 'integration',
        INTEGRATION_AI_MODE: 'disabled',
        ANTHROPIC_API_KEY: 'synthetic-key',
      })
    ).toThrow('ai is blocked by the environment side-effect policy')
  })
})
