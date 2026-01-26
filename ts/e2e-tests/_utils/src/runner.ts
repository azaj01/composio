import { describe, beforeAll } from 'bun:test';
import type { E2EConfig, E2ETestResult, NodeVersionMeta } from './types';
import { getRepoRoot, resolveNodeVersionMetaList } from './config';
import { ensureNodeImage, runNodeContainer } from './image-lifecycle';

/**
 * Environment variables to automatically pass through to Docker containers.
 */
const PASSTHROUGH_ENV_VARS = ['COMPOSIO_API_KEY', 'OPENAI_API_KEY'] as const;

/**
 * Builds environment variables to pass to the container.
 * Merges auto-passthrough vars with explicitly provided env vars.
 */
function buildContainerEnv(
  explicitEnv?: Record<string, string | undefined>
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  for (const varName of PASSTHROUGH_ENV_VARS) {
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
  imageTag: string
) {
  const { cwd, suiteName, env } = config;
  const containerEnv = buildContainerEnv(env);

  const runCmd = async (command: string): Promise<E2ETestResult> => {
    const containerName = `e2e-${suiteName}-${nodeVersion.replace(/\./g, '-')}-${Date.now()}`;
    return runNodeContainer({
      imageTag,
      cmd: command,
      cwd,
      env: containerEnv,
      name: containerName,
    });
  };

  const runFixture = async (fixturePath: string): Promise<E2ETestResult> => {
    return runCmd(`node ${fixturePath}`);
  };

  return { runCmd, runFixture };
}

/**
 * Runs e2e tests using bun:test.
 * Creates a describe block per Node version and passes test utilities to defineTests.
 */
export function runE2E(config: RunE2EInternalConfig): void {
  const { suiteName, defineTests } = config;
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
    describe(`${suiteName} (Node ${renderNodeVersionMeta(nodeVersionMeta)})`, () => {
      let executors: ReturnType<typeof createDockerExecutors>;

      // Ensure Docker image exists before tests run
      beforeAll(async () => {
        const imageTag = await ensureNodeImage(nodeVersionMeta.value, { repoRoot });
        executors = createDockerExecutors(config, nodeVersionMeta.value, imageTag);
      }, 600_000); // 10 minute timeout for Docker image build

      // Call user's defineTests with bun:test functions and Docker utilities
      defineTests({
        runCmd: (cmd) => executors.runCmd(cmd),
        runFixture: (path) => executors.runFixture(path),
      });
    });
  }
}
