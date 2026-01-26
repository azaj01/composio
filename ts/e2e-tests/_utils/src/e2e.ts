/**
 * Simplified e2e test API with auto-inferred cwd and suiteName.
 */

import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { E2EConfig } from './types';
import { getRepoRoot } from './config';
import { runE2E } from './runner';

/**
 * Validate that the provided import.meta.url is a valid file:// URL.
 */
function validateImportMetaUrl(url: string): void {
  if (!url) {
    throw new Error('e2e(): import.meta.url is required as first argument');
  }
  if (!url.startsWith('file://')) {
    throw new Error(
      `e2e(): import.meta.url must be a file:// URL, got: ${url}\n` +
        'Ensure you are calling e2e(import.meta.url, ...) from an ES module'
    );
  }
}

/**
 * Infer the working directory (cwd) from the caller's import.meta.url.
 * Returns a path relative to the repository root.
 */
function inferCwd(importMetaUrl: string, repoRoot: string): string {
  const callerPath = fileURLToPath(importMetaUrl);
  const callerDir = dirname(callerPath);
  const relativePath = relative(repoRoot, callerDir);
  // Normalize to forward slashes for Docker
  return relativePath.split(/[\\/]/).join('/');
}

/**
 * Run an e2e test with inline configuration.
 *
 * This is the main entry point for e2e tests. It automatically infers
 * the working directory and suite name from the caller's location.
 *
 * @param importMetaUrl - Pass `import.meta.url` from your test file
 * @param config - Test configuration
 *
 * @example
 * ```typescript
 * await e2e(import.meta.url, { fixture: 'fixtures/test.mjs' });
 * ```
 */
export async function e2e(importMetaUrl: string, config: E2EConfig): Promise<never> {
  validateImportMetaUrl(importMetaUrl);

  const repoRoot = getRepoRoot();
  const cwd = inferCwd(importMetaUrl, repoRoot);
  const suiteName = cwd.split('/').pop() ?? 'unknown';

  return runE2E({ ...config, cwd, suiteName });
}
