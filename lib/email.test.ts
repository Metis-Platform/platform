import { describe, expect, it } from 'vitest'
import { sendEmail } from './email'

describe('sendEmail integration safety', () => {
  it('sinks an integration email without initializing Resend', async () => {
    await expect(
      sendEmail(
        {
          from: 'noreply@example.com',
          to: 'investor@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        },
        { APP_ENV: 'integration', INTEGRATION_EMAIL_MODE: 'sink' }
      )
    ).resolves.toBe('sunk')
  })

  it('rejects an unlisted recipient before initializing Resend', async () => {
    await expect(
      sendEmail(
        {
          from: 'noreply@example.com',
          to: 'customer@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        },
        {
          APP_ENV: 'integration',
          INTEGRATION_EMAIL_MODE: 'allowlist',
          INTEGRATION_EMAIL_ALLOWLIST: 'test@example.com',
        }
      )
    ).rejects.toThrow('email is blocked by the environment side-effect policy')
  })
})
