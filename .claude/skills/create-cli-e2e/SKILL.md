# CLI E2E Test Development

Write, expand, and maintain end-to-end tests for CLI commands in `ts/e2e-tests/cli/`.

## When to Use

- Adding a new e2e test suite for a CLI command
- Modifying or extending an existing CLI e2e test
- Debugging a failing CLI e2e test
- Reviewing whether a CLI command's output contract is properly tested

## Architecture

Each CLI e2e test runs the compiled `composio` binary inside a **scratch Debian Docker container**. The binary is self-contained (built via `bun build --compile`) — no Node, Bun, or pnpm exists in the runtime image.

Key properties:

- Each test suite = a directory under `ts/e2e-tests/cli/<suite-name>/`
- Use `runCmd` only. Never use `runFixture` (throws an error for CLI tests). Never set `usesFixtures`.
- **Each `runCmd` call creates a fresh container.** No state persists between calls.
- Commands run inside `sh -c '...'` — POSIX shell only, no bash-isms.
- Containers have network access — API-calling commands work.
- `HOME=/tmp`, cache dir is `/tmp/.composio/` — auth passes via env vars only.
- `process.stdout.isTTY` is always `false` inside Docker — the CLI always runs in piped mode.

### What "piped mode" means for tests

Inside Docker `sh -c`, the composio binary's stdout is never a TTY. This means `ui.output()` writes to stdout and all Clack decoration is suppressed. Both test groups verify piped-mode behavior:

| Test Group | What It Verifies |
|---|---|
| **Command execution** (`composio version`) | stdout contains the data, stderr is empty |
| **Stdout redirection** (`composio version > out.txt`) | Shell-level redirect captures data into a file; Docker stdout and stderr are both empty |

## File Structure

For a new test suite `<suite-name>`, create 2 files:

```
ts/e2e-tests/cli/<suite-name>/
├── e2e.test.ts     # Test file
└── package.json    # Package manifest
```

### Naming Conventions

- **Directory**: hyphen-separated lowercase matching the command structure
  - `version`, `whoami`, `toolkits-list`, `tools-info`, `auth-configs-list`, `connected-accounts-link`
- **Package name**: `@e2e-tests/cli-<suite-name>`
  - `@e2e-tests/cli-version`, `@e2e-tests/cli-toolkits-list`

### package.json Template

```json
{
  "name": "@e2e-tests/cli-<suite-name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:e2e": "bun test e2e.test.ts",
    "test:e2e:cli": "bun test e2e.test.ts"
  },
  "devDependencies": {
    "@e2e-tests/utils": "workspace:*"
  }
}
```

## Test Patterns

Every test file starts with the same structure:

```typescript
import { e2e, sanitizeOutput, type E2ETestResult, type E2ETestResultWithFiles } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';

e2e(import.meta.url, {
  versions: { cli: ['current'] },
  // env: { ... },  // Only if needed
  defineTests: ({ runCmd }) => {
    // Tests here
  },
});
```

### Pattern A: Simple Command, No Env Vars

For commands that produce deterministic output without needing authentication.

**Reference**: `ts/e2e-tests/cli/version/e2e.test.ts`

```typescript
/**
 * CLI version command e2e test
 *
 * Verifies that the compiled composio CLI behaves correctly in a scratch container.
 */

import { e2e, sanitizeOutput, type E2ETestResult, type E2ETestResultWithFiles } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';
import cliPkg from '../../../packages/cli/package.json' with { type: 'json' };

e2e(import.meta.url, {
  versions: {
    cli: ['current'],
  },
  defineTests: ({ runCmd }) => {
    const expectedVersion = String(cliPkg.version ?? '').trim();
    let versionResult: E2ETestResult;
    let redirectedResult: E2ETestResultWithFiles<'out.txt'>;

    beforeAll(async () => {
      versionResult = await runCmd('composio version');
      redirectedResult = await runCmd({
        command: 'composio version > out.txt',
        files: ['out.txt'],
      });
    }, TIMEOUTS.FIXTURE);

    describe('composio version', () => {
      it('exits successfully', () => {
        expect(versionResult.exitCode).toBe(0);
      });

      it('stdout matches snapshot', () => {
        expect(sanitizeOutput(versionResult.stdout)).toBe(expectedVersion);
      });

      it('stderr matches snapshot', () => {
        expect(versionResult.stderr).toBe('');
      });
    });

    describe('stdout redirection to out.txt', () => {
      it('exits successfully', () => {
        expect(redirectedResult.exitCode).toBe(0);
      });

      it('stdout is empty', () => {
        expect(redirectedResult.stdout).toBe('');
      });

      it('stderr is empty', () => {
        expect(redirectedResult.stderr).toBe('');
      });

      it('out.txt matches snapshot', () => {
        expect(sanitizeOutput(redirectedResult.files['out.txt'])).toBe(expectedVersion);
      });
    });
  },
});
```

