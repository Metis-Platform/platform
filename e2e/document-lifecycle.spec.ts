import { test } from '@playwright/test'

test.skip(true, 'Blocked by #289: document upload/delete requires an isolated reset-safe analyst fixture and controlled R2 prefix.')
test('analyst uploads and deletes a fixture document with correlated audit evidence', async () => {})
