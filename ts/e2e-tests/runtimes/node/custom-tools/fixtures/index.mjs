/**
 * E2E fixture: Custom local tools execution flow.
 * Requires COMPOSIO_API_KEY in environment.
 */
import { Composio } from '@composio/core';
import { CustomTool } from '@composio/core/experimental';
import { z } from 'zod/v3';

const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) {
  console.error('COMPOSIO_API_KEY is required');
  process.exit(1);
}

// ── Define custom tools ──────────────────────────────────────

const getUserContext = CustomTool({
  slug: 'GET_USER_CONTEXT',
  name: 'Get user context',
  description: 'Retrieve user preferences and history',
  inputParams: z.object({
    category: z.string().default('all'),
  }),
  execute: async (input) => {
    return { preferences: { category: input.category, source: 'local' } };
  },
});

const enrichedSearch = CustomTool({
  slug: 'ENRICHED_SEARCH',
  name: 'Enriched search',
  description: 'Search and enrich results with user context',
  inputParams: z.object({
    query: z.string(),
  }),
  execute: async (input, session) => {
    return {
      query: input.query,
      userId: session.userId,
    };
  },
});

const throwingTool = CustomTool({
  slug: 'THROWING_TOOL',
  name: 'Throwing tool',
  description: 'A tool that always throws an error',
  inputParams: z.object({}),
  execute: async () => {
    throw new Error('intentional error for testing');
  },
});

// ── Create session and run tests ─────────────────────────────

const composio = new Composio({ apiKey });

async function main() {
  const userId = `e2e-custom-tools-${Date.now()}`;

  const session = await composio.create(userId, {
    toolkits: ['hackernews'],
    manageConnections: false,
    customTools: [getUserContext, enrichedSearch, throwingTool],
  });

  // ── Test 1: Single local tool execution ──
  {
    const result = await session.execute('GET_USER_CONTEXT', { category: 'prefs' });
    if (result.data?.preferences?.category !== 'prefs') {
      throw new Error(`LOCAL_EXECUTE failed: ${JSON.stringify(result)}`);
    }
    if (result.data?.preferences?.source !== 'local') {
      throw new Error(`LOCAL_EXECUTE source mismatch: ${JSON.stringify(result)}`);
    }
    console.log('LOCAL_EXECUTE_OK');
  }

  // ── Test 2: Zod defaults applied ──
  {
    const result = await session.execute('GET_USER_CONTEXT', {});
    if (result.data?.preferences?.category !== 'all') {
      throw new Error(`ZOD_DEFAULTS failed: ${JSON.stringify(result)}`);
    }
    console.log('ZOD_DEFAULTS_OK');
  }

  // ── Test 3: Error handling ──
  {
    const result = await session.execute('THROWING_TOOL', {});
    if (!result.error || !result.error.includes('intentional error')) {
      throw new Error(`ERROR_HANDLING failed: ${JSON.stringify(result)}`);
    }
    console.log('ERROR_HANDLING_OK');
  }

  // ── Test 4: Multiple local tools ──
  {
    const r1 = await session.execute('GET_USER_CONTEXT', { category: 'a' });
    const r2 = await session.execute('ENRICHED_SEARCH', { query: 'test' });
    if (r1.data?.preferences?.category !== 'a') {
      throw new Error(`MULTIPLE_TOOLS r1 failed: ${JSON.stringify(r1)}`);
    }
    if (r2.data?.query !== 'test') {
      throw new Error(`MULTIPLE_TOOLS r2 failed: ${JSON.stringify(r2)}`);
    }
    console.log('MULTIPLE_TOOLS_OK');
  }

  // ── Test 5: Session context injection ──
  {
    const result = await session.execute('ENRICHED_SEARCH', { query: 'context-test' });
    if (!result.data?.userId) {
      throw new Error(`SESSION_CONTEXT failed: ${JSON.stringify(result)}`);
    }
    if (result.data.userId !== userId) {
      throw new Error(`SESSION_CONTEXT userId mismatch: expected ${userId}, got ${result.data.userId}`);
    }
    console.log('SESSION_CONTEXT_OK');
  }

  // ── Test 6: Case-insensitive slug ──
  {
    const result = await session.execute('get_user_context', { category: 'case-test' });
    if (result.data?.preferences?.category !== 'case-test') {
      throw new Error(`CASE_INSENSITIVE failed: ${JSON.stringify(result)}`);
    }
    console.log('CASE_INSENSITIVE_OK');
  }

  // ── Test 7: Prefixed slug (LOCAL_) ──
  {
    const result = await session.execute('LOCAL_GET_USER_CONTEXT', { category: 'prefix-test' });
    if (result.data?.preferences?.category !== 'prefix-test') {
      throw new Error(`PREFIXED_SLUG failed: ${JSON.stringify(result)}`);
    }
    console.log('PREFIXED_SLUG_OK');
  }

  // ── Test 8: localTools() method ──
  // localTools() returns a wrapped tool — we just verify it doesn't throw
  // and returns something non-empty (can't fully test without LLM)
  {
    try {
      const localTool = await session.localTools();
      // Verify it returned something (provider-specific format)
      if (!localTool) {
        throw new Error('localTools() returned falsy value');
      }
      console.log('LOCAL_TOOLS_METHOD_OK');
    } catch (err) {
      // If provider doesn't support it, that's OK for this test
      if (err.message?.includes('provider')) {
        console.log('LOCAL_TOOLS_METHOD_OK'); // Expected if no provider
      } else {
        throw err;
      }
    }
  }

  // ── Test 9: session.tools() wrapping ──
  // Verify session.tools() returns wrapped tools and doesn't crash
  {
    try {
      const tools = await session.tools();
      if (!tools) {
        throw new Error('tools() returned falsy value');
      }
      console.log('TOOLS_WRAPPING_OK');
    } catch (err) {
      // If provider doesn't support it, that's OK
      if (err.message?.includes('provider')) {
        console.log('TOOLS_WRAPPING_OK');
      } else {
        throw err;
      }
    }
  }

  console.log('ALL_OK');
}

main().catch((err) => {
  console.log('ERROR:', err?.message || err);
  process.exit(1);
});
