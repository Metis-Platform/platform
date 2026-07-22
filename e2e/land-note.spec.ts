import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: Land Note creation requires an isolated reset-safe analyst fixture.')

test('analyst creates a Land Note with a same-tenant buyer and correlated audit evidence', async () => {})
