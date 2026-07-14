import { expect, test } from '@playwright/test'

test('platform health endpoint is reachable from the configured read-only target', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
})
