import { writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { E2EConfig, E2EPhaseResults, E2ETestResult } from './types';
import { getRepoRoot, resolveNodeVersions } from './config';
import { checkDocker, ensureNodeImage, runNodeContainer } from './image-lifecycle';

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
 * Initialize the DEBUG.log file with a header.
 */
function initDebugLog(logPath: string, suiteName: string, nodeVersions: readonly string[]): void {
  const header = [
    `=== E2E Test: ${suiteName} ===`,
    `Started: ${new Date().toISOString()}`,
    `Node versions: ${nodeVersions.join(', ')}`,
    '',
    '',
  ].join('\n');
  writeFileSync(logPath, header, 'utf8');
}

/**
 * Append a phase result to the DEBUG.log file.
 */
function appendPhaseToDebugLog(
  logPath: string,
  nodeVersion: string,
  phaseName: 'Setup' | 'Test',
  result: E2ETestResult
): void {
  const lines = [
    `=== ${phaseName} (Node ${nodeVersion}) ===`,
    '',
    '[stdout]',
    result.stdout || '(empty)',
    '',
    '[stderr]',
    result.stderr || '(empty)',
    '',
    `[exit code] ${result.exitCode}`,
    '',
    '',
  ];
  appendFileSync(logPath, lines.join('\n'), 'utf8');
}

/**
 * Append a summary to the DEBUG.log file.
 */
function appendSummaryToDebugLog(
  logPath: string,
  results: E2EPhaseResults[],
  allPassed: boolean
): void {
  const lines = ['=== Summary ===', ''];
  for (const r of results) {
    const status = r.test.exitCode === 0 ? 'PASS' : 'FAIL';
    lines.push(`Node ${r.nodeVersion}: ${status}`);
  }
  lines.push('');
  lines.push(allPassed ? 'All tests passed!' : 'Some tests failed');
  lines.push('');
  lines.push(`Finished: ${new Date().toISOString()}`);
  lines.push('');
  appendFileSync(logPath, lines.join('\n'), 'utf8');
}

/**
 * Default summary printer for e2e test results.
 */
function printDefaultSummary(
  suiteName: string,
  results: E2EPhaseResults[],
  allPassed: boolean
): void {
  const divider = '='.repeat(Math.max(suiteName.length + 4, 30));

  console.log(`\n${divider}`);
  console.log(`Test Summary`);
  console.log(divider);

  for (const r of results) {
    const testStatus = r.test.exitCode === 0 ? 'PASS' : 'FAIL';
    console.log(`Node ${r.nodeVersion}: ${testStatus}`);
  }

  if (allPassed) {
    console.log(`\nAll tests passed!`);
  } else {
    console.error(`\nSome tests failed`);
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
 * Runs e2e tests with Docker containers.
 *
 * For each Node version:
 * 1. Ensures Docker image exists (builds if needed)
 * 2. Runs setup command (if provided) and fixture in a single container
 * 3. Captures output and exit codes
 * 4. Calls assertion callbacks
 *
 * Writes detailed output to DEBUG.log and prints a summary.
 */
export async function runE2E(config: RunE2EInternalConfig): Promise<never> {
  const { cwd, suiteName, fixture, setup, env, onSetup, onTest, printSummary } = config;
  const nodeVersions = resolveNodeVersions(config.nodeVersions);
  const repoRoot = getRepoRoot();
  const debugLogPath = resolve(repoRoot, cwd, 'DEBUG.log');

  // Initialize DEBUG.log
  initDebugLog(debugLogPath, suiteName, nodeVersions);
  console.log(`Debug log: ${debugLogPath}`);

  // Print header
  console.log(`\n${suiteName}`);
  console.log('='.repeat(suiteName.length));
  console.log(`Node versions: ${nodeVersions.join(', ')}`);
  console.log(`Fixture: ${fixture}\n`);

  // Check Docker availability
  let dockerOk = false;
  let dockerFailureMessage = '';
  try {
    const dockerCheck = await checkDocker({ repoRoot });
    dockerOk = dockerCheck.exitCode === 0;
    dockerFailureMessage = dockerCheck.stderr || dockerCheck.stdout || '';
  } catch (error) {
    dockerOk = false;
    dockerFailureMessage = error instanceof Error ? error.message : String(error);
  }

  if (!dockerOk) {
    const reason = dockerFailureMessage.trim() || 'Docker is not available';
    const message = `Skipping e2e suite because Docker is not available. Reason: ${reason}`;
    console.log(message);
    appendFileSync(debugLogPath, `\n${message}\n`, 'utf8');
    process.exit(0);
  }

  const results: E2EPhaseResults[] = [];

  try {
    for (const nodeVersion of nodeVersions) {
      console.log(`\n=== Running e2e test for Node.js ${nodeVersion} ===\n`);

      const imageTag = await ensureNodeImage(nodeVersion, { repoRoot });

      const phaseResult: E2EPhaseResults = {
        nodeVersion,
        test: undefined as unknown as E2ETestResult,
      };

      // Build combined command: setup (if provided) && fixture
      const fixtureCmd = `node ${fixture}`;
      const combinedCmd = setup ? `${setup} && ${fixtureCmd}` : fixtureCmd;

      if (setup) {
        console.log(`[Node ${nodeVersion}] Running setup: ${setup}`);
      }
      console.log(`[Node ${nodeVersion}] Running fixture: ${fixtureCmd}`);

      const containerName = `e2e-${suiteName}-${nodeVersion.replace(/\./g, '-')}`;
      const result = await runNodeContainer({
        imageTag,
        cmd: combinedCmd,
        cwd,
        env: buildContainerEnv(env),
        name: containerName,
      });

      phaseResult.test = result;

      if (setup) {
        phaseResult.setup = result;
        console.log(`[Setup+Test stdout]\n${result.stdout || '(empty)'}`);
        console.log(`[Setup+Test stderr]\n${result.stderr || '(empty)'}`);
        console.log(`[Exit code] ${result.exitCode}\n`);

        appendPhaseToDebugLog(debugLogPath, nodeVersion, 'Setup', result);
        appendPhaseToDebugLog(debugLogPath, nodeVersion, 'Test', result);

        if (onSetup) {
          await onSetup(result);
        }
      } else {
        if (result.stdout) {
          console.log(`[Test stdout]\n${result.stdout}`);
        }
        if (result.stderr) {
          console.log(`[Test stderr]\n${result.stderr}`);
        }
        console.log(`[Test exit code] ${result.exitCode}\n`);

        appendPhaseToDebugLog(debugLogPath, nodeVersion, 'Test', result);
      }

      if (onTest) {
        await onTest(result);
      }

      results.push(phaseResult);
    }

    const allPassed = results.every((r) => r.test.exitCode === 0);

    appendSummaryToDebugLog(debugLogPath, results, allPassed);

    if (printSummary) {
      printSummary(results, allPassed);
    } else {
      printDefaultSummary(suiteName, results, allPassed);
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  }
}
