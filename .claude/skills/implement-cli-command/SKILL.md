# Implement CLI Command

Implement new commands and subcommands in `ts/packages/cli/`. Covers file creation, Effect patterns, service wiring, option declaration, output conventions, and registration.

## When to Use

- Implementing a new CLI command from a spec or design
- Adding a subcommand to an existing command group
- Wiring a new command into the command tree
- Understanding how existing commands work to extend them

For CLI **design** (arguments, flags, help text, UX), see the `create-cli` skill instead.
For CLI **e2e tests**, see the `create-cli-e2e` skill instead.

## Architecture

The CLI uses `@effect/cli` for command declaration, `effect` for the runtime, and a service-oriented architecture with dependency injection via Effect layers.

```
src/
├── bin.ts                    # Entry point — layer composition, error handling, runtime
├── commands/
│   ├── index.ts              # Command tree — registers all commands
│   ├── $default.cmd.ts       # Root command with global options (--log-level)
│   ├── version.cmd.ts        # Simple data command
│   ├── whoami.cmd.ts         # Data command with service dependency
│   ├── login.cmd.ts          # Complex command (options, spinner, polling)
│   ├── logout.cmd.ts         # Action command (no stdout data)
│   ├── upgrade.cmd.ts        # Action command (delegates to service)
│   ├── generate.cmd.ts       # Command that auto-delegates to subcommands
│   ├── ts/
│   │   ├── ts.cmd.ts         # Parent command group
│   │   └── commands/
│   │       └── ts.generate.cmd.ts  # Subcommand with complex logic
│   └── py/
│       ├── py.cmd.ts
│       └── commands/
│           └── py.generate.cmd.ts
├── services/                 # Effect services (dependency injection)
├── effects/                  # Reusable Effect computations
├── models/                   # Effect Schema definitions
├── generation/               # Code generation pipeline
├── effect-errors/            # Error capture and formatting
└── ui/                       # Terminal output helpers
```

### File Naming Convention

- Command files: `<name>.cmd.ts` (e.g., `version.cmd.ts`, `login.cmd.ts`)
- Subcommand files: `<parent>.<name>.cmd.ts` inside `commands/` (e.g., `ts.generate.cmd.ts`)
- Parent command groups: `<name>.cmd.ts` at the group level (e.g., `ts/ts.cmd.ts`)

## Creating a New Command

### Step 1: Create the Command File

Create `src/commands/<name>.cmd.ts`.

**Minimal template** (data command, no options):

```typescript
import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { TerminalUI } from 'src/services/terminal-ui';

export const myCmd = Command.make('my-command', {}).pipe(
  Command.withDescription('Brief description of what the command does.'),
  Command.withHandler(() =>
    Effect.gen(function* () {
      const ui = yield* TerminalUI;

      // Compute result...
      const result = 'some-value';

      yield* ui.log.info(result);   // Decoration → stderr
      yield* ui.output(result);     // Data → stdout (for scripts)
    })
  )
);
```

**Template with options:**

```typescript
import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { TerminalUI } from 'src/services/terminal-ui';
import { ComposioToolkitsRepository } from 'src/services/composio-clients';

// Define options at module level
const toolkitSlug = Options.text('toolkit').pipe(
  Options.withDescription('Toolkit slug to look up.')
);

const searchOpt = Options.optional(
  Options.text('search')
).pipe(
  Options.withDescription('Search query to filter results.')
);

export const myCmd = Command.make('my-command', { toolkitSlug, searchOpt }).pipe(
  Command.withDescription('Brief description.'),
  Command.withHandler(({ toolkitSlug, searchOpt }) =>
    Effect.gen(function* () {
      const ui = yield* TerminalUI;
      const client = yield* ComposioToolkitsRepository;

      yield* ui.intro('composio my-command');

      // Use options — searchOpt is Option<string>
      const search = Option.getOrUndefined(searchOpt);

      // Fetch data with spinner
      const result = yield* ui.withSpinner(
        'Fetching data...',
        client.getToolkits(),
        { successMessage: 'Done', errorMessage: 'Failed to fetch' }
      );

      // Output
      yield* ui.note(formatResult(result), 'Result');
      yield* ui.output(formatResult(result));
      yield* ui.outro('Done');
    })
  )
);
```

### Step 2: Register the Command

Add the command to `src/commands/index.ts`:

```typescript
import { myCmd } from './my-command.cmd';

const $cmd = $defaultCmd.pipe(
  Command.withSubcommands([
    versionCmd,
    upgradeCmd,
    whoamiCmd,
    loginCmd,
    logoutCmd,
    generateCmd,
    pyCmd,
    tsCmd,
    myCmd,  // Add here
  ])
);
```

