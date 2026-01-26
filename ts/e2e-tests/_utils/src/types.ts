import { WELL_KNOWN_NODE_VERSIONS } from './const';

export type NodeVersionFromUser = typeof WELL_KNOWN_NODE_VERSIONS[number];

export type NodeVersionMeta =
  | { kind: 'static', value: Exclude<typeof WELL_KNOWN_NODE_VERSIONS[number], 'current'> }
  | { kind: 'overridden', value: string }
  | { kind: 'current', value: string };

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
 * Context passed to defineTests callback.
 */
export interface DefineTestsContext {
  /** Run an arbitrary command in the Docker container */
  runCmd: (command: string) => Promise<E2ETestResult>;
  /** Run a fixture file with Node.js (equivalent to runCmd(`node ${path}`)) */
  runFixture: (fixturePath: string) => Promise<E2ETestResult>;
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
   * Define your tests using bun:test primitives.
   * Called once per Node version during test registration.
   *
   * @example
   * ```typescript
   * defineTests: ({ describe, it, expect, beforeAll, runFixture }) => {
   *   let result: E2ETestResult;
   *
   *   beforeAll(async () => {
   *     result = await runFixture('fixtures/test.mjs');
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
