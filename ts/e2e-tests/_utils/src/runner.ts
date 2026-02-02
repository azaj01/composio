import { describe, beforeAll, afterAll, it } from 'bun:test';
import { appendFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DefineTestsContext, E2EConfig, E2ETestResult, E2ETestResultWithSetup, NodeVersionMeta, NonEmptyString, RunFixtureOptions } from './types';
import { getRepoRoot, resolveNodeVersionMetaList } from './config';
import { ensureNodeImage, runNodeContainer } from './image-lifecycle';
import { WELL_KNOWN_ENV_VARS } from './const';
import { createVolume, generateVolumeName, initializeVolumeOwnership, removeVolume } from './volume';

// ============================================================================
// DEBUG.log Manager - Structured logging for e2e test output
// ============================================================================

/**
 * Result of a single phase execution.
 */
interface PhaseResult {
  phase: 'setup' | 'fixture';
  phaseIndex: number;
  totalPhases: number;
  command: string;
  containerName: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Aggregated results for a Node version.
 */
interface VersionResult {
  version: string;
  status: 'pass' | 'fail' | 'skipped';
  reason?: string;
  imageTag?: string;
  phases: PhaseResult[];
  totalDurationMs?: number;
}

/**
 * Configuration for DebugLogManager.
 */
interface DebugLogManagerOptions {
  logPath: string;
  suiteName: string;
  testFilePath: string;
  nodeVersions: string[];
}

/**
 * Manages structured DEBUG.log output for e2e tests.
 * Clears the file at initialization, groups phases by Node version,
 * and writes a summary at the end.
 */
class DebugLogManager {
  private versionResults: VersionResult[] = [];
  private startTime: Date;
  private initialized = false;

  constructor(private options: DebugLogManagerOptions) {
    this.startTime = new Date();
  }

  /**
   * Initialize the log file - clears it and writes the header.
   * Must be called before any version sections are written.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const header = this.formatHeader();
    await writeFile(this.options.logPath, header, 'utf-8');
    this.initialized = true;
  }

  /**
   * Write a version section to the log file.
   * Call this after all phases for a version have completed.
   */
  async writeVersionSection(result: VersionResult): Promise<void> {
    // Ensure initialized (lazy init if needed)
    if (!this.initialized) {
      await this.initialize();
    }
    this.versionResults.push(result);
    const section = this.formatVersionSection(result);
    await appendFile(this.options.logPath, section, 'utf-8');
  }

  /**
   * Write the summary section to the log file.
   * Call this after all versions have completed.
   */
  async writeSummary(): Promise<void> {
    const summary = this.formatSummary();
    await appendFile(this.options.logPath, summary, 'utf-8');
  }

  private formatHeader(): string {
    const divider = '='.repeat(80);
    return [
      divider,
      `E2E Test: ${this.options.suiteName}`,
      `Started: ${this.startTime.toISOString()}`,
      `Test file: ${this.options.testFilePath}`,
      `Node versions: ${this.options.nodeVersions.join(', ')}`,
      divider,
      '',
    ].join('\n');
  }