### Step 3: Add Required Service Layers (if any)

If your command uses a new service not already in `bin.ts`, add its layer:

```typescript
// In src/bin.ts
const layers = Layer.mergeAll(
  // ... existing layers
  MyNewServiceLive,  // Add if needed
);
```

Most commands only use services already provided: `TerminalUI`, `ComposioUserContext`, `ComposioToolkitsRepository`, `ComposioSessionRepository`, `UpgradeBinary`, `FileSystem`, `NodeProcess`, `NodeOs`.

## Creating a Subcommand Group

For commands like `composio toolkits list`, `composio toolkits info`:

### Step 1: Create the Directory Structure

```
src/commands/toolkits/
├── toolkits.cmd.ts              # Parent command group
└── commands/
    ├── toolkits.list.cmd.ts     # composio toolkits list
    └── toolkits.info.cmd.ts     # composio toolkits info
```

### Step 2: Create the Parent Command

`src/commands/toolkits/toolkits.cmd.ts`:

```typescript
import { Command } from '@effect/cli';
import { toolkitsCmd$List } from './commands/toolkits.list.cmd';
import { toolkitsCmd$Info } from './commands/toolkits.info.cmd';

export const toolkitsCmd = Command.make('toolkits').pipe(
  Command.withDescription('Discover and inspect available toolkits.'),
  Command.withSubcommands([toolkitsCmd$List, toolkitsCmd$Info])
);
```

### Step 3: Create Each Subcommand

`src/commands/toolkits/commands/toolkits.list.cmd.ts`:

```typescript
import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { TerminalUI } from 'src/services/terminal-ui';
import { ComposioToolkitsRepository } from 'src/services/composio-clients';

const searchOpt = Options.optional(
  Options.text('search')
).pipe(
  Options.withDescription('Search toolkits by name or description.')
);

export const toolkitsCmd$List = Command.make('list', { searchOpt }).pipe(
  Command.withDescription('List available toolkits.'),
  Command.withHandler(({ searchOpt }) =>
    Effect.gen(function* () {
      const ui = yield* TerminalUI;
      const client = yield* ComposioToolkitsRepository;

      const toolkits = yield* ui.withSpinner(
        'Fetching toolkits...',
        client.getToolkits(),
        { successMessage: 'Toolkits loaded' }
      );

      // Format and output
      const output = toolkits
        .map(t => `${t.slug} - ${t.meta.description}`)
        .join('\n');

      yield* ui.log.info(output);
      yield* ui.output(output);
    })
  )
);
```

### Step 4: Register the Parent in index.ts

```typescript
import { toolkitsCmd } from './toolkits/toolkits.cmd';

const $cmd = $defaultCmd.pipe(
  Command.withSubcommands([
    // ... existing commands
    toolkitsCmd,
  ])
);
```

## Option Declaration Patterns

Options are declared at module level using `@effect/cli`'s `Options` API.

### Common Option Types

```typescript
import { Options } from '@effect/cli';

// Boolean flag (with default)
const verbose = Options.boolean('verbose').pipe(
  Options.withDefault(false),
  Options.withDescription('Enable verbose output.')
);

// Required text
const name = Options.text('name').pipe(
  Options.withDescription('Name of the resource.')
);

// Optional text — yields Option<string> in handler
const search = Options.optional(
  Options.text('search')
).pipe(
  Options.withDescription('Search query.')
);

// Text with alias
const output = Options.optional(
  Options.text('output')
).pipe(
  Options.withAlias('o'),
  Options.withDescription('Output path.')
);

// Repeated text — yields Array<string>
const toolkits = Options.text('toolkits').pipe(
  Options.repeated,
  Options.withDescription('One or more toolkit slugs.')
);

// Choice from fixed set
const format = Options.choice('format', ['json', 'table', 'plain']).pipe(
  Options.withDefault('table'),
  Options.withDescription('Output format.')
);

// Directory path (with existence check)
const dir = Options.optional(
  Options.directory('output-dir', { exists: 'either' })
).pipe(
  Options.withAlias('o'),
  Options.withDescription('Output directory.')
);

// Schema-validated option
import { Schema } from 'effect';

const limit = Options.integer('limit').pipe(
  Options.withSchema(Schema.Int.pipe(Schema.positive())),
  Options.withDefault(10),
  Options.withDescription('Max results.')
);
```

### Using Options in Handler

