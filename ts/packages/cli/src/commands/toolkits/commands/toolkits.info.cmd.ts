import { Args, Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { ComposioClientSingleton } from 'src/services/composio-clients';
import { TerminalUI } from 'src/services/terminal-ui';
import { requireAuth } from 'src/effects/require-auth';
import { createToolRouterSession } from 'src/effects/create-tool-router-session';
import { formatToolkitInfo } from '../format';

const slug = Args.text({ name: 'slug' }).pipe(
  Args.withDescription('Toolkit slug (e.g. "gmail")'),
  Args.optional
);

const userId = Options.text('user-id').pipe(
  Options.withDefault('default'),
  Options.withDescription('User ID for connection status (default: "default")')
);

/**
 * View details of a specific toolkit including connection status.
 *
 * @example
 * ```bash
 * composio toolkits info "gmail"
 * composio toolkits info "github" --user-id "alice"
 * ```
 */
export const toolkitsCmd$Info = Command.make('info', { slug, userId }, ({ slug, userId }) =>
  Effect.gen(function* () {
    if (!(yield* requireAuth)) return;

    const ui = yield* TerminalUI;

    // Missing slug guard
    if (Option.isNone(slug)) {
      yield* ui.log.warn('Missing required argument: <slug>');
      yield* ui.log.step('Try specifying a toolkit slug, e.g.:\n> composio toolkits info "gmail"');
      return;
    }

    const slugValue = slug.value;

    const clientSingleton = yield* ComposioClientSingleton;
    const client = yield* clientSingleton.get();

    const result = yield* ui.withSpinner(
      `Fetching toolkit "${slugValue}"...`,
      Effect.gen(function* () {
        const sessionId = yield* createToolRouterSession(client, userId);
        return yield* Effect.tryPromise(() =>
          client.toolRouter.session.toolkits(sessionId, {
            toolkits: [slugValue],
          })
        );
      })
    );

    const toolkit = result.items[0];
    if (!toolkit) {
      yield* ui.log.warn(`Toolkit "${slugValue}" not found.`);
      yield* ui.log.step('Browse available toolkits:\n> composio toolkits list');
      return;
    }

    yield* ui.note(formatToolkitInfo(toolkit), `Toolkit: ${toolkit.name}`);

    // Next step hint
    yield* ui.log.step(
      `To list tools in this toolkit:\n> composio tools list --toolkits "${toolkit.slug}"`
    );

    yield* ui.output(JSON.stringify(toolkit, null, 2));
  })
).pipe(Command.withDescription('View details of a specific toolkit.'));
