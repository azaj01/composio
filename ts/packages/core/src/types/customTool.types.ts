import { z } from 'zod/v3';
import { Tool, ToolProxyParams, ToolExecuteResponse as SdkToolExecuteResponse } from './tool.types';
import { ToolExecuteResponse } from '@composio/client/resources/tools';
import { ConnectionData } from './connectedAccountAuthStates.types';

// ────────────────────────────────────────────────────────────────
// Legacy custom tool types (used by composio.tools.createCustomTool)
// ────────────────────────────────────────────────────────────────

type BaseCustomToolOptions<T extends z.ZodType> = {
  name: string;
  description?: string;
  slug: string;
  inputParams: T;
};

type ToolkitBasedExecute<T extends z.ZodType> = {
  execute: (
    input: z.infer<T>,
    connectionConfig: ConnectionData | null,
    executeToolRequest: (data: ToolProxyParams) => Promise<ToolExecuteResponse>
  ) => Promise<ToolExecuteResponse>;
  toolkitSlug: string;
};

type StandaloneExecute<T extends z.ZodType> = {
  execute: (input: z.infer<T>) => Promise<ToolExecuteResponse>;
  toolkitSlug?: never;
};

export type CustomToolOptions<T extends z.ZodType> = BaseCustomToolOptions<T> &
  (ToolkitBasedExecute<T> | StandaloneExecute<T>);

export type CustomToolRegistry = Map<
  string,
  { options: CustomToolOptions<CustomToolInputParameter>; schema: Tool }
>;

export type InputParamsSchema = {
  definitions: {
    input: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type CustomToolInputParameter = z.ZodType;

export interface CustomToolRegistryItem {
  options: CustomToolOptions<CustomToolInputParameter>;
  schema: Tool;
}

export interface ExecuteMetadata {
  userId: string;
  connectedAccountId?: string;
}

// ────────────────────────────────────────────────────────────────
// New custom tool types (for tool router integration via createCustomTool())
// ────────────────────────────────────────────────────────────────

/**
 * Session context injected into custom tool execute functions at runtime.
 * Provides identity context and methods to call other tools or proxy API requests.
 */
export interface SessionContext {
  /** The user ID for this session */
  readonly userId: string;
  /** Execute any Composio native tool from within a custom tool */
  execute(
    toolSlug: string,
    arguments_: Record<string, unknown>
  ): Promise<SdkToolExecuteResponse>;
  /**
   * Proxy API calls through Composio's auth layer (resolved from session).
   * @todo Not yet implemented — pending backend session-scoped proxy endpoint.
   */
  proxyExecute(params: ToolProxyParams): Promise<SdkToolExecuteResponse>;
}

/**
 * Execute function for custom tools.
 * Just return the result data, or throw an error. The SDK wraps it internally.
 *
 * Supports two call patterns:
 * - `(input) => data` — for tools that don't need session context
 * - `(input, session) => data` — for tools that need to call other tools or proxy APIs
 */
export type CustomToolExecuteFn<T extends z.ZodType> = (
  input: z.infer<T>,
  session: SessionContext
) => Promise<Record<string, unknown>>;

/**
 * Zod schema for validating the string/scalar fields of createCustomTool() options.
 * Used internally for validation — inputParams and execute are checked manually.
 */
export const CreateCustomToolBaseSchema = z.object({
  slug: z
    .string()
    .min(1, 'createCustomTool: slug is required')
    .refine(s => !s.toUpperCase().startsWith('LOCAL_'), {
      message:
        'createCustomTool: slug must not start with "LOCAL_" — this prefix is reserved for internal routing.',
    }),
  name: z.string().min(1, 'createCustomTool: name is required'),
  description: z.string().min(1, 'createCustomTool: description is required'),
  /**
   * Composio toolkit slug that this tool requires an active connection for.
   * Set this to the toolkit whose auth your tool needs (e.g. `'meta_ads'`, `'gmail'`).
   * Leave empty for tools that don't need any Composio-managed authentication.
   */
  toolkit: z.string().optional(),
});

/** Options for creating a custom tool via `createCustomTool()`. */
export type CreateCustomToolParams<T extends z.ZodType> = z.infer<
  typeof CreateCustomToolBaseSchema
> & {
  /** Zod schema for input parameters */
  inputParams: T;
  /** The function that executes the tool */
  execute: CustomToolExecuteFn<T>;
};

/**
 * Custom tool definition returned from `createCustomTool()`.
 * Pass to `composio.create(userId, { customTools: [...] })` to bind to a session.
 */
export interface CustomTool {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /**
   * Composio toolkit slug that this tool requires an active connection for.
   * Set this to the toolkit whose auth your tool needs (e.g. `'meta_ads'`, `'gmail'`).
   * Undefined means the tool doesn't need any Composio-managed authentication.
   */
  readonly toolkit?: string;
  readonly inputSchema: Record<string, unknown>;
  /** @internal Original Zod schema — used for runtime input validation (defaults, coercions, transforms) */
  readonly inputParams: z.ZodType;
  /** Direct reference to the execute function — useful for testing */
  readonly execute: CustomToolExecuteFn<z.ZodType>;
}

/** Serialized tool definition sent to backend for search indexing. */
export interface CustomToolDefinition {
  slug: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  toolkit?: string;
}

/** @internal Entry in the per-session custom tools routing map. */
export type CustomToolsMapEntry = {
  handle: CustomTool;
  prefixedSlug: string;
};

/** @internal Lookup maps used by ToolRouterSession for routing custom tools. */
export type CustomToolsMap = {
  /** Lookup by prefixed slug (e.g. LOCAL_GET_USER_CONTEXT) — used for agent execution path */
  byPrefixed: Map<string, CustomToolsMapEntry>;
  /** Lookup by original slug (e.g. GET_USER_CONTEXT) — used for programmatic session.execute() */
  byOriginal: Map<string, CustomToolsMapEntry>;
};
