import { Args, Command } from '@effect/cli';
import { Effect, Option } from 'effect';
import { requireAuth } from 'src/effects/require-auth';
import { ComposioToolkitsRepository } from 'src/services/composio-clients';
import { TerminalUI } from 'src/services/terminal-ui';
import { formatTriggerTypeInfo } from '../format';

const slug = Args.text({ name: 'slug' }).pipe(
  Args.withDescription('Trigger slug (e.g. "GMAIL_NEW_GMAIL_MESSAGE")'),
  Args.optional
);

/**
 * View details of a specific trigger type including config and payload schemas.
 *
 * @example
 * ```bash
 * composio triggers info "GMAIL_NEW_GMAIL_MESSAGE"
 * ```
 */
export const triggersCmd$Info = Command.make('info', { slug }, ({ slug }) =>
  Effect.gen(function* () {
    if (!(yield* requireAuth)) return;

    const ui = yield* TerminalUI;
    const repo = yield* ComposioToolkitsRepository;

    if (Option.isNone(slug)) {
      yield* ui.log.warn('Missing required argument: <slug>');
      yield* ui.log.step(
        'Try specifying a trigger slug, e.g.:\n> composio triggers info "GMAIL_NEW_GMAIL_MESSAGE"'
      );
      return;
    }

    const slugValue = slug.value;
    const triggerType = yield* ui
      .withSpinner('Fetching trigger type details...', repo.getTriggerTypeDetailed(slugValue))
      .pipe(
        Effect.catchTag('services/HttpServerError', e =>
          Effect.if(e.status === 404, {
            onTrue: () =>
              ui.log
                .error(`Trigger "${slugValue}" not found.`)
                .pipe(
                  Effect.zipRight(
                    ui.log.step('Browse available trigger types:\n> composio triggers list')
                  ),
                  Effect.as(undefined)
                ),
            onFalse: () => Effect.fail(e),
          })
        )
      );

    if (!triggerType) return;

    yield* ui.log.info(formatTriggerTypeInfo(triggerType));

    const toolkitSlug = triggerType.toolkit?.slug?.toLowerCase();
    if (toolkitSlug) {
      yield* ui.log.step(
        `To list more trigger types in this toolkit:\n> composio triggers list --toolkits "${toolkitSlug}"`
      );
    }

    yield* ui.output(JSON.stringify(triggerType, null, 2));
  })
).pipe(Command.withDescription('View details of a specific trigger type.'));
