import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: task-comment mutation requires an isolated reset-safe analyst fixture.')

test('analyst adds a fixture-safe task comment with correlated audit evidence', async () => {})
