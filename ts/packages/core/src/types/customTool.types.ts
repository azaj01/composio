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
// New custom tool types (for tool router integration via CustomTool())
// ────────────────────────────────────────────────────────────────

/**
 * Session context injected into custom tool execute functions at runtime.
 * Provides identity context and methods to call other tools or proxy API requests.
 */
export interface SessionContext {
  /** The user ID for this session */
  readonly userId: string;
  /** The tool router session ID */
  readonly sessionId: string;
  /** Execute any Composio native tool from within a custom tool */
  execute(
    toolSlug: string,
    arguments_: Record<string, unknown>
  ): Promise<SdkToolExecuteResponse>;
  /** Proxy API calls through Composio's auth layer (resolved from session) */
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

/** Options for creating a custom local tool via `CustomTool()`. */
export type NewCustomToolOptions<T extends z.ZodType> = {
  /** Unique slug identifier (e.g. 'GET_USER_CONTEXT') */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description — required for search indexing */
  description: string;
  /** Zod schema for input parameters */
  inputParams: T;
  /**
   * Composio toolkit slug requiring an active connection (e.g. 'meta_ads').
   * If not provided, the tool does not need Composio auth.
   */
  connectedToolkit?: string;
  /** The function that executes the tool */
  execute: CustomToolExecuteFn<T>;
};

/**
 * Handle returned from `CustomTool()`.
 * Pass to `composio.create(userId, { customTools: [...] })` to bind to a session.
 */
export interface CustomToolHandle {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /**
   * Composio toolkit slug requiring an active connection.
   * Undefined means the tool does not need Composio auth.
   */
  readonly connectedToolkit?: string;
  readonly inputSchema: Record<string, unknown>;
  /** @internal Original Zod schema — used for runtime input validation (defaults, coercions, transforms) */
  readonly inputParams: z.ZodType;
  /** Direct reference to the execute function — useful for testing */
  readonly execute: CustomToolExecuteFn<z.ZodType>;
}

/** Serialized tool definition sent to backend for BM25 search indexing. */
export interface LocalToolDefinition {
  slug: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Maps connectedToolkit → toolkit in the backend payload */
  toolkit?: string;
}

/** @internal Entry in the per-session local tools routing map. */
export type LocalToolsMapEntry = {
  handle: CustomToolHandle;
  prefixedSlug: string;
};

/** @internal Lookup maps used by ToolRouterSession for routing. */
export type LocalToolsMap = {
  /** Lookup by prefixed slug (e.g. LOCAL_GET_USER_CONTEXT) — used for agent execution path */
  byPrefixed: Map<string, LocalToolsMapEntry>;
  /** Lookup by original slug (e.g. GET_USER_CONTEXT) — used for programmatic session.execute() */
  byOriginal: Map<string, LocalToolsMapEntry>;
};
