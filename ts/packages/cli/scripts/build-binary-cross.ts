#!/usr/bin/env bun

/**
 * Cross-compile a CLI binary for a specific Bun target.
 *
 * Usage: `bun scripts/build-binary-cross.ts --target <target>`
 *
 * Valid targets:
 *   bun-darwin-arm64  → composio-darwin-aarch64
 *   bun-darwin-x64    → composio-darwin-x64
 *   bun-linux-x64     → composio-linux-x64
 *   bun-linux-arm64   → composio-linux-aarch64
 *
 * Output: `dist/binaries/<artifact-name>`
 */

import process from 'node:process';
import {
  Cause,
  Config,
  ConfigProvider,
  Console,
  Effect,
  Exit,
  Stream,
  Logger,
  Layer,
  LogLevel,
} from 'effect';
import { Command } from '@effect/platform';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import type { Teardown } from '@effect/platform/Runtime';

/**
 * Maps Bun cross-compilation targets to Composio artifact names.
 */
const TARGET_MAP: Record<string, string> = {
  'bun-darwin-arm64': 'composio-darwin-aarch64',
  'bun-darwin-x64': 'composio-darwin-x64',
  'bun-linux-x64': 'composio-linux-x64',
  'bun-linux-arm64': 'composio-linux-aarch64',
};

const VALID_TARGETS = Object.keys(TARGET_MAP);

function parseTarget(): { target: string; artifact: string } {
  const targetIdx = process.argv.indexOf('--target');
  if (targetIdx === -1 || !process.argv[targetIdx + 1]) {
    process.stderr.write(`Usage: bun scripts/build-binary-cross.ts --target <target>\n`);
    process.stderr.write(`Valid targets: ${VALID_TARGETS.join(', ')}\n`);
    process.exit(1);
  }

  const target = process.argv[targetIdx + 1];
  const artifact = TARGET_MAP[target];
  if (!artifact) {
    process.stderr.write(`Invalid target: ${target}\n`);
    process.stderr.write(`Valid targets: ${VALID_TARGETS.join(', ')}\n`);
    process.exit(1);
  }

  return { target, artifact };
}

export function buildBinaryCross() {
  const { target, artifact } = parseTarget();

  return Effect.gen(function* () {
    const cwd = process.cwd();
    yield* Effect.logDebug(`Cross-compiling binary in ${cwd} for target ${target}`);

    const outfile = `./dist/binaries/${artifact}`;

    const args = [
      'bun',
      'build',
      './src/bin.ts',
      '--env',
      'DEBUG_OVERRIDE_*',
      '--compile',
      '--production',
      '--target',
      target,
      '--outfile',
      outfile,
    ] as const satisfies ReadonlyArray<string>;

    const cmd = Command.make(...args);

    yield* Effect.logDebug('Running build command with', args.join(' '), '');

    const { exitCode } = yield* cmd.pipe(
      Command.start,
      Effect.flatMap(process =>
        Effect.all(
          {
            exitCode: process.exitCode,
            output: Stream.merge(
              Stream.decodeText(process.stdout, 'utf-8'),
              Stream.decodeText(process.stderr, 'utf-8'),
              { haltStrategy: 'left' }
            ).pipe(
              Stream.tap(chunk => Console.log(chunk)),
              Stream.runDrain
            ),
          },
          {
            concurrency: 'unbounded',
          }
        )
      )
    );

    process.exitCode = exitCode;

    if (exitCode !== 0) {
      return yield* Effect.fail(new Error(`Failed to cross-compile binary for ${target}`));
    }

    yield* Console.log(`Binary cross-compiled: ${outfile}`);
  });
}

export const teardown: Teardown = <E, A>(exit: Exit.Exit<E, A>, onExit: (code: number) => void) => {
  const shouldFail = Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause);
  const errorCode = Number(process.exitCode ?? 1);
  onExit(shouldFail ? errorCode : 0);
};

const ConfigLive = Effect.gen(function* () {
  const logLevel = yield* Config.logLevel('COMPOSIO_LOG_LEVEL').pipe(
    Config.withDefault(LogLevel.Info)
  );

  return Logger.minimumLogLevel(logLevel);
}).pipe(Layer.unwrapEffect, Layer.merge(Layer.setConfigProvider(ConfigProvider.fromEnv())));

if (require.main === module) {
  buildBinaryCross().pipe(
    Effect.provide(ConfigLive),
    Effect.provide(Logger.pretty),
    Effect.provide(BunContext.layer),
    Effect.scoped,
    Effect.map(() => ({ message: 'Process completed successfully.' })),
    BunRuntime.runMain({
      teardown,
    })
  );
}
