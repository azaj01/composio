import { Effect } from 'effect';
import type { Composio } from '@composio/client';

export interface CreateToolRouterSessionOptions {
  /** Enable auto connection management. Default: false. */
  readonly manageConnections?: boolean;
}

/**
 * Create an ephemeral Tool Router session for the given user ID.
 * Returns the session ID string.
 *
 * Accepts a pre-resolved client instance (from ComposioClientSingleton)
 * so callers can resolve the dependency at layer construction time.
 */
export const createToolRouterSession = (
  client: Composio,
  userId: string,
  options?: CreateToolRouterSessionOptions
) =>
  Effect.tryPromise(() =>
    client.toolRouter.session.create({
      user_id: userId,
      manage_connections: { enable: options?.manageConnections ?? false },
    })
  ).pipe(Effect.map(session => session.session_id));
