import process from 'node:process';
import type { Writable } from 'node:stream';
import * as p from '@clack/prompts';
import { Context, Effect, Exit, Layer } from 'effect';

// ---------------------------------------------------------------------------
// SpinnerHandle — returned by `makeSpinner` for manual control
// ---------------------------------------------------------------------------

export interface SpinnerHandle {
  /** Update the spinner message while it's running. */
  readonly message: (msg: string) => Effect.Effect<void>;
  /** Stop the spinner with a success message. */
  readonly stop: (msg?: string) => Effect.Effect<void>;
  /** Stop the spinner with an error message. */
  readonly error: (msg?: string) => Effect.Effect<void>;
}

// ---------------------------------------------------------------------------
// TerminalUI — Effect service for structured terminal output
// ---------------------------------------------------------------------------

export interface TerminalUI {
  /**
   * Write raw data to stdout for piping and scripting.
   * This is the ONLY method that writes to stdout — everything else goes to stderr.
   * Use this for values that scripts should capture (API keys, version strings, etc.).
   */
  readonly output: (data: string) => Effect.Effect<void>;

  /** Display a session start marker (e.g., `┌  title`). Writes to stderr. */
  readonly intro: (title: string) => Effect.Effect<void>;
  /** Display a session end marker (e.g., `└  message`). Writes to stderr. */
  readonly outro: (message: string) => Effect.Effect<void>;

  /** Structured log output with severity-specific symbols. */
  readonly log: {
    /** Blue info marker. */
    readonly info: (message: string) => Effect.Effect<void>;
    /** Green success marker. */
    readonly success: (message: string) => Effect.Effect<void>;
    /** Yellow warning marker. */
    readonly warn: (message: string) => Effect.Effect<void>;
    /** Red error marker. */
    readonly error: (message: string) => Effect.Effect<void>;
    /** Green step marker (for completed steps). */
    readonly step: (message: string) => Effect.Effect<void>;
    /** Generic log message with bar guide. */
    readonly message: (message: string) => Effect.Effect<void>;
  };

  /** Display a boxed note with optional title. */
  readonly note: (message: string, title?: string) => Effect.Effect<void>;

  /**
   * Wrap an Effect computation in a spinner.
   * The spinner starts before the effect runs and stops/errors on completion.
   */
  readonly withSpinner: <A, E, R>(
    message: string,
    effect: Effect.Effect<A, E, R>,
    options?: {
      readonly successMessage?: string | ((result: A) => string);
      readonly errorMessage?: string;
    }
  ) => Effect.Effect<A, E, R>;

  /**
   * Create a controllable spinner for multi-step flows (e.g., login polling).
   * The caller is responsible for calling `stop()` or `error()`.
   *
   * WARNING: If the surrounding Effect fails, this spinner will NOT be cleaned up.
   * Use `useMakeSpinner` instead for automatic cleanup on error.
   */
  readonly makeSpinner: (message: string) => Effect.Effect<SpinnerHandle>;

  /**
   * Create a controllable spinner that is automatically stopped on error or interruption.
   * The `use` function receives a SpinnerHandle and must return an Effect.
   * On success: the caller should call `spinner.stop(...)` inside `use`.
   * On failure: the spinner is automatically stopped with an error message.
   * On interruption: the spinner is automatically cancelled.
   */
  readonly useMakeSpinner: <A, E, R>(
    message: string,
    use: (spinner: SpinnerHandle) => Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
}

export const TerminalUI = Context.GenericTag<TerminalUI>('services/TerminalUI');

// ---------------------------------------------------------------------------
// TerminalUILive — production layer using @clack/prompts
// ---------------------------------------------------------------------------

/**
 * All decoration (spinners, logs, notes, intro/outro) writes to stderr.
 * This keeps stdout clean for data output that scripts and pipes capture.
 */
const DECORATION: Writable = process.stderr;

function createClackSpinnerHandle(s: p.SpinnerResult, defaultMessage: string): SpinnerHandle {
  return {
    message: (msg: string) => Effect.sync(() => s.message(msg)),
    stop: (msg?: string) => Effect.sync(() => s.stop(msg ?? defaultMessage)),
    error: (msg?: string) => Effect.sync(() => s.error(msg ?? defaultMessage)),
  };
}

const makeLive: TerminalUI = {
  output: data =>
    Effect.sync(() => {
      process.stdout.write(`${data}\n`);
    }),

  intro: title => Effect.sync(() => p.intro(title, { output: DECORATION })),
  outro: message => Effect.sync(() => p.outro(message, { output: DECORATION })),

  log: {
    info: message => Effect.sync(() => p.log.info(message, { output: DECORATION })),
    success: message => Effect.sync(() => p.log.success(message, { output: DECORATION })),
    warn: message => Effect.sync(() => p.log.warn(message, { output: DECORATION })),
    error: message => Effect.sync(() => p.log.error(message, { output: DECORATION })),
    step: message => Effect.sync(() => p.log.step(message, { output: DECORATION })),
    message: message => Effect.sync(() => p.log.message(message, { output: DECORATION })),
  },

  note: (message, title) => Effect.sync(() => p.note(message, title ?? '', { output: DECORATION })),

  withSpinner: (message, effect, options) =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const s = p.spinner({ output: DECORATION });
        s.start(message);
        return s;
      }),
      () => effect,
      (s, exit) =>
        Effect.sync(() => {
          if (Exit.isSuccess(exit)) {
            const successMsg =
              typeof options?.successMessage === 'function'
                ? options.successMessage(exit.value)
                : (options?.successMessage ?? message);
            s.stop(successMsg);
          } else {
            s.error(options?.errorMessage ?? message);
          }
        })
    ),

  makeSpinner: message =>
    Effect.sync(() => {
      const s = p.spinner({ output: DECORATION });
      s.start(message);
      return createClackSpinnerHandle(s, message);
    }),

  useMakeSpinner: (message, use) =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const s = p.spinner({ output: DECORATION });
        s.start(message);
        return { raw: s, handle: createClackSpinnerHandle(s, message) };
      }),
      ({ handle }) => use(handle),
      ({ raw }, exit) =>
        Effect.sync(() => {
          // Only clean up if the spinner is still active (user didn't call stop/error)
          // Clack spinners have an internal `isCancelled` state after stop/error/cancel
          if (Exit.isFailure(exit) && !raw.isCancelled) {
            raw.error(message);
          }
        })
    ),
};

export const TerminalUILive = Layer.succeed(TerminalUI, makeLive);