```typescript
Command.make('my-cmd', { search, verbose, toolkits }, ({ search, verbose, toolkits }) =>
  Effect.gen(function* () {
    // search: Option<string> — use Option.getOrUndefined, Option.match, Option.isSome
    const searchValue = Option.getOrUndefined(search);

    // verbose: boolean — direct use
    if (verbose) { yield* Effect.logDebug('Verbose mode'); }

    // toolkits: Array<string> — may be empty
    if (Array.isNonEmptyArray(toolkits)) {
      // filter by toolkits
    }
  })
)
```

## Output Conventions

Every command must follow the composable CLI output contract:

### Data Commands

Commands that produce a value scripts should capture:

```typescript
yield* ui.note(apiKey, 'API Key');   // Decoration → stderr (pretty box)
yield* ui.output(apiKey);            // Data → stdout (scripts capture)
```

### Action Commands

Commands that perform a side effect but produce no data:

```typescript
yield* ui.log.success('Logged out successfully.');
// NO ui.output() call — nothing for scripts to capture
```

### Rule: Never Mix

- Never write data to stderr (decoration methods only)
- Never write decoration to stdout (ui.output only)
- `ui.output()` is a no-op in interactive mode (TTY) and writes to stdout when piped

## Available Services

Resolve services in handlers with `yield* ServiceName`.

| Service | Import | Purpose |
|---|---|---|
| `TerminalUI` | `src/services/terminal-ui` | Output: `output()`, `log.*`, `note()`, `intro()`, `outro()`, spinners |
| `ComposioUserContext` | `src/services/user-context` | Auth state: `data.apiKey`, `isLoggedIn()`, `logout` |
| `ComposioToolkitsRepository` | `src/services/composio-clients` | API: `getToolkits()`, `getTools()`, `getTriggerTypes()`, `validateToolkits()` |
| `ComposioSessionRepository` | `src/services/composio-clients` | OAuth: `createSession()`, `getSession()` |
| `UpgradeBinary` | `src/services/upgrade-binary` | Self-update: `upgrade()` |
| `FileSystem.FileSystem` | `@effect/platform` | File I/O: `readFileString()`, `writeFileString()`, `exists()` |
| `NodeProcess` | `src/services/node-process` | Process info: `cwd`, `env` |
| `NodeOs` | `src/services/node-os` | OS info: `homedir()`, `platform()`, `arch()` |
| `EnvLangDetector` | `src/services/env-lang-detector` | Detect project language (TS/Python) |
| `JsPackageManagerDetector` | `src/services/js-package-manager-detector` | Detect npm/pnpm/yarn/bun |

## Available Effects

Reusable computations from `src/effects/`:

| Effect | Import | Purpose |
|---|---|---|
| `getVersion` | `src/effects/version` | CLI version from package.json |
| `logMetrics` | `src/effects/log-metrics` | Log API request count and bytes |
| `setupCacheDir` | `src/effects/setup-cache-dir` | Ensure `~/.composio/` exists |
| `getToolkitVersionOverrides` | `src/effects/toolkit-version-overrides` | Parse `COMPOSIO_TOOLKIT_VERSION_*` env vars |
| `jsFindComposioCoreGenerated` | `src/effects/find-composio-core-generated` | Locate `@composio/core` in node_modules |
| `compareSemver` | `src/effects/compare-semver` | Semantic version comparison |

## TerminalUI API

### Output

```typescript
yield* ui.output(data);  // Machine-readable data → stdout when piped, no-op when interactive
```

### Decoration (all → stderr when interactive, suppressed when piped)

```typescript
yield* ui.intro('composio my-command');          // Opening banner
yield* ui.outro('Done');                          // Closing banner
yield* ui.note(content, 'Title');                 // Boxed note
yield* ui.log.info('message');                    // Blue info
yield* ui.log.success('message');                 // Green success
yield* ui.log.warn('message');                    // Yellow warning
yield* ui.log.error('message');                   // Red error
yield* ui.log.step('message');                    // Green checkmark step
yield* ui.log.message('message');                 // With vertical bar
```

### Spinners

```typescript
// Automatic: wraps an Effect, auto-stops on success/error
const result = yield* ui.withSpinner(
  'Loading...',
  someEffect,
  { successMessage: 'Done!', errorMessage: 'Failed!' }
);

// Manual: full control over message updates
const result = yield* ui.useMakeSpinner('Loading...', spinner =>
  Effect.gen(function* () {
    yield* spinner.message('Step 1...');
    const data = yield* fetchStep1;
    yield* spinner.message('Step 2...');
    const result = yield* fetchStep2(data);
    yield* spinner.stop('All done!');
    return result;
  })
);
```

## Error Handling Patterns

### Optional Values