  private formatVersionSection(result: VersionResult): string {
    const dividerHeavy = '#'.repeat(80);
    const lines: string[] = [
      '',
      dividerHeavy,
      `### Node.js ${result.version}${result.status === 'skipped' ? ' (SKIPPED)' : ''}`,
      dividerHeavy,
    ];

    if (result.status === 'skipped') {
      lines.push(`Reason: ${result.reason || 'No reason provided'}`);
    } else {
      if (result.imageTag) {
        lines.push(`Image: ${result.imageTag}`);
      }
      lines.push(''); // blank line before phases

      for (const phase of result.phases) {
        lines.push(...this.formatPhase(phase));
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  private formatPhase(phase: PhaseResult): string[] {
    const exitStatus = phase.exitCode === 0 ? 'success' : 'failure';
    const durationSec = (phase.durationMs / 1000).toFixed(2);

    return [
      `--- Phase ${phase.phaseIndex}/${phase.totalPhases}: ${phase.phase} ---`,
      `Container: ${phase.containerName}`,
      `Command: ${phase.command}`,
      `Duration: ${durationSec}s`,
      `Exit Code: ${phase.exitCode} (${exitStatus})`,
      '',
      '[stdout]',
      phase.stdout?.trim() || '(empty)',
      '',
      '[stderr]',
      phase.stderr?.trim() || '(empty)',
      '',
    ];
  }

  private formatSummary(): string {
    const divider = '='.repeat(80);
    const endTime = new Date();
    const totalDurationMs = endTime.getTime() - this.startTime.getTime();
    const totalDurationSec = (totalDurationMs / 1000).toFixed(2);

    const lines: string[] = [
      divider,
      'Summary',
      divider,
    ];

    for (const result of this.versionResults) {
      if (result.status === 'skipped') {
        lines.push(`Node.js ${result.version}: SKIPPED`);
      } else {
        const status = result.status.toUpperCase();
        const phaseCount = result.phases.length;
        const versionDurationSec = result.totalDurationMs
          ? (result.totalDurationMs / 1000).toFixed(2)
          : '?';
        lines.push(`Node.js ${result.version}: ${status} (${phaseCount} phases, ${versionDurationSec}s total)`);
      }
    }

    lines.push('');
    lines.push(`Finished: ${endTime.toISOString()}`);
    lines.push(`Total duration: ${totalDurationSec}s`);
    lines.push(divider);
    lines.push('');

    return lines.join('\n');
  }
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
 * Context for tracking phase results within a version.
 */
interface VersionExecutionContext {
  phases: PhaseResult[];
  versionStartTime: number;
  imageTag: string;
}

/**
 * Creates Docker execution utilities for a specific Node version.
 * Now tracks phase results for the DebugLogManager.
 */
function createDockerExecutors(
  config: RunE2EInternalConfig,
  nodeVersion: string,
  imageTag: string,
  repoRoot: string,
  logManager: DebugLogManager
) {
  const { cwd, suiteName, env, usesFixtures } = config;
  const containerEnv = buildContainerEnv(env);

  // Compute effective cwd based on usesFixtures flag
  const effectiveCwd = usesFixtures ? `${cwd}/fixtures` : cwd;

  // Track execution context for this version
  const context: VersionExecutionContext = {
    phases: [],
    versionStartTime: Date.now(),
    imageTag,
  };

  const runCmd = async (command: string): Promise<E2ETestResult> => {
    const containerName = `e2e-${suiteName}-${nodeVersion.replace(/\./g, '-')}-${Date.now()}`;
    const startTime = Date.now();

    const result = await runNodeContainer({
      imageTag,
      cmd: command,
      cwd: effectiveCwd,
      env: containerEnv,
      name: containerName,
    });

    const durationMs = Date.now() - startTime;

    // Track as a standalone phase (not pre/fixture)
    context.phases.push({
      phase: 'fixture',
      phaseIndex: context.phases.length + 1,
      totalPhases: context.phases.length + 1, // Updated later if more phases
      command,
      containerName,
      durationMs,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });

    return result;
  };

  /**
   * Unified fixture runner with optional setup phase.
   *
   * Without setup: Runs `node <filename>` directly (no Docker volumes).
   * With setup: Creates a Docker volume, runs setup command with volume mounted
   * read-write, then runs the fixture with volume mounted read-only.
   */
  function runFixture<const F extends string>(options: { filename: NonEmptyString<F> }): Promise<E2ETestResult>;
  function runFixture<const F extends string, const S extends string>(options: { filename: NonEmptyString<F>; setup: NonEmptyString<S> }): Promise<E2ETestResultWithSetup>;
  async function runFixture(options: RunFixtureOptions): Promise<E2ETestResult | E2ETestResultWithSetup> {
    const { filename, setup } = options;

    // Smart mode: no setup (or empty string) = no volumes, just run directly
    if (!setup) {
      return runCmd(`node ${filename}`);
    }

    // With setup: use Docker volumes
    const volumeName = generateVolumeName(suiteName, nodeVersion);
    const containerBaseName = `e2e-${suiteName}-${nodeVersion.replace(/\./g, '-')}-${Date.now()}`;

    // The volume mounts at node_modules relative to the effective cwd
    const volumeTarget = `${effectiveCwd.startsWith('/') ? effectiveCwd : `/app/${effectiveCwd}`}/node_modules`;

    try {
      // 1. Create volume
      await createVolume(volumeName);

      // 2. Initialize volume with correct ownership for node user (UID 1000)
      await initializeVolumeOwnership(volumeName, imageTag);

      // 3. Run setup command with volume mounted read-write
      const setupContainerName = `${containerBaseName}-setup`;
      const setupStartTime = Date.now();
      const setupResult = await runNodeContainer({
        imageTag,
        cmd: setup,
        cwd: effectiveCwd,
        env: containerEnv,
        name: setupContainerName,
        volumes: [{
          volume: volumeName,
          target: volumeTarget,
          readonly: false,
        }],
      });
      const setupDurationMs = Date.now() - setupStartTime;

      // Track setup phase
      context.phases.push({
        phase: 'setup',
        phaseIndex: 1,
        totalPhases: 2,
        command: setup,
        containerName: setupContainerName,
        durationMs: setupDurationMs,
        exitCode: setupResult.exitCode,
        stdout: setupResult.stdout,
        stderr: setupResult.stderr,
      });

      // 4. Run fixture with volume mounted read-only (runs regardless of setup exit code)
      const fixtureContainerName = `${containerBaseName}-fixture`;
      const fixtureStartTime = Date.now();
      const fixtureResult = await runNodeContainer({
        imageTag,
        cmd: `node ${filename}`,
        cwd: effectiveCwd,
        env: containerEnv,
        name: fixtureContainerName,
        volumes: [{
          volume: volumeName,
          target: volumeTarget,
          readonly: true,
        }],
      });
      const fixtureDurationMs = Date.now() - fixtureStartTime;

      // Track fixture phase
      context.phases.push({
        phase: 'fixture',
        phaseIndex: 2,
        totalPhases: 2,
        command: `node ${filename}`,
        containerName: fixtureContainerName,
        durationMs: fixtureDurationMs,
        exitCode: fixtureResult.exitCode,
        stdout: fixtureResult.stdout,
        stderr: fixtureResult.stderr,
      });

      // 5. Return combined result (top-level is fixture result)
      return {
        ...fixtureResult,
        setup: setupResult,
      };
    } finally {
      // 6. Always cleanup volume (best-effort, doesn't throw)
      await removeVolume(volumeName);
    }
  }

  /**
   * Finalize this version's log output.
   * Call this after all test phases have completed.
   */
  const finalizeVersionLog = async (): Promise<void> => {
    const totalDurationMs = Date.now() - context.versionStartTime;

    // Determine overall status based on exit codes
    const allPassed = context.phases.every(p => p.exitCode === 0);
    const status: 'pass' | 'fail' = allPassed ? 'pass' : 'fail';

    await logManager.writeVersionSection({
      version: nodeVersion,
      status,
      imageTag: context.imageTag,
      phases: context.phases,
      totalDurationMs,
    });
  };

  return { runCmd, runFixture, finalizeVersionLog, context };
}

/**
 * Runs e2e tests using bun:test.
 * Creates a describe block per Node version and passes test utilities to defineTests.
 *
 * In CI mode, versions not matching COMPOSIO_E2E_NODE_VERSION are skipped.
 * Each version's skipInCI state is computed by resolveNodeVersionMetaList().
 */
export function runE2E(config: RunE2EInternalConfig): void {
  const { cwd, suiteName, defineTests, env } = config;

  // Validate env vars early, before any Docker operations
  validateRequiredEnvVars(env, suiteName);

  const nodeVersionMetaList = resolveNodeVersionMetaList(config.nodeVersions);
  const repoRoot = getRepoRoot();

  // Create the debug log manager for structured output
  const logPath = resolve(repoRoot, cwd, 'DEBUG.log');
  const allVersions = nodeVersionMetaList.map(v => v.value);
  const logManager = new DebugLogManager({
    logPath,
    suiteName,
    testFilePath: `${cwd}/e2e.test.ts`,
    nodeVersions: allVersions,
  });

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

  // Wrap all tests in a top-level describe to handle initialization and summary
  describe(suiteName, () => {
    // Initialize log file before any tests run
    beforeAll(async () => {
      await logManager.initialize();
    });

    for (const nodeVersionMeta of nodeVersionMetaList) {
      const testName = renderNodeVersionMeta(nodeVersionMeta);

      // Skip this version in CI if not selected
      if (nodeVersionMeta.skip.value) {
        describe(`${testName} - skipped: ${nodeVersionMeta.skip.reason}`, () => {
          beforeAll(async () => {
            // Write skip marker to log
            await logManager.writeVersionSection({
              version: nodeVersionMeta.value,
              status: 'skipped',
              reason: nodeVersionMeta.skip.reason || 'Skipped in CI',
              phases: [],
            });
          });

          it.skip('this version should not run in this CI matrix job', () => {});
        });
        continue;
      }

      describe(testName, () => {
        let executors: ReturnType<typeof createDockerExecutors>;

        // Ensure Docker image exists before tests run
        beforeAll(async () => {
          const imageTag = await ensureNodeImage(nodeVersionMeta.value, { repoRoot });
          executors = createDockerExecutors(config, nodeVersionMeta.value, imageTag, repoRoot, logManager);
        }, 600_000); // 10 minute timeout for Docker image build

        // Call user's defineTests with bun:test functions and Docker utilities
        defineTests({
          runCmd: (cmd) => executors.runCmd(cmd),
          runFixture: ((opts: RunFixtureOptions) => executors.runFixture(opts)) as DefineTestsContext['runFixture'],
        });

        // Write version section after all tests for this version complete
        afterAll(async () => {
          if (executors) {
            await executors.finalizeVersionLog();
          }
        });
      });
    }

    // Write summary after all versions complete
    afterAll(async () => {
      await logManager.writeSummary();
    });
  });
}
