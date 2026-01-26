# E2E Tests

End-to-end tests for `@composio/core` across different JavaScript runtimes.

## Directory Structure

```
ts/e2e-tests/
├── _utils/                                  # Shared test infrastructure
│   ├── Dockerfile.node                      # Docker image for Node.js tests
│   ├── src/                                 # TypeScript runner utilities
│   │   ├── e2e.ts                           # Main e2e test entry point
│   │   ├── runner.ts                        # Docker test runner
│   │   ├── image-lifecycle.ts               # Docker image build/run utilities
│   │   ├── config.ts                        # Configuration utilities
│   │   └── types.ts                         # TypeScript type definitions
│   └── README.md                            # Utils documentation
└── runtimes/
    ├── node/                                # Node.js runtime tests
    │   ├── cjs-basic/                       # CommonJS compatibility tests
    │   ├── esm-basic/                       # ESM compatibility tests
    │   ├── openai-zod4-compat/              # OpenAI + Zod v4 compatibility tests
    │   └── typescript-mjs-import-nodenext/  # TypeScript moduleResolution: nodenext tests
    └── cloudflare/                          # Cloudflare runtime tests
        ├── cf-workers-basic/                # Basic Cloudflare Workers tests
        ├── cf-workers-files/                # Cloudflare Workers file handling tests
        └── cf-workers-tool-router-ai/       # Cloudflare Workers AI SDK tool router tests
```

## Running Tests

### All E2E Tests

```bash
pnpm test:e2e
```

### Node.js Tests Only

```bash
pnpm test:e2e:node
```

Runs Node.js tests in Docker with the default Node.js version (20.19.0).

To run with a specific Node.js version:

```bash
COMPOSIO_E2E_NODE_VERSION=22.12.0 pnpm test:e2e:node
```

### Cloudflare Workers Tests Only

```bash
pnpm test:e2e:cloudflare
```

## Adding New Tests

### Node.js Runtime Tests

1. Create a new directory under `runtimes/node/` (e.g., `runtimes/node/my-test`)
2. Add a `package.json` with name `@e2e-tests/node-my-test`
3. Add `test:e2e` and `test:e2e:node` scripts
4. Create an `e2e.ts` file with inline configuration:

```typescript
import { e2e } from '@e2e-tests/utils';

await e2e(import.meta.url, {
  fixture: 'fixtures/test.mjs',
  nodeVersions: ['20.18.0', '22.12.0'],  // Optional: defaults to current runtime
  setup: 'npm install',                   // Optional: setup command
  env: { MY_VAR: process.env.MY_VAR },   // Optional: env vars
  onTest: (result) => {
    if (result.exitCode !== 0) {
      throw new Error(`Test failed with exit code ${result.exitCode}`);
    }
    // Add assertions for expected output
  },
});
```

5. Add fixture files in a `fixtures/` directory

### Cloudflare Runtime Tests

1. Create a new directory under `runtimes/cloudflare/` (e.g., `runtimes/cloudflare/my-test`)
2. Add a `package.json` with name `@e2e-tests/cf-my-test`
3. Add `test:e2e` and `test:e2e:cloudflare` scripts
4. Configure vitest with `@cloudflare/vitest-pool-workers`
