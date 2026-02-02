import { describe, beforeAll, it } from 'bun:test';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { E2EConfig, E2ETestResult, NodeVersionMeta } from './types';
import { getRepoRoot, resolveNodeVersionMetaList } from './config';
import { ensureNodeImage, runNodeContainer } from './image-lifecycle';
import { WELL_KNOWN_ENV_VARS } from './const'

/**
 * Debug log entry metadata.
 */
interface DebugLogEntry {
  nodeVersion: string;
  command: string;
  containerName: string;
  result: E2ETestResult;
}

/**
 * Writes Docker run output to DEBUG.log in the test directory.
 * Appends to the file so multiple test runs are preserved.
 *
 * @param repoRoot - Absolute path to the repository root
 * @param testDirRelative - Path to test directory relative to repo root
 * @param entry - Debug log entry with command and result metadata
 */
async function writeDebugLog(
  repoRoot: string,
  testDirRelative: string,
  entry: DebugLogEntry
): Promise<void> {
  const logPath = resolve(repoRoot, testDirRelative, 'DEBUG.log');
  const timestamp = new Date().toISOString();

  const content = [
    '',
    `=== Docker Run: ${timestamp} ===`,
    `Node.js: ${entry.nodeVersion}`,
    `Command: ${entry.command}`,
    `Container: ${entry.containerName}`,
    `Exit Code: ${entry.result.exitCode}`,
    '',
    '--- stdout ---',
    entry.result.stdout || '(empty)',
    '',
    '--- stderr ---',
    entry.result.stderr || '(empty)',
    '',
    `=== End (Exit Code: ${entry.result.exitCode}) ===`,
    '',
  ].join('\n');

  await appendFile(logPath, content);
}

/**
 * Builds environment variables to pass to the container.
 * Merges auto-passthrough vars with explicitly provided env vars.
 */
function buildContainerEnv(
  explicitEnv?: Record<string, string | undefined>
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const varName of WELL_KNOWN_ENV_VARS) {
    if (process.env[varName]) {
      env[varName] = process.env[varName];
    }
  }

  if (explicitEnv) {
    Object.assign(env, explicitEnv);
  }

  return env;
}

/**
 * Validates that env vars passed to E2EConfig don't have undefined values.
 * When a test passes `process.env.SOME_VAR` and it's not set, we want to
 * fail fast with a clear error rather than silently passing undefined to Docker.
 *
 * @param env - Environment variables from E2EConfig
 * @param suiteName - Test suite name for error context
 * @throws Error if any env vars have undefined values
 */
function validateRequiredEnvVars(
  env: Record<string, string | undefined> | undefined,
  suiteName: string
): void {
  if (!env) return;

  const missingVars = Object.entries(env)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `[${suiteName}] Missing required environment variables: ${missingVars.join(', ')}\n` +
      `Set these variables before running the tests, or remove them from E2EConfig.env if not required.`
    );
  }
}

/**
 * Internal configuration for runE2E.
 */
interface RunE2EInternalConfig extends E2EConfig {
  cwd: string;
  suiteName: string;
}

/**
 * Creates Docker execution utilities for a specific Node version.
 */
function createDockerExecutors(
  config: RunE2EInternalConfig,
  nodeVersion: string,
  imageTag: string,
  repoRoot: string
) {
  const { cwd, suiteName, env } = config;
  const containerEnv = buildContainerEnv(env);

  const runCmd = async (command: string): Promise<E2ETestResult> => {
    const containerName = `e2e-${suiteName}-${nodeVersion.replace(/\./g, '-')}-${Date.now()}`;
    const result = await runNodeContainer({
      imageTag,
      cmd: command,
      cwd,
      env: containerEnv,
      name: containerName,
    });

    // Write output to DEBUG.log for debugging and CI troubleshooting
    await writeDebugLog(repoRoot, cwd, {
      nodeVersion,
      command,
      containerName,
      result,
    });

    return result;
  };

  const runFixture = async (fixturePath: string): Promise<E2ETestResult> => {
    return runCmd(`node ${fixturePath}`);
  };

  return { runCmd, runFixture };
}

/**
 * Runs e2e tests using bun:test.
 * Creates a describe block per Node version and passes test utilities to defineTests.
 *
 * In CI mode, versions not matching COMPOSIO_E2E_NODE_VERSION are skipped.
 * Each version's skipInCI state is computed by resolveNodeVersionMetaList().
 */
export function runE2E(config: RunE2EInternalConfig): void {
  const { suiteName, defineTests, env } = config;

  // Validate env vars early, before any Docker operations
  validateRequiredEnvVars(env, suiteName);

  const nodeVersionMetaList = resolveNodeVersionMetaList(config.nodeVersions);
  const repoRoot = getRepoRoot();

  function renderNodeVersionMeta({ kind, value }: NodeVersionMeta) {
    switch (kind) {
      case 'current':
        return `Node.js ${value} [current]`;
      case 'overridden':
        return `Node.js ${value} [overridden]`;
      case 'static':
        return `Node.js ${value}`;
    }
  }

  for (const nodeVersionMeta of nodeVersionMetaList) {
    const testName = `${suiteName} (${renderNodeVersionMeta(nodeVersionMeta)})`;

    // Skip this version in CI if not selected
    if (nodeVersionMeta.skip.value) {
      describe.skip(`${testName} - skipped: ${nodeVersionMeta.skip.reason}`, () => {
        it('this version should not run in this CI matrix job', () => {});
      });
      continue;
    }

    describe(testName, () => {
      let executors: ReturnType<typeof createDockerExecutors>;

      // Ensure Docker image exists before tests run
      beforeAll(async () => {
        const imageTag = await ensureNodeImage(nodeVersionMeta.value, { repoRoot });
        executors = createDockerExecutors(config, nodeVersionMeta.value, imageTag, repoRoot);
      }, 600_000); // 10 minute timeout for Docker image build

      // Call user's defineTests with bun:test functions and Docker utilities
      defineTests({
        runCmd: (cmd) => executors.runCmd(cmd),
        runFixture: (path) => executors.runFixture(path),
      });
    });
  }
}
