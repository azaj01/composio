/**
 * @fileoverview Factory functions for creating custom tools and toolkits.
 *
 * Usage:
 * ```typescript
 * import { experimental_createTool, experimental_createToolkit } from '@composio/core';
 *
 * const grep = createCustomTool('GREP', {
 *   name: 'Grep Search',
 *   description: 'Search for patterns in files',
 *   inputParams: z.object({ pattern: z.string() }),
 *   execute: async (input) => ({ matches: [] }),
 * });
 *
 * const devTools = createCustomToolkit('DEV_TOOLS', {
 *   name: 'Dev Tools',
 *   description: 'Local dev utilities',
 *   tools: [grep],
 * });
 * ```
 */
import * as zodToJsonSchema from 'zod-to-json-schema';
import { z } from 'zod/v3';
import {
  CreateCustomToolBaseSchema,
  CreateCustomToolkitBaseSchema,
  CustomToolSlugSchema,
  type CreateCustomToolParams,
  type CreateCustomToolkitParams,
  type CustomTool,
  type CustomToolkit,
  type CustomToolExecuteFn,
  type CustomToolsMap,
  type CustomToolsMapEntry,
  type CustomToolDefinition,
  type CustomToolkitDefinition,
  type InputParamsSchema,
} from '../types/customTool.types';
import { ValidationError } from '../errors';

/** Prefix applied by the backend to local tool slugs for disambiguation. */
export const LOCAL_TOOL_PREFIX = 'LOCAL_';

/** Maximum allowed length for the final prefixed slug. */
const MAX_PREFIXED_SLUG_LENGTH = 60;

/**
 * Create a custom tool for use in tool router sessions.
 *
 * The returned object is a lightweight reference containing the tool's metadata
 * and execute function. Pass it to `composio.create(userId, { experimental: { customTools: [...] } })`
 * to bind it to a session.
 *
 * Just return the result data from `execute`, or throw an error.
 * The SDK wraps it into the standard response format internally.
 *
 * @param slug - Unique tool identifier (alphanumeric, underscores, hyphens; no LOCAL_ prefix)
 * @param options - Tool definition including name, schema, and execute function
 * @returns A CustomTool to pass to session creation
 *
 * @example Standalone tool (no auth)
 * ```typescript
 * const grep = createCustomTool('GREP', {
 *   name: 'Grep Search',
 *   description: 'Search for patterns in files',
 *   inputParams: z.object({ pattern: z.string(), path: z.string() }),
 *   execute: async (input) => ({ matches: [] }),
 * });
 * ```
 *
 * @example Tool extending a Composio toolkit (inherits auth)
 * ```typescript
 * const getImportant = createCustomTool('GET_IMPORTANT_EMAILS', {
 *   name: 'Get Important Emails',
 *   description: 'Fetch high-priority emails',
 *   extendsToolkit: 'gmail',
 *   inputParams: z.object({ limit: z.number().default(10) }),
 *   execute: async (input, session) => {
 *     const result = await session.execute('GMAIL_SEARCH', { query: 'is:important' });
 *     return { emails: result.data };
 *   },
 * });
 * ```
 */
export function createCustomTool<T extends z.ZodType>(
  slug: string,
  options: CreateCustomToolParams<T>
): CustomTool {
  // Validate slug separately
  const slugResult = CustomToolSlugSchema.safeParse(slug);
  if (!slugResult.success) {
    throw new ValidationError(`createCustomTool: ${slugResult.error.issues[0].message}`, { cause: slugResult.error });
  }

  // Validate string/scalar fields via Zod schema
  const validated = CreateCustomToolBaseSchema.parse(options);

  // Manual checks for fields Zod can't validate
  if (!options.inputParams) {
    throw new ValidationError('createCustomTool: inputParams is required');
  }
  if (typeof options.execute !== 'function') {
    throw new ValidationError('createCustomTool: execute must be a function');
  }

  const { inputParams, execute } = options;

  // Convert Zod input schema → JSON Schema
  const paramsSchema = zodToJsonSchema.default(inputParams, {
    name: 'input',
  }) as InputParamsSchema;
  const paramsSchemaJson = paramsSchema.definitions.input;

  const inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: paramsSchemaJson.properties,
    ...(paramsSchemaJson.required ? { required: paramsSchemaJson.required } : {}),
  };

  // Convert Zod output schema → JSON Schema (if provided)
  let outputSchema: Record<string, unknown> | undefined;
  if (options.outputParams) {
    const outSchema = zodToJsonSchema.default(options.outputParams, {
      name: 'output',
    }) as { definitions: { output: { type: string; properties: Record<string, unknown>; required?: string[] } } };
    const outJson = outSchema.definitions.output;
    outputSchema = {
      type: 'object',
      properties: outJson.properties,
      ...(outJson.required ? { required: outJson.required } : {}),
    };
  }

  return {
    slug: slugResult.data,
    name: validated.name,
    description: validated.description,
    extendsToolkit: validated.extendsToolkit,
    inputSchema,
    outputSchema,
    inputParams,
    execute: execute as CustomToolExecuteFn<z.ZodType>,
  };
}

/**
 * Create a custom toolkit that groups related tools.
 *
 * Tools in a toolkit get prefixed as `LOCAL_<TOOLKIT_SLUG>_<TOOL_SLUG>`.
 * Tools passed here must NOT have `extendsToolkit` set — they inherit the toolkit identity instead.
 *
 * @param slug - Unique toolkit identifier (alphanumeric, underscores, hyphens; no LOCAL_ prefix)
 * @param options - Toolkit definition including name, description, and tools
 * @returns A CustomToolkit to pass to session creation
 *
 * @example
 * ```typescript
 * const devTools = createCustomToolkit('DEV_TOOLS', {
 *   name: 'Dev Tools',
 *   description: 'Local dev utilities',
 *   tools: [grepTool, sedTool],
 * });
 * ```
 */
