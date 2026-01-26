/**
 * TypeScript .mjs import resolution e2e test
 *
 * Verifies that generated TypeScript files with .mjs imports
 * can be compiled successfully with moduleResolution: "nodenext".
 *
 * Requires COMPOSIO_API_KEY environment variable to be set.
 */

import { e2e } from '@e2e-tests/utils';

declare module "bun" {
  interface Env {
    COMPOSIO_API_KEY: string;
  }
}

await e2e(import.meta.url, {
  nodeVersions: ['20.19.0', '22.12.0'],
  fixture: 'test.mjs',
  env: {
    COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
  },
  onTest: (result) => {
    if (result.exitCode !== 0) {
      console.error('Test fixture failed');
      console.error('stderr:', result.stderr);
      throw new Error(`Test failed with exit code ${result.exitCode}`);
    }

    // Verify expected output from test.mjs
    const expectedOutputs = [
      'Test 1 passed: composio ts generate succeeded',
      'Test 2 passed: Generated files exist',
      'Test 3 passed: TypeScript compilation succeeded',
      'All tests passed!',
    ];

    for (const expected of expectedOutputs) {
      if (!result.stdout.includes(expected)) {
        throw new Error(`Expected output not found: "${expected}"`);
      }
    }

    console.log('Test fixture passed with expected output');
  },
});
