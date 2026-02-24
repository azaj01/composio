import { Command } from '@effect/cli';
import { triggersCmd$Listen } from './commands/triggers.listen.cmd';

/**
 * CLI entry point for realtime trigger commands.
 *
 * @example
 * ```bash
 * composio triggers <command>
 * ```
 */
export const triggersCmd = Command.make('triggers').pipe(
  Command.withDescription('Subscribe to realtime trigger events.'),
  Command.withSubcommands([triggersCmd$Listen])
);