export function createCustomToolkit(
  slug: string,
  options: CreateCustomToolkitParams
): CustomToolkit {
  // Validate slug
  const slugResult = CustomToolSlugSchema.safeParse(slug);
  if (!slugResult.success) {
    throw new ValidationError(`createCustomToolkit: ${slugResult.error.issues[0].message}`, { cause: slugResult.error });
  }

  // Validate name/description
  const validated = CreateCustomToolkitBaseSchema.parse(options);

  // Non-empty tools required
  if (!options.tools?.length) {
    throw new ValidationError('createCustomToolkit: at least one tool is required');
  }

  // Reject tools with extendsToolkit
  for (const tool of options.tools) {
    if (tool.extendsToolkit) {
      throw new ValidationError(
        `createCustomToolkit: tool "${tool.slug}" has extendsToolkit set. ` +
        `Tools in a custom toolkit must not use extendsToolkit — they inherit the toolkit identity instead.`
      );
    }
  }

  return {
    slug: slugResult.data,
    name: validated.name,
    description: validated.description,
    tools: options.tools,
  };
}

/**
 * Build a CustomToolsMap from custom tools and toolkits.
 * Used internally by ToolRouter.create() to construct the per-session routing map.
 *
 * Prefix rules:
 * - Standalone (no extendsToolkit): `LOCAL_<SLUG>`
 * - Extends toolkit: `LOCAL_<EXTENDS_TOOLKIT>_<SLUG>`
 * - Toolkit tool: `LOCAL_<TOOLKIT_SLUG>_<TOOL_SLUG>`
 *
 * @internal
 * @param tools - Standalone custom tools
 * @param toolkits - Custom toolkits containing grouped tools
 * @returns Maps for O(1) lookup by both prefixed and original slug
 * @throws If duplicate slugs, slug too long, or cross-group collisions
 */
export function buildCustomToolsMap(
  tools: CustomTool[],
  toolkits?: CustomToolkit[]
): CustomToolsMap {
  const byPrefixed = new Map<string, CustomToolsMapEntry>();
  const byOriginal = new Map<string, CustomToolsMapEntry>();

  const addEntry = (handle: CustomTool, prefixedSlug: string) => {
    const originalSlug = handle.slug.toUpperCase();

    // Validate final prefixed slug length
    if (prefixedSlug.length > MAX_PREFIXED_SLUG_LENGTH) {
      const prefix = prefixedSlug.substring(0, prefixedSlug.length - originalSlug.length);
      const available = MAX_PREFIXED_SLUG_LENGTH - prefix.length;
      throw new ValidationError(
        `Custom tool slug "${handle.slug}" is too long. ` +
        `With prefix "${prefix}", the final slug "${prefixedSlug}" exceeds ${MAX_PREFIXED_SLUG_LENGTH} characters. ` +
        `Shorten the slug to at most ${available} characters.`
      );
    }

    // Check cross-group collisions on prefixed slug
    if (byPrefixed.has(prefixedSlug)) {
      throw new ValidationError(`Custom tool slug collision: "${prefixedSlug}" is already registered.`);
    }

    // Check cross-group collisions on original slug
    if (byOriginal.has(originalSlug)) {
      throw new ValidationError(
        `Custom tool slug collision: original slug "${handle.slug}" maps to multiple prefixed slugs. ` +
        `"${byOriginal.get(originalSlug)!.prefixedSlug}" and "${prefixedSlug}" both resolve from "${originalSlug}".`
      );
    }

    const entry: CustomToolsMapEntry = { handle, prefixedSlug };
    byPrefixed.set(prefixedSlug, entry);
    byOriginal.set(originalSlug, entry);
  };

  // Process standalone tools
  for (const handle of tools) {
    const upperSlug = handle.slug.toUpperCase();
    if (handle.extendsToolkit) {
      // LOCAL_<EXTENDS_TOOLKIT>_<SLUG>
      addEntry(handle, `LOCAL_${handle.extendsToolkit.toUpperCase()}_${upperSlug}`);
    } else {
      // LOCAL_<SLUG>
      addEntry(handle, `LOCAL_${upperSlug}`);
    }
  }

  // Process toolkit tools
  if (toolkits) {
    for (const toolkit of toolkits) {
      const tkSlug = toolkit.slug.toUpperCase();
      for (const handle of toolkit.tools) {
        // LOCAL_<TOOLKIT_SLUG>_<TOOL_SLUG>
        addEntry(handle, `LOCAL_${tkSlug}_${handle.slug.toUpperCase()}`);
      }
    }
  }

  return { byPrefixed, byOriginal };
}

/**
 * Serialize custom tools into the format expected by the backend session creation API.
 *
 * Maps `extendsToolkit` → `extends_toolkit` for backend. Omitted for standalone tools.
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
    ...(handle.outputSchema ? { output_schema: handle.outputSchema } : {}),
    ...(handle.extendsToolkit ? { extends_toolkit: handle.extendsToolkit } : {}),
  }));
}

/**
 * Serialize custom toolkits into the format expected by the backend session creation API.
 *
 * @internal
 * @param toolkits - The custom toolkits to serialize
 * @returns Array of CustomToolkitDefinition for the API payload
 */
export function serializeCustomToolkits(
  toolkits: CustomToolkit[]
): CustomToolkitDefinition[] {
  return toolkits.map(tk => ({
    slug: tk.slug,
    name: tk.name,
    description: tk.description,
    tools: tk.tools.map(t => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
      ...(t.outputSchema ? { output_schema: t.outputSchema } : {}),
    })),
  }));
}