### Pattern B: Command Requiring Env Vars

For commands that need authentication or configuration from the host environment.

**Reference**: `ts/e2e-tests/cli/whoami/e2e.test.ts`

Three additions compared to Pattern A:

1. **Type augmentation** for compile-time safety on `Bun.env`:
   ```typescript
   declare module 'bun' {
     interface Env {
       COMPOSIO_API_KEY: string;
     }
   }
   ```

2. **Pass env vars** in the config:
   ```typescript
   env: {
     COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
   },
   ```

3. **Derive expected values** from the env:
   ```typescript
   const expectedApiKey = Bun.env.COMPOSIO_API_KEY.trim();
   ```

The rest follows the same two-group structure (command execution + stdout redirection).

**Full example:**

```typescript
/**
 * CLI whoami command e2e test
 *
 * Verifies that the compiled composio CLI prints the API key in a scratch container.
 */

import { e2e, sanitizeOutput, type E2ETestResult, type E2ETestResultWithFiles } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';

declare module 'bun' {
  interface Env {
    COMPOSIO_API_KEY: string;
  }
}

e2e(import.meta.url, {
  versions: {
    cli: ['current'],
  },
  env: {
    COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
  },
  defineTests: ({ runCmd }) => {
    const expectedApiKey = Bun.env.COMPOSIO_API_KEY.trim();
    let whoamiResult: E2ETestResult;
    let redirectedResult: E2ETestResultWithFiles<'out.txt'>;

    beforeAll(async () => {
      whoamiResult = await runCmd('composio whoami');
      redirectedResult = await runCmd({
        command: 'composio whoami > out.txt',
        files: ['out.txt'],
      });
    }, TIMEOUTS.FIXTURE);

    describe('composio whoami', () => {
      it('exits successfully', () => {
        expect(whoamiResult.exitCode).toBe(0);
      });

      it('stdout contains the API key', () => {
        expect(sanitizeOutput(whoamiResult.stdout)).toBe(expectedApiKey);
      });

      it('stderr is empty', () => {
        expect(whoamiResult.stderr).toBe('');
      });
    });

    describe('stdout redirection to out.txt', () => {
      it('exits successfully', () => {
        expect(redirectedResult.exitCode).toBe(0);
      });

      it('stdout is empty', () => {
        expect(redirectedResult.stdout).toBe('');
      });

      it('stderr is empty', () => {
        expect(redirectedResult.stderr).toBe('');
      });

      it('out.txt contains the API key', () => {
        expect(sanitizeOutput(redirectedResult.files['out.txt'])).toBe(expectedApiKey);
      });
    });
  },
});
```

### Pattern C: Error Case Testing

For verifying that the CLI fails gracefully with correct exit codes and error messages.

```typescript
/**
 * CLI tools-info error case e2e test
 *
 * Verifies that the CLI fails gracefully when required arguments are missing.
 */

import { e2e, sanitizeOutput, type E2ETestResult } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';

e2e(import.meta.url, {
  versions: {
    cli: ['current'],
  },
  defineTests: ({ runCmd }) => {
    let missingArgResult: E2ETestResult;

    beforeAll(async () => {
      missingArgResult = await runCmd('composio tools info');
    }, TIMEOUTS.FIXTURE);

    describe('composio tools info (missing argument)', () => {
      it('exits with non-zero code', () => {
        expect(missingArgResult.exitCode).not.toBe(0);
      });

      it('stderr contains an error message', () => {
        expect(missingArgResult.stderr).not.toBe('');
      });
    });
  },
});
```

Notes:
- No stdout redirection test needed — error cases don't produce data output.
- Use `not.toBe(0)` for exit code rather than a specific number (the CLI may change error codes).
- Assert stderr is non-empty; optionally use `toContain()` for specific error message fragments.

### Pattern D: Multi-line / API-dependent Output

For commands that call the Composio API and return dynamic, multi-line data.

