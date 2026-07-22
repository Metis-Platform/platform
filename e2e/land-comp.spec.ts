import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: Land Comp mutations require an isolated reset-safe analyst fixture.')
test('analyst creates and deletes a raw Land Comp with correlated audit evidence', async () => {})
