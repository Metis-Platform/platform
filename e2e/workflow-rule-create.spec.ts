import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: workflow-rule creation requires an isolated reset-safe tenant fixture.')

test('owner creates a workflow rule with correlated audit evidence', async () => {})
