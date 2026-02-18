import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { ComposioToolkitsRepository } from 'src/services/composio-clients';
import { ComposioUserContext } from 'src/services/user-context';
import { TerminalUI } from 'src/services/terminal-ui';
import { formatToolkitsTable, formatToolkitsJson } from '../format';

const query = Options.text('query').pipe(
  Options.withDescription('Text search by name, slug, or description'),
  Options.optional
);

const category = Options.text('category').pipe(
  Options.withDescription('Filter by category ID'),
  Options.optional
);

const limit = Options.integer('limit').pipe(
  Options.withDefault(30),
  Options.withDescription('Number of results per page (1-1000)')
);

/**
 * List available toolkits with optional filters.
 *
 * @example
 * ```bash
 * composio toolkits list
 * composio toolkits list --query "email"
 * composio toolkits list --category "messaging" --limit 10
 * ```
 */
export const toolkitsCmd$List = Command.make(
  'list',
  { query, category, limit },
  ({ query, category, limit }) =>
    Effect.gen(function* () {
      const ui = yield* TerminalUI;
      const ctx = yield* ComposioUserContext;
      const repo = yield* ComposioToolkitsRepository;

      // Auth guard
      if (Option.isNone(ctx.data.apiKey)) {
        yield* ui.log.warn('You are not logged in yet. Please run `composio login`.');
        return;
      }

      const clampedLimit = Math.max(1, Math.min(1000, limit));

      const result = yield* ui.withSpinner(
        'Fetching toolkits...',
        repo.searchToolkits({
          search: Option.getOrUndefined(query),
          category: Option.getOrUndefined(category),
          limit: clampedLimit,
        })
      );

      if (result.items.length === 0) {
        yield* ui.log.warn('No toolkits found. Try broadening your search.');
        return;
      }

      const showing = result.items.length;
      const total = result.total_items;

      yield* ui.log.info(`Listing ${showing} of ${total} toolkits`);
      yield* ui.log.message('');
      yield* ui.log.message(formatToolkitsTable(result.items));

      // Next step hint
      const firstSlug = result.items[0]?.slug;
      if (firstSlug) {
        yield* ui.log.message('');
        yield* ui.log.step(
          `To view details of a toolkit:\n> composio toolkits info "${firstSlug}"`
        );
      }

      yield* ui.output(formatToolkitsJson(result.items));
    })
).pipe(Command.withDescription('List available toolkits.'));
