import { Command, Options } from '@effect/cli';
import { Deferred, Effect, Option, Runtime } from 'effect';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { requireAuth } from 'src/effects/require-auth';
import { TerminalUI } from 'src/services/terminal-ui';
import { TriggersRealtime } from 'src/services/triggers-realtime';
import { matchesTriggerListenFilters } from '../filter';
import { formatTriggerListenSummary } from '../format';
import { parseTriggerListenEvent } from '../parse';
import type { TriggerListenFilters } from '../types';

const toolkits = Options.text('toolkits').pipe(
  Options.withDescription(
    'Filter by toolkit slugs, comma-separated (e.g. "gmail" or "gmail,slack")'
  ),
  Options.optional
);

const triggerId = Options.text('trigger-id').pipe(
  Options.withDescription('Filter by trigger id'),
  Options.optional
);

const connectedAccountId = Options.text('connected-account-id').pipe(
  Options.withDescription('Filter by connected account id'),
  Options.optional
);

const triggerSlug = Options.text('trigger-slug').pipe(
  Options.withDescription(
    'Filter by trigger slug, comma-separated (e.g. "GMAIL_NEW_GMAIL_MESSAGE")'
  ),
  Options.optional
);

const userId = Options.text('user-id').pipe(
  Options.withDescription('Filter by user id'),
  Options.optional
);

const json = Options.boolean('json').pipe(
  Options.withDefault(false),
  Options.withDescription('Show raw event payload as JSON in interactive mode')
);

const table = Options.boolean('table').pipe(
  Options.withDefault(false),
  Options.withDescription(
    'Show compact table rows: timestamp, trigger_id, trigger_slug, toolkit, user_id, connected_account_id'
  )
);

const maxEvents = Options.integer('max-events').pipe(
  Options.withDescription('Stop after receiving N matching events'),
  Options.optional
);

const forward = Options.text('forward').pipe(
  Options.withDescription(
    'Forward each matching event to the given URL (signed with COMPOSIO_WEBHOOK_SECRET)'
  ),
  Options.optional
);

const out = Options.text('out').pipe(
  Options.withDescription('Append each matching event to this file'),
  Options.optional
);

const parseCsv = (value: string): ReadonlyArray<string> =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const randomUUID = () => crypto.randomUUID();

