import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: task creation requires an isolated reset-safe analyst fixture.')
test('analyst creates a fixture task with correlated audit evidence', async () => {})
