# E2E Test Utilities

Shared infrastructure for running `@composio/core` end-to-end tests in isolated Docker environments.

## What's Here

| File/Directory    | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `src/`            | TypeScript utilities (e2e runner, config, types)     |
| `Dockerfile.node` | Multi-stage Dockerfile for Node.js test environments |

## API

### `e2e`

The main entry point for e2e tests. Automatically infers the working directory and suite name from the caller's location:

```typescript
import { e2e } from '@e2e-tests/utils';

await e2e(import.meta.url, {
  nodeVersions: ['20.18.0', '20.19.0', '22.12.0'], // optional
  setup: 'npm install',                            // optional setup command
  fixture: 'fixtures/test.mjs',                    // required fixture file
  env: { MY_VAR: 'value' },                        // optional env vars
  onSetup: (result) => { /* validate setup */ },   // optional
  onTest: (result) => {                            // optional
    if (result.exitCode !== 0) {
      throw new Error(`Test failed with exit code ${result.exitCode}`);
    }
  },
});
```

### Node Version Resolution

Node.js versions to test are resolved in this order:

1. **`COMPOSIO_E2E_NODE_VERSION` env var** (highest priority): Use `[env_value]`
2. **`config.nodeVersions`**: Use the provided array
3. **Default**: Use `[process.versions.node]` (current runtime)

### DEBUG.log

Each test run generates a `DEBUG.log` file in the test directory containing:
- Test start timestamp
- Node.js versions tested
- stdout/stderr for each phase (setup and test)
- Exit codes
- Summary with pass/fail status

## Behavior

Builds an isolated Docker container and runs the test command inside it. Docker is required.
