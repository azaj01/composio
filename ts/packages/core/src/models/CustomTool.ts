/**
 * @fileoverview Standalone factory function for creating custom local tools.
 *
 * Usage:
 * ```typescript
 * import { createCustomTool } from '@composio/core/experimental';
 *
 * const myTool = createCustomTool({
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
import {
  CreateCustomToolBaseSchema,
  type CreateCustomToolParams,
  type CustomTool,
  type CustomToolExecuteFn,
  type CustomToolsMap,
  type CustomToolsMapEntry,
  type CustomToolDefinition,
  type InputParamsSchema,
} from '../types/customTool.types';

/** Prefix applied by the backend to local tool slugs for disambiguation. */
export const LOCAL_TOOL_PREFIX = 'LOCAL_';

/**
 * Create a custom local tool for use in tool router sessions.
 *
 * The returned object is a lightweight reference containing the tool's metadata
 * and execute function. Pass it to `composio.create(userId, { customTools: [...] })`
 * to bind it to a session.
 *
 * Just return the result data from `execute`, or throw an error.
 * The SDK wraps it into the standard response format internally.
 *
 * @param options - Tool definition including slug, schema, and execute function
 * @returns A CustomTool to pass to session creation
 *
 * @example No-auth tool (no session needed)
 * ```typescript
 * const getUserContext = createCustomTool({
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
 * @example Tool using session to call other tools
 * ```typescript
 * const enrichedSearch = createCustomTool({
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
 * @example Auth tool with toolkit (requires Composio connection)
 * ```typescript
 * const getAdAccounts = createCustomTool({
 *   slug: 'GET_AD_ACCOUNTS',
 *   name: 'Get ad accounts',
 *   description: 'Get Meta ad account IDs for the authenticated user',
 *   toolkit: 'meta_ads',
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
export function createCustomTool<T extends z.ZodType>(
  options: CreateCustomToolParams<T>
): CustomTool {
  // Validate string/scalar fields via Zod schema
  const validated = CreateCustomToolBaseSchema.parse(options);

  // Manual checks for fields Zod can't validate
  if (!options.inputParams) {
    throw new Error('createCustomTool: inputParams is required');
  }
  if (typeof options.execute !== 'function') {
    throw new Error('createCustomTool: execute must be a function');
  }

  const { inputParams, execute } = options;

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
    slug: validated.slug,
    name: validated.name,
    description: validated.description,
    toolkit: validated.toolkit,
    inputSchema,
    inputParams,
    execute: execute as CustomToolExecuteFn<z.ZodType>,
  };
}

/**
 * Build a CustomToolsMap from an array of custom tools.
 * Used internally by ToolRouter.create() to construct the per-session routing map.
 *
 * @internal
 * @param tools - The custom tools to include in the session
 * @returns Maps for O(1) lookup by both prefixed and original slug
 * @throws If duplicate slugs are detected
 */
export function buildCustomToolsMap(tools: CustomTool[]): CustomToolsMap {
  const byPrefixed = new Map<string, CustomToolsMapEntry>();
  const byOriginal = new Map<string, CustomToolsMapEntry>();

  for (const handle of tools) {
    const upperSlug = handle.slug.toUpperCase();
    const prefixedSlug = `${LOCAL_TOOL_PREFIX}${upperSlug}`;

    if (byOriginal.has(upperSlug)) {
      throw new Error(`createCustomTool: duplicate slug "${handle.slug}"`);
    }

    const entry: CustomToolsMapEntry = { handle, prefixedSlug };
    byPrefixed.set(prefixedSlug, entry);
    byOriginal.set(upperSlug, entry);
  }

  return { byPrefixed, byOriginal };
}

/**
 * Serialize custom tools into the format expected by the backend session creation API.
 *
 * @internal
 * @param tools - The custom tools to serialize
 * @returns Array of CustomToolDefinition for the API payload
 */
export function serializeCustomTools(
  tools: CustomTool[]
): CustomToolDefinition[] {
  return tools.map(handle => ({
    slug: handle.slug,
    name: handle.name,
    description: handle.description,
    input_schema: handle.inputSchema,
    ...(handle.toolkit ? { toolkit: handle.toolkit } : {}),
  }));
}
