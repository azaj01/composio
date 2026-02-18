# AGENTS.md

Instructions for AI agents working on `@composio/cli`.

## Architecture Overview

The CLI is built on the **Effect.ts ecosystem** and runs on **Bun**. It follows a service-oriented architecture with dependency injection via Effect layers, generator-based control flow (`Effect.gen`), and structured error handling.

### Entry Point

`src/bin.ts` bootstraps the CLI by composing Effect layers and running the root command via `BunRuntime.runMain()`:

- `CliConfigLive` — @effect/cli behavior (case-sensitive, no auto-correct, no built-ins)
- `ComposioUserContextLive` — User authentication state from `~/.composio/`
- `ComposioSessionRepositoryLive` — OAuth2 session management
- `ComposioToolkitsRepositoryCachedLive` — Cached API client for toolkits/tools
- `UpgradeBinaryLive` — Self-update from GitHub releases
- `BunFileSystem.layer`, `BunContext.layer` — Bun runtime integration

Errors are captured via the custom `effect-errors/` module, which provides source-mapped stack traces, Effect span timelines, and formatted output.

### Commands (`src/commands/`)

Each command is declared with `@effect/cli`'s `Command.make()` pattern:

| Command | Description |
|---|---|
| `composio version` | Display CLI version |
| `composio whoami` | Show logged-in user's API key |
| `composio login [--no-browser]` | OAuth2 login with browser redirect |
| `composio logout` | Clear stored API key |
| `composio upgrade` | Self-update binary from GitHub releases |
| `composio generate` | Auto-detect project language, delegate to `ts` or `py` |
| `composio ts generate` | Generate TypeScript type stubs for toolkits/tools/triggers |
| `composio py generate` | Generate Python type stubs |

Options use `Options.text()`, `Options.boolean()`, `Options.choice()`, `Options.directory()` with Effect Schema validation.

### Services (`src/services/`)

| Service | Purpose |
|---|---|
| `ComposioUserContext` | Auth state — reads/writes `~/.composio/user-config.json`, merges env vars |
| `ComposioSessionRepository` | Creates OAuth2 sessions, polls until `linked` state |
| `ComposioToolkitsRepository` | API client — fetches toolkits, tools, trigger types; validates versions |
| `ComposioToolkitsRepositoryCached` | Decorator over base repository with file-based caching and graceful fallback |
| `NodeOs` | OS abstraction (`homedir`, `platform`, `arch`) |
| `EnvLangDetector` | Detects project language (TS/Python) from config files and lock files |
| `JsPackageManagerDetector` | Detects npm/pnpm/yarn/bun for helpful install instructions |
| `UpgradeBinary` | Fetches latest release from GitHub, downloads and replaces binary |

### Effects (`src/effects/`)

Reusable Effect computations for cross-cutting concerns:

| Effect | Purpose |
|---|---|
| `app-config` | Reads `COMPOSIO_*` env vars (API_KEY, BASE_URL, CACHE_DIR, etc.) |
| `debug-config` | Debug overrides (DEBUG_OVERRIDE_VERSION, etc.) |
| `force-config` | Force flags (FORCE_USE_CACHE) |
| `setup-cache-dir` | Ensures `~/.composio/` directory exists |
| `toolkit-version-overrides` | Parses `COMPOSIO_TOOLKIT_VERSION_<NAME>=<ver>` env vars |
| `validate-toolkit-versions` | Validates overrides against available API versions |
| `with-log-level` | Configures logger from CLI flag or env var |
| `find-composio-core-generated` | Locates `@composio/core` in node_modules (handles pnpm virtual store) |
| `version` | Resolves CLI version from package.json |
| `compare-semver` | Semantic version comparison for upgrade checks |
| `log-metrics` | Formats and logs API request count and bytes transferred |

### Models (`src/models/`)

Effect Schema definitions for type-safe serialization:

- `Toolkit` — name, slug, auth_schemes, is_local_toolkit, meta
- `Tool` — name, slug, available_versions, input/output_parameters, description, tags
- `TriggerType` — slug, name, description, input/output parameters
- `UserData` — apiKey, baseURL, webURL (with defaults)
- `Session` — id, status (pending|linked), retrieved session with api_key

Each model has `fromJSON`/`toJSON` helpers using `JSONTransformSchema()`.

### Code Generation (`src/generation/`)

Multi-stage pipeline for `composio ts generate` and `composio py generate`:

1. **Fetch** — Toolkits, tools, trigger types from API (optionally filtered by `--toolkits`)
2. **Index** — Groups tools/triggers by toolkit prefix into a `ToolkitIndex` map
3. **Generate** — Builds TypeScript/Python source using `@composio/ts-builders` AST builders
4. **Transpile** — Optionally converts TS → ESM JS (when writing to @composio/core/generated)

Generated output includes toolkit objects, tool/trigger enums, and optionally full type definitions (with `--type-tools`).

### Error Handling (`src/effect-errors/`)

Custom error capture and formatting system:

- **Capture** — Extracts error chain from Effect's `Cause`, handles interrupts separately
- **Source maps** — Maps compiled `.mjs` stack traces back to TypeScript source
- **Spans** — Extracts timing from Effect spans for execution timeline display
- **Pretty print** — Colored, boxed error output with source context and suggestions

