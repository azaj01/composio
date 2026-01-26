import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import type { NodeVersionMeta, NodeVersionFromUser } from './types';

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
export function resolveNodeVersionMetaList(
  configNodeVersions?: readonly NodeVersionFromUser[]
): readonly NodeVersionMeta[] {
  const envVersion = process.env.COMPOSIO_E2E_NODE_VERSION;
  if (envVersion) {
    return [{ kind: 'overridden', value: envVersion }];
  }

  const currentNodeVersion = process.versions.node;

  if (configNodeVersions === undefined) {
    return [{ kind: 'current', value: currentNodeVersion }];
  }

  const distinctNodeVersions = Array.from(
    new Set(
      configNodeVersions
        .map((v => v === 'current'
          ? { kind: 'current', value: currentNodeVersion } as const
          : { kind: 'static', value: v } as const)
        )
    )
  );

  return distinctNodeVersions;
}