```typescript
/**
 * CLI toolkits-list command e2e test
 *
 * Verifies that the CLI lists available toolkits from the API.
 */

import { e2e, sanitizeOutput, type E2ETestResult, type E2ETestResultWithFiles } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';

declare module 'bun' {
  interface Env {
    COMPOSIO_API_KEY: string;
  }
}

e2e(import.meta.url, {
  versions: {
    cli: ['current'],
  },
  env: {
    COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
  },
  defineTests: ({ runCmd }) => {
    let listResult: E2ETestResult;
    let redirectedResult: E2ETestResultWithFiles<'out.txt'>;

    beforeAll(async () => {
      listResult = await runCmd('composio toolkits list');
      redirectedResult = await runCmd({
        command: 'composio toolkits list > out.txt',
        files: ['out.txt'],
      });
    }, TIMEOUTS.FIXTURE);

    describe('composio toolkits list', () => {
      it('exits successfully', () => {
        expect(listResult.exitCode).toBe(0);
      });

      it('stdout is non-empty', () => {
        expect(sanitizeOutput(listResult.stdout).length).toBeGreaterThan(0);
      });

      it('stdout contains known toolkits', () => {
        const output = sanitizeOutput(listResult.stdout);
        // Use well-known toolkits that are always present
        expect(output).toContain('github');
      });

      it('stdout has multiple lines', () => {
        const lines = sanitizeOutput(listResult.stdout).split('\n').filter(Boolean);
        expect(lines.length).toBeGreaterThan(1);
      });

      it('stderr is empty', () => {
        expect(listResult.stderr).toBe('');
      });
    });

    describe('stdout redirection to out.txt', () => {
      it('exits successfully', () => {
        expect(redirectedResult.exitCode).toBe(0);
      });

      it('stdout is empty', () => {
        expect(redirectedResult.stdout).toBe('');
      });

      it('stderr is empty', () => {
        expect(redirectedResult.stderr).toBe('');
      });

      it('out.txt contains data', () => {
        expect(sanitizeOutput(redirectedResult.files['out.txt']).length).toBeGreaterThan(0);
      });
    });
  },
});
```

Key rules for API-dependent output:
- **Never use exact-match assertions** (`toBe`) on API data — the data changes over time.
- Use `toContain()` for known, stable items (e.g., `github`, `gmail` are always present).
- Use `toBeGreaterThan()` for structural checks (line count, length).
- Use `toMatch()` with regex for format validation.

### Pattern E: Action Command, No Stdout Data

For commands that perform an action but produce no machine-readable output (e.g., `logout`, `upgrade`).

```typescript
/**
 * CLI logout command e2e test
 *
 * Verifies that the CLI logout command completes without error.
 */

import { e2e, type E2ETestResult } from '@e2e-tests/utils';
import { TIMEOUTS } from '@e2e-tests/utils/const';
import { describe, it, expect, beforeAll } from 'bun:test';

e2e(import.meta.url, {
  versions: {
    cli: ['current'],
  },
  defineTests: ({ runCmd }) => {
    let logoutResult: E2ETestResult;

    beforeAll(async () => {
      logoutResult = await runCmd('composio logout');
    }, TIMEOUTS.FIXTURE);

    describe('composio logout', () => {
      it('exits successfully', () => {
        expect(logoutResult.exitCode).toBe(0);
      });

      it('stdout is empty', () => {
        expect(logoutResult.stdout).toBe('');
      });

      it('stderr is empty', () => {
        expect(logoutResult.stderr).toBe('');
      });
    });
  },
});
```

Notes:
- No redirection test needed — there's no data to redirect.
- No `sanitizeOutput()` needed — stdout should be literally empty.
- Import only `E2ETestResult`, not `E2ETestResultWithFiles`.

## Output Contract Rules

Enforce these in every CLI e2e test:

1. **Data commands** produce machine-readable output on stdout (via `ui.output()`).
2. **Action commands** produce no stdout data — stdout is always empty.
3. **stderr is always empty** for successful commands (non-TTY suppresses all Clack decoration).
4. **Redirected output** (`> out.txt`) captures the same data that direct stdout contains; Docker stdout and stderr both become empty.

## Commands NOT Testable with This Framework

Do not attempt to write e2e tests for:

| Category | Examples | Why |
|---|---|---|
| **Interactive commands** | `login`, `init` (with prompts) | No TTY in Docker — Clack prompts hang |
| **Long-running commands** | `triggers listen` | No mechanism to stop the process |
| **Browser-dependent commands** | `login` (without `--no-browser`) | No browser in Docker |
| **Host filesystem writers** | `generate` (writes to project dir) | Docker container is isolated |

## Environment Variables

### Auto-passed vars

`COMPOSIO_API_KEY` and `OPENAI_API_KEY` are automatically forwarded to Docker containers if present on the host (defined in `WELL_KNOWN_ENV_VARS`).

### Declaring required vars

For tests that need env vars:

1. Add the `declare module 'bun'` augmentation (compile-time safety).
2. Pass via `E2EConfig.env` (runtime delivery to Docker).
3. If any `E2EConfig.env` value is `undefined`, the test fails fast at startup — before any Docker container runs.

### Multiple env vars

```typescript
declare module 'bun' {
  interface Env {
    COMPOSIO_API_KEY: string;
    COMPOSIO_BASE_URL: string;
  }
}

e2e(import.meta.url, {
  env: {
    COMPOSIO_API_KEY: Bun.env.COMPOSIO_API_KEY,
    COMPOSIO_BASE_URL: Bun.env.COMPOSIO_BASE_URL,
  },
  // ...
});
```

