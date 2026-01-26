/**
 * OpenAI v6 + Zod v4 compatibility e2e test
 *
 * Verifies that @composio/core works correctly with openai@6 and zod@4,
 * specifically testing the fix for https://github.com/ComposioHQ/composio/issues/2336
 */

import { e2e } from '@e2e-tests/utils';

declare module "bun" {
  interface Env {
    COMPOSIO_API_KEY: string;
  }
}

await e2e(import.meta.url, {
  nodeVersions: ['20.19.0', '22.12.0'],
  setup: 'npm --prefix fixtures install --legacy-peer-deps',
  fixture: 'fixtures/index.mjs',
  env: {
    COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
  },
  onSetup: (result) => {
    if (result.exitCode !== 0) {
      console.error('npm install failed');
      console.error('stderr:', result.stderr);
      throw new Error(`Setup failed with exit code ${result.exitCode}`);
    }
    console.log('npm install completed successfully');
  },
  onTest: (result) => {
    if (result.exitCode !== 0) {
      console.error('Test fixture failed');
      console.error('stderr:', result.stderr);
      throw new Error(`Test failed with exit code ${result.exitCode}`);
    }

    // Verify expected output from fixtures/index.mjs
    const expectedOutputs = [
      'zod@4 works',
      'openai@5 works',
      '@composio/core works',
      'wrapTool works',
      'All packages work together!',
    ];

    for (const expected of expectedOutputs) {
      if (!result.stdout.includes(expected)) {
        throw new Error(`Expected output not found: "${expected}"`);
      }
    }

    console.log('Test fixture passed with expected output');
  },
});
