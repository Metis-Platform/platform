import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: workflow-rule updates and deletion require an isolated reset-safe tenant fixture.')

test('owner toggles and deletes a workflow rule with correlated audit evidence', async () => {})
