import { z } from 'zod/v3';
import { AuthSchemeTypes } from './authConfigs.types';
import { ConnectionStatuses } from './connectedAccountAuthStates.types';

// =============================================================================
// WEBHOOK EVENT TYPES
// =============================================================================

export const WebhookEventTypes = {
  CONNECTION_EXPIRED: 'composio.connected_account.expired',
} as const;

export type WebhookEventType = (typeof WebhookEventTypes)[keyof typeof WebhookEventTypes];

// =============================================================================
// CONNECTED ACCOUNT DATA SCHEMA (matches GET /api/v3/connected_accounts/{id})
// =============================================================================

/**
 * Auth config details included in the connected account response.
 */
export const ConnectedAccountAuthConfigSchema = z.object({
  /** The nano ID of the auth config */
  id: z.string(),
  /** @deprecated - use state.authScheme instead */
  auth_scheme: z.nativeEnum(AuthSchemeTypes),
  /** Whether this auth config is managed by Composio */
  is_composio_managed: z.boolean(),
  /** Whether the auth config is disabled */
  is_disabled: z.boolean(),
  /** @deprecated */
  deprecated: z
    .object({
      uuid: z.string(),
    })
    .optional(),
});

export type ConnectedAccountAuthConfig = z.infer<typeof ConnectedAccountAuthConfigSchema>;

/**
 * Simplified connection state schema for webhook payloads.
 * The full ConnectionDataSchema is too complex for webhook validation;
 * this schema accepts any auth scheme and state values.
 */
export const WebhookConnectionStateSchema = z.object({
  /** The auth scheme type (e.g., 'OAUTH2', 'API_KEY') */
  authScheme: z.nativeEnum(AuthSchemeTypes),
  /** Connection state values - varies by auth scheme */
  val: z.record(z.unknown()),
});

export type WebhookConnectionState = z.infer<typeof WebhookConnectionStateSchema>;

/**
 * Connected account data schema matching GET /api/v3/connected_accounts/{id} response.
 * Used in webhook payloads for connection lifecycle events.
 */
export const SingleConnectedAccountDetailedResponseSchema = z.object({
  /** Toolkit information */
  toolkit: z.object({
    slug: z.string().describe('The slug of the toolkit'),
  }),
  /** Auth config details */
  auth_config: ConnectedAccountAuthConfigSchema,
  /** The nano ID of the connected account */
  id: z.string(),
  /** @deprecated - user ID of the connection owner */
  user_id: z.string(),
  /** Connection status */
  status: z.nativeEnum(ConnectionStatuses),
  /** ISO-8601 timestamp of creation */
  created_at: z.string(),
  /** ISO-8601 timestamp of last update */
  updated_at: z.string(),
  /** Connection state data (auth scheme + state values) */
  state: WebhookConnectionStateSchema,
  /** @deprecated - use state instead */
  data: z.record(z.unknown()),
  /** @deprecated - use state instead */
  params: z.record(z.unknown()),
  /** Reason for the current status (e.g., expiration reason) */
  status_reason: z.string().nullable(),
  /** Whether the connection is disabled */
  is_disabled: z.boolean(),
  /** Endpoint for making test requests */
  test_request_endpoint: z.string().optional(),
  /** @deprecated */
  deprecated: z
    .object({
      labels: z.array(z.string()),
      uuid: z.string(),
    })
    .optional(),
});

export type SingleConnectedAccountDetailedResponse = z.infer<
  typeof SingleConnectedAccountDetailedResponseSchema
>;

// =============================================================================
// CONNECTION EXPIRED WEBHOOK EVENT SCHEMA
// =============================================================================

/**
 * Webhook metadata for connection events.
 * Note: This differs from the trigger webhook metadata in WebhookPayloadV3Schema.
 */
export const WebhookConnectionMetadataSchema = z.object({
  /** Project nano ID */
  project_id: z.string(),
  /** Organization UUID */
  org_id: z.string(),
});

export type WebhookConnectionMetadata = z.infer<typeof WebhookConnectionMetadataSchema>;

/**
 * Connection expired webhook event payload.
 * Emitted when a connected account expires due to authentication refresh failure.
 *
 * @example
 * ```typescript
 * import { ConnectionExpiredEventSchema } from '@composio/core';
 *
 * // In your webhook handler
 * const result = ConnectionExpiredEventSchema.safeParse(webhookPayload);
 * if (result.success) {
 *   const { data, metadata } = result.data;
 *   console.log(`Connection ${data.id} expired for user ${data.user_id}`);
 *   console.log(`Toolkit: ${data.toolkit.slug}`);
 *   console.log(`Project: ${metadata.project_id}`);
 * }
 * ```
 */
export const ConnectionExpiredEventSchema = z.object({
  /** Unique message ID (e.g., "msg_847cdfcd-d219-4f18-a6dd-91acd42ca94a") */
  id: z.string(),
  /** ISO-8601 timestamp of when the event was emitted */
  timestamp: z.string(),
  /** Event type identifier */
  type: z.literal(WebhookEventTypes.CONNECTION_EXPIRED),
  /** Connected account data (same as GET /api/v3/connected_accounts/{id}) */
  data: SingleConnectedAccountDetailedResponseSchema,
  /** Event metadata */
  metadata: WebhookConnectionMetadataSchema,
});

export type ConnectionExpiredEvent = z.infer<typeof ConnectionExpiredEventSchema>;

// =============================================================================
// UNION TYPE FOR ALL WEBHOOK EVENTS
// =============================================================================

/**
 * Union of all typed webhook event schemas.
 * Extend this as new event types are added.
 *
 * Note: This is separate from WebhookPayloadV3Schema which is a generic schema
 * for ANY V3 webhook. This union provides specific types for known events.
 */
export const WebhookEventSchema = z.discriminatedUnion('type', [ConnectionExpiredEventSchema]);

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
