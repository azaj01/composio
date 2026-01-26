export type NodeVersion = '20.18.0' | '20.19.0' | '22.12.0' | (string & {});

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
 * Results for both phases of a two-phase e2e test.
 */
export interface E2EPhaseResults {
  /** Node.js version this test ran against */
  nodeVersion: string;
  /** Result of the setup phase (undefined if no setup command) */
  setup?: E2ETestResult;
  /** Result of the test/fixture phase */
  test: E2ETestResult;
}

/**
 * Assertion callback for validating phase results.
 */
export type E2EAssertionCallback = (result: E2ETestResult) => void | Promise<void>;

/**
 * Configuration for e2e tests.
 */
export interface E2EConfig {
  /**
   * The fixture file to execute (e.g., 'fixtures/test.mjs').
   */
  fixture: string;

  /**
   * Node.js versions to test against.
   * If not provided, defaults to the current Node runtime version.
   */
  nodeVersions?: readonly NodeVersion[];

  /**
   * Setup command to run before the test fixture.
   * Runs inside the Docker container after dependencies are installed.
   */
  setup?: string;

  /**
   * Environment variables to pass to the container.
   */
  env?: Record<string, string | undefined>;

  /**
   * Assertion callback for the setup phase.
   * Called after setup completes (if setup is defined).
   */
  onSetup?: E2EAssertionCallback;

  /**
   * Assertion callback for the test phase.
   * Called after the fixture completes.
   */
  onTest?: E2EAssertionCallback;

  /**
   * Custom summary printer. If not provided, uses default summary format.
   */
  printSummary?: (results: E2EPhaseResults[], allPassed: boolean) => void;
}
