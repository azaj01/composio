/**
 * @fileoverview Standalone functions for local tool lookup and execution.
 * Extracted from ToolRouterSession for reuse in SessionContextImpl (sibling routing).
 */
import type { LocalToolsMap, LocalToolsMapEntry, SessionContext } from '../types/customTool.types';
import type { ToolExecuteResponse } from '../types/tool.types';

/**
 * Find a local tool entry by slug.
 * Checks both the prefixed map (LOCAL_X — agent path) and original map (X — programmatic path).
 */
export function findLocalTool(
  map: LocalToolsMap | undefined,
  slug: string
): LocalToolsMapEntry | undefined {
  if (!map) return undefined;
  const upper = slug.toUpperCase();
  return map.byPrefixed.get(upper) ?? map.byOriginal.get(upper);
}

/**
 * Execute a local tool in-process.
 * Validates input via the Zod schema, calls the user's execute function,
 * and wraps the result into the standard response format.
 *
 * Callers provide a pre-built SessionContext (which may include sibling local routing).
 */
export async function executeLocalTool(
  entry: LocalToolsMapEntry,
  arguments_: Record<string, unknown>,
  sessionContext: SessionContext
): Promise<ToolExecuteResponse> {
  const { handle } = entry;

  // Validate and transform input using the original Zod schema.
  // This applies defaults, coercions, and transforms (e.g. z.string().default('all')).
  const parsed = handle.inputParams.safeParse(arguments_);
  if (!parsed.success) {
    return {
      data: {},
      error: `Input validation failed: ${parsed.error.message}`,
      successful: false,
    };
  }

  try {
    // User's execute returns data directly — we wrap into { data, error, successful }
    const data = await handle.execute(parsed.data, sessionContext);
    return {
      data: data ?? {},
      error: null,
      successful: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: {},
      error: message,
      successful: false,
    };
  }
}
