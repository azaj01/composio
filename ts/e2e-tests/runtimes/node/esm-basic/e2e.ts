/**
 * ESM compatibility e2e test
 *
 * Verifies that @composio/core can be imported using ESM import syntax in Node.js.
 */

import { e2e } from '@e2e-tests/utils';

await e2e(import.meta.url, {
  nodeVersions: [
    // may throw ERR_REQUIRE_ESM
    '20.18.0',
    // supports ESM by default
    '20.19.0',
    '22.12.0',
  ],
  fixture: 'fixtures/test.mjs',
  onTest: (result) => {
    if (result.exitCode !== 0) {
      console.error('Test fixture failed');
      console.error('stderr:', result.stderr);
      throw new Error(`Test failed with exit code ${result.exitCode}`);
    }

    // Verify expected output from test.mjs
    const expectedOutputs = [
      'Test 1 passed: import() succeeded',
      'Test 2 passed: Composio class is exported',
      'Test 3 passed: OpenAIProvider class is exported',
      'Test 4 passed: OpenAIProvider instantiated successfully',
      'Test 5 passed: AuthScheme is exported',
      'Test 6 passed: Error classes are exported',
      'Test 7 passed: jsonSchemaToZodSchema is exported',
      'Test 8 passed: constants namespace is exported',
      'Test 9 passed: logger is exported',
      'Test 10 passed: Static import syntax works',
      'All ESM compatibility tests passed!',
    ];

    for (const expected of expectedOutputs) {
      if (!result.stdout.includes(expected)) {
        throw new Error(`Expected output not found: "${expected}"`);
      }
    }

    console.log('Test fixture passed with expected output');
  },
});
