# TypeScript .mjs Import Resolution Test

Verifies that `composio ts generate` produces TypeScript files that compile correctly with `moduleResolution: "nodenext"`.

## Background

When `composio ts generate --output-dir ./types` runs without `--transpiled`:

- Only `.ts` files are generated
- These files contain `import ... from "./foo.mjs"` statements
- With `moduleResolution: "node16"` or `"nodenext"`, TypeScript resolves:
  - `.js` imports → `.ts` files ✅
  - `.mjs` imports → `.mts` files only (not `.ts`) ❌

This causes `TS2307: Cannot find module './foo.mjs'` errors.

## What It Tests

| Test                   | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| composio ts generate   | Runs CLI to generate TypeScript files for entelligence toolkit |
| File existence         | Verifies generated .ts files exist                             |
| TypeScript compilation | Runs `tsc --noEmit` to check import resolution                 |

## Isolation Tool

**Docker** with Node.js versions: 20.19.0, 22.12.0

This ensures tests run against exact Node.js versions independent of the developer's local setup.

## Running

```bash
pnpm test:e2e
```

Debug output is written to `DEBUG.log`.

## Expected Behavior

- **If bug exists (importExtension: 'mjs')**: TypeScript compilation fails with TS2307
- **If fixed (importExtension: 'js')**: All tests pass
