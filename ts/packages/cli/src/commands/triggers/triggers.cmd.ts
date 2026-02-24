import { Command } from '@effect/cli';
import { triggersCmd$Info } from './commands/triggers.info.cmd';
import { triggersCmd$List } from './commands/triggers.list.cmd';
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
  Command.withDescription('List trigger types and subscribe to realtime trigger events.'),
  Command.withSubcommands([triggersCmd$List, triggersCmd$Info, triggersCmd$Listen])
);
