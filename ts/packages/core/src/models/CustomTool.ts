/**
 * @fileoverview Standalone factory function for creating custom local tools.
 *
 * Usage:
 * ```typescript
 * import { CustomTool } from '@composio/core/experimental';
 *
 * const myTool = CustomTool({
 *   slug: 'GET_USER_CONTEXT',
 *   name: 'Get user context',
 *   description: 'Retrieve what we know about a user',
 *   inputParams: z.object({ category: z.string() }),
 *   execute: async (input) => ({ preferences: await db.find(input.category) }),
 * });
 * ```
 */
import * as zodToJsonSchema from 'zod-to-json-schema';
import { z } from 'zod/v3';
import type {
  NewCustomToolOptions,
  CustomToolHandle,
  CustomToolExecuteFn,
  LocalToolsMap,
  LocalToolsMapEntry,
  LocalToolDefinition,
  InputParamsSchema,
} from '../types/customTool.types';

/** Prefix applied by the backend to local tool slugs for disambiguation. */
export const LOCAL_TOOL_PREFIX = 'LOCAL_';

/**
 * Create a custom local tool for use in tool router sessions.
 *
 * The returned handle is a lightweight reference containing the tool's metadata
 * and execute function. Pass it to `composio.create(userId, { customTools: [...] })`
 * to bind it to a session.
 *
 * Just return the result data from `execute`, or throw an error.
 * The SDK wraps it into the standard response format internally.
 *
 * @param options - Tool definition including slug, schema, and execute function
 * @returns A CustomToolHandle to pass to session creation
 *
 * @example No-auth tool (no session needed)
 * ```typescript
 * const getUserContext = CustomTool({
 *   slug: 'GET_USER_CONTEXT',
 *   name: 'Get user context',
 *   description: 'Retrieve user preferences and history',
 *   inputParams: z.object({ category: z.string().default('all') }),
 *   execute: async (input) => {
 *     const prefs = await db.userContext.find(input.category);
 *     return { preferences: prefs };
 *   },
 * });
 * ```
 *
 * @example No-auth tool using session to call other tools
 * ```typescript
 * const enrichedSearch = CustomTool({
 *   slug: 'ENRICHED_SEARCH',
 *   name: 'Enriched search',
 *   description: 'Search and enrich results with user context',
 *   inputParams: z.object({ query: z.string() }),
 *   execute: async (input, session) => {
 *     const results = await session.execute('GOOGLE_SEARCH', { query: input.query });
 *     return { enriched: results.data, userId: session.userId };
 *   },
 * });
 * ```
 *
 * @example Auth tool with connectedToolkit (requires Composio connection)
 * ```typescript
 * const getAdAccounts = CustomTool({
 *   slug: 'GET_AD_ACCOUNTS',
 *   name: 'Get ad accounts',
 *   description: 'Get Meta ad account IDs for the authenticated user',
 *   connectedToolkit: 'meta_ads',
 *   inputParams: z.object({ fields: z.string().default('id,name') }),
 *   execute: async (input, session) => {
 *     const result = await session.execute('META_ADS_GET_AD_ACCOUNTS', {
 *       fields: input.fields,
 *     });
 *     return result.data;
 *   },
 * });
 * ```
 */
export function CustomTool<T extends z.ZodType>(
  options: NewCustomToolOptions<T>
): CustomToolHandle {
  const { slug, name, description, inputParams, execute, connectedToolkit } = options;

  if (!slug) {
    throw new Error('CustomTool: slug is required');
  }
  if (slug.toUpperCase().startsWith(LOCAL_TOOL_PREFIX)) {
    throw new Error(
      `CustomTool: slug must not start with "${LOCAL_TOOL_PREFIX}" — this prefix is reserved for internal routing.`
    );
  }
  if (!name) {
    throw new Error('CustomTool: name is required');
  }
  if (!description) {
    throw new Error('CustomTool: description is required');
  }
  if (!inputParams) {
    throw new Error('CustomTool: inputParams is required');
  }
  if (typeof execute !== 'function') {
    throw new Error('CustomTool: execute must be a function');
  }

  // Convert Zod schema → JSON Schema (reuses same pattern as legacy CustomTools.createTool)
  const paramsSchema = zodToJsonSchema.default(inputParams, {
    name: 'input',
  }) as InputParamsSchema;
  const paramsSchemaJson = paramsSchema.definitions.input;

  const inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: paramsSchemaJson.properties,
    ...(paramsSchemaJson.required ? { required: paramsSchemaJson.required } : {}),
  };

  return {
    slug,
    name,
    description,
    connectedToolkit,
    inputSchema,
    inputParams,
    execute: execute as CustomToolExecuteFn<z.ZodType>,
  };
}

/**
 * Build a LocalToolsMap from an array of handles.
 * Used internally by ToolRouter.create() to construct the per-session routing map.
 *
 * @internal
 * @param handles - The custom tool handles to include in the session
 * @returns Maps for O(1) lookup by both prefixed and original slug
 * @throws If duplicate slugs are detected
 */
export function buildLocalToolsMap(handles: CustomToolHandle[]): LocalToolsMap {
  const byPrefixed = new Map<string, LocalToolsMapEntry>();
  const byOriginal = new Map<string, LocalToolsMapEntry>();

  for (const handle of handles) {
    const upperSlug = handle.slug.toUpperCase();
    const prefixedSlug = `${LOCAL_TOOL_PREFIX}${upperSlug}`;

    if (byOriginal.has(upperSlug)) {
      throw new Error(`CustomTool: duplicate slug "${handle.slug}"`);
    }

    const entry: LocalToolsMapEntry = { handle, prefixedSlug };
    byPrefixed.set(prefixedSlug, entry);
    byOriginal.set(upperSlug, entry);
  }

  return { byPrefixed, byOriginal };
}

/**
 * Serialize custom tool handles into the format expected by the backend session creation API.
 *
 * @internal
 * @param handles - The custom tool handles to serialize
 * @returns Array of LocalToolDefinition for the API payload
 */
export function serializeLocalTools(
  handles: CustomToolHandle[]
): LocalToolDefinition[] {
  return handles.map(handle => ({
    slug: handle.slug,
    name: handle.name,
    description: handle.description,
    input_schema: handle.inputSchema,
    ...(handle.connectedToolkit ? { toolkit: handle.connectedToolkit } : {}),
  }));
}