## Shell Quoting

Commands run inside `sh -c '...'` in a POSIX shell. Rules:

- Use double quotes for flag values with spaces or special chars:
  ```typescript
  runCmd('composio tools info "GMAIL_SEND_EMAIL"')
  ```
- Use single quotes inside double-quoted contexts for literal strings.
- **No bash-isms**: no `[[`, no `$()`, no arrays.
- `PATH` is `/usr/local/bin:/bin` — set in the Dockerfile.

## Checklist for Adding a New Test Suite

1. **Create directory**: `ts/e2e-tests/cli/<suite-name>/`
2. **Create `package.json`**: Use the template above with name `@e2e-tests/cli-<suite-name>`
3. **Create `e2e.test.ts`**: Follow the appropriate pattern (A through E)
4. **Run `pnpm install`** from the monorepo root to resolve the workspace link
5. **Run `pnpm test:e2e:cli`** to verify the test passes
6. **Update `ts/e2e-tests/cli/README.md`**: Add a new row to the test suites table

### README table format

```markdown
| [suite-name](./suite-name/) | `composio <command>` description | `ENV_VAR_1`, `ENV_VAR_2` (or None) |
```

## Troubleshooting

### Reading DEBUG.log

Each test suite generates a `DEBUG.log` in its directory with Docker execution details: container name, command, duration, exit code, stdout, stderr. Read this first when a test fails.

### Stale Docker image

If CLI code changed but tests show old behavior, the Docker image is cached. Rebuild:

```bash
docker rmi composio-e2e-cli:$(jq -r .version ts/packages/cli/package.json)
```

### Shell quoting issues

Check the command string in `DEBUG.log`. Look for unescaped special characters that break `sh -c` parsing.

### Missing env vars

The error appears at test startup (before any Docker container runs), not during execution. Verify `Bun.env.*` values are set in your shell.

### Container statelessness

Each `runCmd` call runs in a fresh container. If you need to test a multi-step workflow (e.g., "set config then run command"), you must chain commands in a single `runCmd` call:

```typescript
runCmd('composio logout && composio whoami')
```

## API Reference

### `e2e(importMetaUrl, config)`

Entry point. Pass `import.meta.url` as the first argument — the framework infers `cwd` and `suiteName` from the file path.

### `E2EConfig`

```typescript
{
  versions: { cli: ['current'] },  // Always use ['current'] for CLI tests
  env?: Record<string, string | undefined>,  // Env vars to pass to Docker
  defineTests: (ctx: DefineTestsContext) => void,
}
```

### `runCmd` (two overloads)

```typescript
// Simple: returns { exitCode, stdout, stderr }
const result: E2ETestResult = await runCmd('composio version');

// With file capture: returns { exitCode, stdout, stderr, files }
const result: E2ETestResultWithFiles<'out.txt'> = await runCmd({
  command: 'composio version > out.txt',
  files: ['out.txt'],
});
// Access: result.files['out.txt']
```

### `sanitizeOutput(output)`

Strips ANSI escape codes, normalizes `\r\n` to `\n`, trims whitespace. Use on stdout and file contents before assertions.

### `TIMEOUTS`

```typescript
TIMEOUTS.DEFAULT   // 5_000ms   — individual test timeout
TIMEOUTS.FIXTURE   // 120_000ms — beforeAll timeout (Docker startup + command execution)
TIMEOUTS.LLM_SHORT // 30_000ms  — commands involving LLM calls
TIMEOUTS.LLM_LONG  // 60_000ms  — commands involving longer LLM calls
```

Use `TIMEOUTS.FIXTURE` for the `beforeAll` that runs Docker commands. Use `TIMEOUTS.DEFAULT` for individual `it()` blocks (the default).

## Reference Files

| File | Purpose |
|---|---|
| `ts/e2e-tests/cli/version/e2e.test.ts` | Pattern A reference |
| `ts/e2e-tests/cli/whoami/e2e.test.ts` | Pattern B reference |
| `ts/e2e-tests/_utils/src/types.ts` | `E2EConfig`, `E2ETestResult`, `DefineTestsContext` types |
| `ts/e2e-tests/_utils/src/e2e.ts` | `e2e()` entry point |
| `ts/e2e-tests/_utils/src/const.ts` | `TIMEOUTS`, `WELL_KNOWN_ENV_VARS` |
| `ts/e2e-tests/_utils/src/sanitize.ts` | `sanitizeOutput()` |
| `ts/e2e-tests/_utils/Dockerfile.cli` | Docker image definition |
| `ts/e2e-tests/cli/README.md` | Test suites table |
| `CLI.md` | Planned CLI commands |
| `ts/packages/cli/CLAUDE.md` | CLI architecture and output conventions |
