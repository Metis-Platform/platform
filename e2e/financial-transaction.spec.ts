import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: financial transaction mutations require an isolated reset-safe analyst fixture.')
test('analyst creates and deletes a fixture financial transaction with correlated audit evidence', async () => {})