### UI & Output (`src/ui/`)

- `picocolors` and `ansis` for colored terminal output
- Respects `NO_COLOR` env var
- `@clack/prompts` symbols (`S_BAR`, `S_BAR_H`, `unicodeOr`) for box-drawing in formatted output
- Effect's `Console.log()` / `Console.error()` for output

### Configuration (`src/cli-config.ts`, `src/constants.ts`)

- CLI behavior: `showBuiltIns: false`, `autoCorrectLimit: 0`, `isCaseSensitive: true`
- Prefixes: `COMPOSIO_` for app config, `DEBUG_OVERRIDE_` for debug
- User config stored in `~/.composio/`
- Cache files: `toolkits.json`, `tools.json`, `tools-as-enums.json`, `trigger-types.json`

### Effect.ts Patterns

The CLI uses the generator-based syntax throughout:

```typescript
Effect.gen(function* () {
  const service = yield* ServiceName;     // resolve dependency
  const result = yield* someEffect;       // await computation
  yield* Effect.log('message');           // side effect
  return result;
})
```

Key patterns:
- `Effect.all([...], { concurrency: 'unbounded' })` for parallel fetches
- `Layer.provide()` for dependency composition
- `Effect.mapError()` / `Effect.catchTag()` for typed error handling
- `Effect.scoped` for resource cleanup

### Key Dependencies

| Package | Role |
|---|---|
| `effect` | Core runtime, data types, concurrency |
| `@effect/cli` | Command, Options, Args declaration and parsing |
| `@effect/platform` | FileSystem, Terminal abstraction |
| `@effect/platform-bun` | Bun runtime layer |
| `@clack/prompts` | Terminal UI symbols (expanding to full interactive prompts) |
| `ansis`, `picocolors` | Colored output |
| `@composio/client` | Raw Composio API client |
| `@composio/core` | Core SDK types and constants |
| `@composio/ts-builders` | TypeScript AST code generation |
| `semver` | Version comparison for upgrades |
| `open` | Opens URLs in browser (login flow) |
| `decompress` | Extracts downloaded binaries |

---

## Clack Reference Source

The CLI uses [`@clack/prompts`](https://github.com/bombshell-dev/clack) for interactive terminal UI (prompts, spinners, logs, etc.). A local copy of the Clack source code is available as a git submodule:

- **Location:** `ts/vendor/clack/`
- **Repo:** [bombshell-dev/clack](https://github.com/bombshell-dev/clack)

When working on CLI code that involves terminal UI, reference the Clack source for accurate APIs and patterns:

- `ts/vendor/clack/packages/prompts/src/` — `@clack/prompts` (the high-level API used by this CLI)
- `ts/vendor/clack/packages/core/src/` — `@clack/core` (low-level primitives underlying prompts)

### Key modules in `@clack/prompts`

| Module | Purpose |
|---|---|
| `text.ts` | Text input prompt |
| `password.ts` | Password input prompt |
| `confirm.ts` | Yes/no confirmation prompt |
| `select.ts` | Single-select list prompt |
| `multi-select.ts` | Multi-select list prompt |
| `group-multi-select.ts` | Grouped multi-select prompt |
| `autocomplete.ts` | Autocomplete/search prompt |
| `spinner.ts` | Loading spinner |
| `progress-bar.ts` | Progress bar |
| `log.ts` | Styled log messages |
| `note.ts` | Boxed note output |
| `task.ts` | Task runner with status |
| `task-log.ts` | Task with streaming log output |
| `stream.ts` | Streaming text output |
| `box.ts` | Box drawing utility |
| `messages.ts` | Intro/outro messages |
| `common.ts` | Shared symbols (`S_BAR`, `S_BAR_H`, `unicodeOr`, etc.) |

### Current clack usage in the CLI

The CLI currently imports from `@clack/prompts`:
- `S_BAR`, `S_BAR_H`, `unicodeOr` — Unicode box-drawing symbols for custom formatted output

### Guidelines

- The submodule is for **read-only reference only**. Do not modify files in `ts/vendor/clack/`.
- The CLI's actual dependency comes from npm (`@clack/prompts` v1.0.1) via `pnpm install`.
- When adding new interactive prompts or terminal UI, consult the source in `ts/vendor/clack/packages/prompts/src/` for the correct API surface and available options.
- Prefer `@clack/prompts` (high-level) over `@clack/core` (low-level) unless you need custom prompt behavior.

---

## Effect.ts Reference Source

The CLI is built on the Effect.ts ecosystem. A local copy of the Effect source code is available as a git submodule:

- **Location:** `ts/vendor/effect/`
- **Repo:** [Effect-TS/effect](https://github.com/Effect-TS/effect)
- **Branch:** `main`

When working on CLI code, reference the Effect source for accurate patterns:
- `ts/vendor/effect/packages/effect/src/` — core Effect runtime
- `ts/vendor/effect/packages/cli/src/` — @effect/cli (Command, Options, Args)
- `ts/vendor/effect/packages/platform/src/` — @effect/platform (FileSystem, Terminal)

### Guidelines

- The submodule is for **read-only reference only**. Do not modify files in `ts/vendor/effect/`.
- The CLI's actual dependencies come from npm via `pnpm install`.
