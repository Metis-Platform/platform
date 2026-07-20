import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: checklist generation requires an isolated reset-safe analyst fixture.')
test('analyst generates fixture checklist items with correlated audit evidence', async () => {})
