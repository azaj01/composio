import { WELL_KNOWN_NODE_VERSIONS } from './const';

export type NodeVersionFromUser = typeof WELL_KNOWN_NODE_VERSIONS[number];

/**
 * Result of CI skip check for a specific Node version.
 */
export interface SkipInCI {
  value: boolean;
  reason?: string;
}

/**
 * Metadata for a resolved Node.js version to test against.
 * Includes skip state for CI mode.
 */
export type NodeVersionMeta =
  | { kind: 'static'; value: Exclude<typeof WELL_KNOWN_NODE_VERSIONS[number], 'current'>; skip: SkipInCI }
  | { kind: 'overridden'; value: string; skip: SkipInCI }
  | { kind: 'current'; value: string; skip: SkipInCI };

/**
 * Result of executing a command in a Docker container.
 */
export interface E2ETestResult {
  /** Exit code from the command (0 = success) */
  exitCode: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
}

/**
 * Result of runFixture when a setup command is provided.
 * Top-level fields (exitCode, stdout, stderr) reflect the fixture result.
 */
export interface E2ETestResultWithSetup extends E2ETestResult {
  /** Result of the setup command execution */
  setup: E2ETestResult;
}

/**
 * Options for runFixture.
 */
export interface RunFixtureOptions {
  /** Fixture file path relative to cwd (e.g., 'index.mjs') */
  filename: string;
  /** Optional setup command to run before the fixture (e.g., 'npm install --legacy-peer-deps') */
  setup?: string;
}

/**
 * Context passed to defineTests callback.
 */
export interface DefineTestsContext {
  /** Run an arbitrary command in the Docker container */
  runCmd: (command: string) => Promise<E2ETestResult>;
  /**
   * Run a fixture file with Node.js.
   *
   * Without setup: Runs `node <filename>` directly (no Docker volumes).
   * Returns E2ETestResult.
   *
   * With setup: Creates a Docker volume, runs the setup command (e.g., npm install)
   * with the volume mounted read-write, then runs the fixture with the volume
   * mounted read-only. Both commands run regardless of exit codes.
   * Returns E2ETestResultWithSetup.
   *
   * @example
   * // Simple fixture (no setup needed)
   * const result = await runFixture({ filename: 'test.mjs' });
   *
   * @example
   * // Fixture with setup (uses Docker volumes)
   * const result = await runFixture({
   *   filename: 'index.mjs',
   *   setup: 'npm install --legacy-peer-deps',
   * });
   * expect(result.setup.exitCode).toBe(0);
   */
  runFixture: {
    (options: { filename: string }): Promise<E2ETestResult>;
    (options: { filename: string; setup: string }): Promise<E2ETestResultWithSetup>;
  };
}

/**
 * Configuration for e2e tests.
 */
export interface E2EConfig {
  /**
   * Node.js versions to test against.
   * Each version creates a separate describe block.
   * If not provided, defaults to the current Node runtime version.
   */
  nodeVersions?: readonly NodeVersionFromUser[];

  /**
   * Environment variables to pass to the Docker container.
   */
  env?: Record<string, string | undefined>;

  /**
   * When true, sets the working directory to {testDir}/fixtures for Docker commands.
   * This affects:
   * - Volume mount location (fixtures/node_modules instead of testDir/node_modules)
   * - Command execution cwd
   * - Fixture paths in runFixture (relative to fixtures/)
   *
   * @default false
   */
  usesFixtures?: boolean;

  /**
   * Define your tests using bun:test primitives.
   * Called once per Node version during test registration.
   *
   * @example
   * ```typescript
   * defineTests: ({ runFixture }) => {
   *   let result: E2ETestResult;
   *
   *   beforeAll(async () => {
   *     result = await runFixture({ filename: 'fixtures/test.mjs' });
   *   }, 300_000);
   *
   *   describe('output', () => {
   *     it('exits successfully', () => {
   *       expect(result.exitCode).toBe(0);
   *     });
   *   });
   * }
   * ```
   */
  defineTests: (ctx: DefineTestsContext) => void;
}