```typescript
yield* ctx.data.apiKey.pipe(
  Option.match({
    onNone: () => ui.log.warn('Not logged in. Run `composio login`.'),
    onSome: apiKey => ui.output(apiKey),
  })
);
```

### Typed Errors with catchTag

```typescript
yield* client.getToolkitsBySlugs(slugs).pipe(
  Effect.catchTag('services/InvalidToolkitsError', error =>
    Effect.gen(function* () {
      yield* ui.log.error(`Invalid toolkits: ${error.invalidToolkits.join(', ')}`);
      return yield* Effect.fail(error);
    })
  )
);
```

### Error Transformation

```typescript
yield* fs.writeFileString(path, content).pipe(
  Effect.mapError(err => new Error(`Failed to write ${path}: ${err}`))
);
```

### Logging Non-Fatal Errors

```typescript
yield* riskyOperation.pipe(
  Effect.catchAll(error =>
    Effect.logWarning(`Non-critical failure: ${error.message}`)
  )
);
```

## Parallel Data Fetching

Use `Effect.all` with `concurrency` for parallel API calls:

```typescript
const [toolkits, tools, triggerTypes] = yield* Effect.all(
  [
    client.getToolkits(),
    client.getTools(slugs),
    client.getTriggerTypes(slugs),
  ],
  { concurrency: 'unbounded' }
);
```

## Extracting Reusable Logic

For commands that share logic (e.g., `composio generate` delegates to `composio ts generate`):

```typescript
// In ts.generate.cmd.ts — export the logic separately
export function generateTypescriptTypeStubs(params: { ... }) {
  return Effect.gen(function* () {
    const ui = yield* TerminalUI;
    // ... implementation
  });
}

// The command uses it
export const tsCmd$Generate = Command.make('generate', { ... }).pipe(
  Command.withHandler(params => generateTypescriptTypeStubs(params))
);

// Other commands can reuse it
// In generate.cmd.ts
import { generateTypescriptTypeStubs } from './ts/commands/ts.generate.cmd';

yield* Match.value(envLang).pipe(
  Match.when('TypeScript', () => generateTypescriptTypeStubs({ ... })),
  Match.when('Python', () => generatePythonTypeStubs({ ... })),
  Match.exhaustive
);
```

## Retry with Exponential Backoff

For polling operations (e.g., waiting for OAuth):

```typescript
import { Schedule } from 'effect';

const result = yield* ui.useMakeSpinner('Waiting...', spinner =>
  Effect.retry(
    Effect.gen(function* () {
      const status = yield* client.getSession(session);
      if (status.status === 'linked') return status;
      return yield* Effect.fail(new Error('Still pending'));
    }),
    Schedule.exponential('0.3 seconds').pipe(
      Schedule.intersect(Schedule.recurs(15)),
      Schedule.intersect(Schedule.spaced('5 seconds'))
    )
  ).pipe(
    Effect.tap(() => spinner.stop('Success!')),
    Effect.tapError(() => spinner.error('Timed out'))
  )
);
```

## Checklist

When implementing a new command:

1. Create `src/commands/<name>.cmd.ts` (or `src/commands/<group>/commands/<group>.<name>.cmd.ts` for subcommands)
2. Define options at module level using `Options.*`
3. Create the command with `Command.make(name, options).pipe(Command.withDescription(...), Command.withHandler(...))`
4. In the handler, resolve services with `yield* ServiceName`
5. Follow the output convention: `ui.output()` for data, `ui.log.*` for decoration
6. Register in `src/commands/index.ts` (or in the parent group's command file)
7. If using a new service, add its layer to `src/bin.ts`
8. Build to verify: `cd ts/packages/cli && pnpm build`

## Reference Files

| File | Purpose |
|---|---|
| `src/commands/version.cmd.ts` | Simplest command (no options, no services beyond TerminalUI) |
| `src/commands/whoami.cmd.ts` | Data command with service dependency |
| `src/commands/login.cmd.ts` | Complex command (options, spinner, polling, retry) |
| `src/commands/logout.cmd.ts` | Action command (no stdout data) |
| `src/commands/upgrade.cmd.ts` | Action command delegating to service |
| `src/commands/generate.cmd.ts` | Auto-detection and delegation to subcommands |
| `src/commands/ts/commands/ts.generate.cmd.ts` | Full subcommand with parallel fetching, spinner, file I/O |
| `src/commands/index.ts` | Command tree registration |
| `src/bin.ts` | Entry point, layer composition, error handling |
| `src/services/terminal-ui.ts` | TerminalUI service interface |
| `src/services/composio-clients.ts` | API client service (HTTP, pagination, metrics) |
| `ts/packages/cli/CLAUDE.md` | CLI architecture and output conventions |