const signWebhookPayload = async ({
  secret,
  webhookId,
  webhookTimestamp,
  payload,
}: {
  secret: string;
  webhookId: string;
  webhookTimestamp: string;
  payload: string;
}) => {
  const toSign = `${webhookId}.${webhookTimestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const bytes = new Uint8Array(signature);
  const digest = btoa(String.fromCharCode(...bytes));
  return `v1,${digest}`;
};

const detectWebhookPayloadVersion = (eventData: Record<string, unknown>): 'V1' | 'V2' | 'V3' => {
  if (
    typeof eventData.id === 'string' &&
    typeof eventData.type === 'string' &&
    typeof eventData.timestamp === 'string' &&
    typeof eventData.metadata === 'object' &&
    eventData.metadata !== null &&
    typeof eventData.data === 'object' &&
    eventData.data !== null
  ) {
    return 'V3';
  }

  if (
    typeof eventData.type === 'string' &&
    typeof eventData.timestamp === 'string' &&
    typeof eventData.log_id === 'string' &&
    typeof eventData.data === 'object' &&
    eventData.data !== null
  ) {
    return 'V2';
  }

  return 'V1';
};

const TABLE_COLUMNS = [
  { key: 'timestamp', width: 25 },
  { key: 'trigger_id', width: 16 },
  { key: 'trigger_slug', width: 28 },
  { key: 'toolkit', width: 12 },
  { key: 'user_id', width: 24 },
  { key: 'connected_account_id', width: 24 },
] as const;

const formatTableCell = (value: string, width: number): string => {
  if (value.length <= width) return value.padEnd(width, ' ');
  if (width <= 1) return value.slice(0, width);
  return `${value.slice(0, width - 1)}…`;
};

const formatTableRow = (columns: ReadonlyArray<{ value: string; width: number }>): string =>
  columns.map(col => formatTableCell(col.value, col.width)).join(' | ');

export const triggersCmd$Listen = Command.make(
  'listen',
  {
    toolkits,
    triggerId,
    connectedAccountId,
    triggerSlug,
    userId,
    json,
    table,
    maxEvents,
    forward,
    out,
  },
  ({
    toolkits,
    triggerId,
    connectedAccountId,
    triggerSlug,
    userId,
    json,
    table,
    maxEvents,
    forward,
    out,
  }) =>
    Effect.gen(function* () {
      if (!(yield* requireAuth)) return;

      const ui = yield* TerminalUI;
      const realtime = yield* TriggersRealtime;
      const runtime = yield* Effect.runtime<never>();
      const forwardUrl = Option.getOrUndefined(forward);
      const generatedWebhookSecret = `composio-forward-secret-${randomUUID()}`;
      const webhookSecret = process.env.COMPOSIO_WEBHOOK_SECRET ?? generatedWebhookSecret;
      const outputFilePathOption = Option.getOrUndefined(out);
      const outputFilePath = outputFilePathOption ? path.resolve(outputFilePathOption) : undefined;

      if (outputFilePath) {
        // Ensure output directory exists before listening.
        yield* Effect.tryPromise({
          try: async () => {
            await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
          },
          catch: error => new Error(`Failed to prepare output file directory: ${String(error)}`),
        }).pipe(
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* ui.log.error(String(error));
              return yield* Effect.fail(error);
            })
          )
        );
      }

      const filters: TriggerListenFilters = {
        toolkits: Option.isSome(toolkits) ? parseCsv(toolkits.value) : undefined,
        triggerId: Option.getOrUndefined(triggerId),
        connectedAccountId: Option.getOrUndefined(connectedAccountId),
        triggerSlug: Option.isSome(triggerSlug) ? parseCsv(triggerSlug.value) : undefined,
        userId: Option.getOrUndefined(userId),
      };

      const maxEventsLimit = Option.getOrUndefined(maxEvents);
      const stopWhenDone = yield* Deferred.make<void>();
      let matchingEvents = 0;
      let tableHeaderPrinted = false;

      yield* ui.intro('composio triggers listen');
      if (forwardUrl) {
        if (process.env.COMPOSIO_WEBHOOK_SECRET) {
          yield* ui.note(
            `Forward URL: ${forwardUrl}\nSigning secret: ${webhookSecret}`,
            'Forwarding'
          );
        } else {
          yield* ui.log.warn(
            'No COMPOSIO_WEBHOOK_SECRET found. Generating a signing secret for this session.'
          );
          yield* ui.note(
            `Forward URL: ${forwardUrl}\nGenerated signing secret: ${webhookSecret}`,
            'Forwarding'
          );
        }
      }
      yield* ui.log.info('Listening for realtime trigger events. Press Ctrl+C to stop.');
      if (outputFilePath) {
        yield* ui.log.info(`Writing matching events to: ${outputFilePath}`);
      }
      if (forwardUrl) {
        yield* ui.log.info(`Forwarding matching events to: ${forwardUrl}`);
      }

      if (maxEventsLimit !== undefined) {
        yield* ui.log.info(`Auto-stop after ${maxEventsLimit} matching events.`);
      }

      const onEvent = (eventData: Record<string, unknown>) => {
        Runtime.runFork(runtime)(
          Effect.gen(function* () {
            const parsed = parseTriggerListenEvent(eventData);
            if (!matchesTriggerListenFilters(filters, parsed)) {
              return;
            }

            matchingEvents += 1;
            if (table) {
              if (!tableHeaderPrinted) {
                yield* ui.log.message(
                  formatTableRow(TABLE_COLUMNS.map(col => ({ value: col.key, width: col.width })))
                );
                tableHeaderPrinted = true;
              }

              const tableLine = formatTableRow([
                {
                  value:
                    typeof eventData.timestamp === 'string'
                      ? eventData.timestamp
                      : new Date().toISOString(),
                  width: TABLE_COLUMNS[0].width,
                },
                { value: parsed.id, width: TABLE_COLUMNS[1].width },
                { value: parsed.triggerSlug, width: TABLE_COLUMNS[2].width },
                { value: parsed.toolkitSlug, width: TABLE_COLUMNS[3].width },
                { value: parsed.userId || '-', width: TABLE_COLUMNS[4].width },
                {
                  value: parsed.metadata.connectedAccount.id || '-',
                  width: TABLE_COLUMNS[5].width,
                },
              ]);

              yield* ui.log.message(tableLine);
              yield* ui.output(tableLine);
            } else if (json) {
              yield* ui.note(formatTriggerListenSummary(parsed), `Event #${matchingEvents}`);
              yield* ui.log.message(JSON.stringify(eventData, null, 2));
              yield* ui.output(JSON.stringify(eventData));
            } else {
              yield* ui.note(formatTriggerListenSummary(parsed), `Event #${matchingEvents}`);
              yield* ui.log.message(JSON.stringify(parsed.payload, null, 2));
              yield* ui.output(JSON.stringify(eventData));
            }

            const payloadForForwarding = JSON.stringify(eventData);
            const logLine = `${payloadForForwarding}\n`;

            if (outputFilePath) {
              yield* Effect.tryPromise({
                try: () => fs.appendFile(outputFilePath, logLine, 'utf8'),
                catch: error => new Error(`Failed writing to ${outputFilePath}: ${String(error)}`),
              }).pipe(Effect.catchAll(error => ui.log.warn(String(error))));
            }

            if (forwardUrl && webhookSecret) {
              const webhookId =
                typeof eventData.id === 'string' && eventData.id.length > 0
                  ? eventData.id
                  : randomUUID();
              const webhookTimestamp = `${Math.floor(Date.now() / 1000)}`;
              const webhookSignature = yield* Effect.tryPromise(() =>
                signWebhookPayload({
                  secret: webhookSecret,
                  webhookId,
                  webhookTimestamp,
                  payload: payloadForForwarding,
                })
              );
              const webhookVersion = detectWebhookPayloadVersion(eventData);

              yield* Effect.tryPromise({
                try: async () => {
                  const response = await fetch(forwardUrl, {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      'webhook-id': webhookId,
                      'webhook-timestamp': webhookTimestamp,
                      'webhook-signature': webhookSignature,
                      'x-composio-webhook-version': webhookVersion,
                    },
                    body: payloadForForwarding,
                  });
                  if (!response.ok) {
                    throw new Error(`Forwarding failed with HTTP ${response.status}`);
                  }
                },
                catch: error =>
                  new Error(`Failed forwarding event to ${forwardUrl}: ${String(error)}`),
              }).pipe(Effect.catchAll(error => ui.log.warn(String(error))));
            }

            if (maxEventsLimit !== undefined && matchingEvents >= maxEventsLimit) {
              yield* Deferred.succeed(stopWhenDone, undefined).pipe(Effect.ignore);
            }
          })
        );
      };

      const listenEffect = realtime
        .listen(onEvent)
        .pipe(
          Effect.onInterrupt(() => ui.log.info('Stopped listening for realtime trigger events.'))
        );

      if (maxEventsLimit === undefined) {
        yield* listenEffect;
        return;
      }

      yield* Effect.raceFirst(listenEffect, Deferred.await(stopWhenDone));
      yield* ui.outro(`Stopped after receiving ${matchingEvents} matching events.`);
    })
).pipe(Command.withDescription('Listen to realtime trigger events for your project.'));
