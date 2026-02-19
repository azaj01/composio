import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { ComposioToolkitsRepository } from 'src/services/composio-clients';
import { ComposioUserContext } from 'src/services/user-context';
import { TerminalUI } from 'src/services/terminal-ui';
import { formatToolsTable, formatToolsJson } from '../format';

const query = Options.text('query').pipe(
  Options.withDescription('Text search by name, slug, or description'),
  Options.optional
);

const toolkits = Options.text('toolkits').pipe(
  Options.withDescription(
    'Filter by toolkit slugs, comma-separated (e.g. "gmail" or "gmail,slack")'
  ),
  Options.optional
);

const tags = Options.text('tags').pipe(
  Options.withDescription('Filter by tags (e.g. "important")'),
  Options.optional
);

const limit = Options.integer('limit').pipe(
  Options.withDefault(30),
  Options.withDescription('Number of results per page (1-1000)')
);

/**
 * List available tools with optional filters.
 *
 * @example
 * ```bash
 * composio tools list --toolkits "gmail"
 * composio tools list --query "send email" --toolkits "gmail"
 * composio tools list --tags "important" --limit 10
 * ```
 */
export const toolsCmd$List = Command.make(
  'list',
  { query, toolkits, tags, limit },
  ({ query, toolkits, tags, limit }) =>
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
        'Fetching tools...',
        repo.searchTools({
          search: Option.getOrUndefined(query),
          toolkit_slug: Option.getOrUndefined(toolkits),
          tags: Option.getOrUndefined(tags),
          limit: clampedLimit,
        })
      );

      if (result.items.length === 0) {
        const hint = Option.isSome(toolkits)
          ? `No tools found in toolkit "${toolkits.value}". Verify the toolkit slug with:\n> composio toolkits list`
          : 'No tools found. Try broadening your search.';
        yield* ui.log.warn(hint);
        return;
      }

      const showing = result.items.length;
      const totalPages = result.total_pages;

      yield* ui.log.info(
        totalPages > 1
          ? `Listing ${showing} tools (page 1 of ${totalPages})\n\n${formatToolsTable(result.items)}`
          : `Fetched ${showing} tools\n\n${formatToolsTable(result.items)}`
      );

      // Next step hint
      const firstSlug = result.items[0]?.slug;
      if (firstSlug) {
        yield* ui.log.step(`To view details of a tool:\n> composio tools info "${firstSlug}"`);
      }

      yield* ui.output(formatToolsJson(result.items));
    })
).pipe(Command.withDescription('List available tools.'));
