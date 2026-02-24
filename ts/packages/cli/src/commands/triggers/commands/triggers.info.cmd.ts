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
    const triggerTypes = yield* ui.withSpinner('Fetching trigger types...', repo.getTriggerTypes());
    const normalizedSlug = slugValue.toUpperCase();
    const triggerType = triggerTypes.find(item => item.slug.toUpperCase() === normalizedSlug);

    if (!triggerType) {
      yield* ui.log.error(`Trigger "${slugValue}" not found.`);
      const suggestions = triggerTypes
        .filter(item => item.slug.toUpperCase().includes(normalizedSlug))
        .slice(0, 3);
      if (suggestions.length > 0) {
        yield* ui.log.step('Did you mean:');
        yield* Effect.forEach(suggestions, item =>
          ui.log.step(`> composio triggers info "${item.slug}"`)
        );
      } else {
        yield* ui.log.step('Browse available trigger types:\n> composio triggers list');
      }
      return;
    }

    yield* ui.note(formatTriggerTypeInfo(triggerType), `Trigger: ${triggerType.name}`);

    const toolkitSlug = triggerType.slug.split('_')[0]?.toLowerCase();
    if (toolkitSlug) {
      yield* ui.log.step(
        `To list more trigger types in this toolkit:\n> composio triggers list --toolkits "${toolkitSlug}"`
      );
    }

    yield* ui.output(JSON.stringify(triggerType, null, 2));
  })
).pipe(Command.withDescription('View details of a specific trigger type.'));
