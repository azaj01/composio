import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeVersion } from './types';

/**
 * Get the repository root path.
 * Computed from the location of this module file.
 */
export function getRepoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // From _utils/src/ to repo root: src -> _utils -> e2e-tests -> ts -> composio
  return resolve(here, '../../../..');
}

/**
 * Resolve the Node.js versions to test against.
 *
 * Resolution order:
 * 1. COMPOSIO_E2E_NODE_VERSION env var (overrides everything)
 * 2. Provided nodeVersions from config
 * 3. Current Node.js runtime version
 */
export function resolveNodeVersions(
  configNodeVersions?: readonly NodeVersion[]
): readonly NodeVersion[] {
  const envVersion = process.env.COMPOSIO_E2E_NODE_VERSION;
  if (envVersion) {
    return [envVersion];
  }

  if (configNodeVersions && configNodeVersions.length > 0) {
    return configNodeVersions;
  }

  return [process.versions.node];
}
