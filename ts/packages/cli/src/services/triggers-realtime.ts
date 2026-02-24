import { Data, Effect } from 'effect';
import { ComposioSessionRepository } from 'src/services/composio-clients';

type RawRealtimeEvent = Record<string, unknown>;

type PusherAuthOptions = {
  params?: {
    channel_name?: string;
    socket_id?: string;
    channelName?: string;
    socketId?: string;
  };
  channel_name?: string;
  socket_id?: string;
  channelName?: string;
  socketId?: string;
};

type PusherAuthCallback = (error: unknown, data?: unknown) => void;

type PusherChannel = {
  bind: (event: string, callback: (data: unknown) => void) => void;
  bind_global?: (callback: (eventName: string, data: unknown) => void) => void;
  unbind?: (event?: string, callback?: (data: unknown) => void) => void;
};

type PusherClient = {
  subscribe: (channelName: string) => PusherChannel;
  unsubscribe: (channelName: string) => void;
  disconnect: () => void;
  connection?: {
    bind?: (event: string, callback: (data: unknown) => void) => void;
  };
};

type PusherCtor = new (
  key: string,
  options: {
    cluster: string;
    channelAuthorization: {
      customHandler: (
        authOptions: PusherAuthOptions,
        callback?: PusherAuthCallback
      ) => Promise<unknown> | void;
    };
  }
) => PusherClient;

type ChunkedRealtimeEvent = {
  id: string;
  index: number;
  chunk: string;
  final: boolean;
};

export class TriggerRealtimeSubscriptionError extends Data.TaggedError(
  'services/TriggerRealtimeSubscriptionError'
)<{
  readonly cause?: unknown;
}> {}

/**
 * Service for listening to trigger events over Composio CLI realtime channels.
 * Uses:
 * - `cli.realtime.credentials` to fetch Pusher credentials + project nano id
 * - `cli.realtime.auth` for private channel auth callbacks
 */
export class TriggersRealtime extends Effect.Service<TriggersRealtime>()(
  'services/TriggersRealtime',
  {
    effect: Effect.gen(function* () {
      const sessionRepo = yield* ComposioSessionRepository;

      const listen = (onEvent: (data: RawRealtimeEvent) => void) =>
        Effect.acquireUseRelease(
          Effect.gen(function* () {
            const creds = yield* sessionRepo.getRealtimeCredentials();
            const channelName = `private-cli-${creds.project_id}`;

            const pusherModule = yield* Effect.tryPromise({
              try: () => import('pusher-js'),
              catch: cause => new TriggerRealtimeSubscriptionError({ cause }),
            });

            const Pusher = pusherModule.default as unknown as PusherCtor;

            const pusher = new Pusher(creds.pusher_key, {
              cluster: creds.pusher_cluster,
              channelAuthorization: {
                customHandler: (authOptions: PusherAuthOptions, callback?: PusherAuthCallback) => {
                  const params = authOptions.params ?? authOptions;
                  const channel_name = params.channel_name ?? params.channelName;
                  const socket_id = params.socket_id ?? params.socketId;

                  const doAuth = async () => {
                    if (!channel_name || !socket_id) {
                      throw new Error('Missing channel_name or socket_id for realtime auth');
                    }

                    const response = await Effect.runPromise(
                      sessionRepo.authRealtimeChannel({
                        channel_name,
                        socket_id,
                      })
                    );
                    // Pusher private channels verify signatures without channel_data.
                    // Some auth endpoints may still return channel_data, which can cause
                    // "Invalid signature" if included in the verification input.
                    const normalizedResponse = channel_name.startsWith('private-')
                      ? { auth: response.auth }
                      : response;
                    return normalizedResponse;
                  };

                  if (callback) {
                    void doAuth()
                      .then(data => callback(null, data))
                      .catch(error => callback(error));
                    return;
                  }

                  return doAuth();
                },
              },
            });

            const channel = pusher.subscribe(channelName);
            const chunkedEvents = new Map<string, { chunks: string[]; receivedFinal: boolean }>();

            channel.bind('trigger_to_client', eventData => {
              onEvent((eventData ?? {}) as RawRealtimeEvent);
            });

            channel.bind('chunked-trigger_to_client', data => {
              const typed = data as ChunkedRealtimeEvent;
              if (!typed || typeof typed.id !== 'string' || typeof typed.index !== 'number') {
                return;
              }

              if (!chunkedEvents.has(typed.id)) {
                chunkedEvents.set(typed.id, { chunks: [], receivedFinal: false });
              }

              const current = chunkedEvents.get(typed.id)!;
              current.chunks[typed.index] = typed.chunk;
              if (typed.final) {
                current.receivedFinal = true;
              }

              if (
                current.receivedFinal &&
                current.chunks.length === Object.keys(current.chunks).length
              ) {
                try {
                  const parsed = JSON.parse(current.chunks.join('')) as RawRealtimeEvent;
                  onEvent(parsed);
                } finally {
                  chunkedEvents.delete(typed.id);
                }
              }
            });

            return {
              shutdown: async () => {
                channel.unbind?.();
                pusher.unsubscribe(channelName);
                pusher.disconnect();
              },
            };
          }),
          () => Effect.never,
          resource =>
            Effect.tryPromise({
              try: () => resource.shutdown(),
              catch: cause => new TriggerRealtimeSubscriptionError({ cause }),
            }).pipe(Effect.catchAll(() => Effect.void))
        );

      return { listen };
    }),
    dependencies: [ComposioSessionRepository.Default],
  }
) {}
