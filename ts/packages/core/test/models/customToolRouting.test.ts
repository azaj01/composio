import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v3';
import { ToolRouter } from '../../src/models/ToolRouter';
import { ToolRouterSession } from '../../src/models/ToolRouterSession';
import { CustomTool, buildLocalToolsMap } from '../../src/models/CustomTool';
import { MockProvider } from '../utils/mocks/provider.mock';
import ComposioClient from '@composio/client';
import { Tools } from '../../src/models/Tools';
import type { CustomToolHandle } from '../../src/types/customTool.types';

// Mock telemetry
vi.mock('../../src/telemetry/Telemetry', () => ({
  telemetry: { instrument: vi.fn() },
}));

// Mock Tools class
vi.mock('../../src/models/Tools', () => ({
  Tools: vi.fn().mockImplementation(() => ({
    getRawToolRouterMetaTools: vi.fn().mockResolvedValue([
      { slug: 'COMPOSIO_SEARCH_TOOLS', name: 'Search Tools' },
      { slug: 'COMPOSIO_MULTI_EXECUTE_TOOL', name: 'Multi Execute' },
    ]),
    wrapToolsForToolRouter: vi.fn().mockReturnValue('wrapped-tools'),
    executeMetaTool: vi.fn().mockResolvedValue({
      data: { remote: true },
      error: null,
      successful: true,
    }),
  })),
}));

// ── Fixtures ─────────────────────────────────────────────────────

const createMockClient = () => ({
  baseURL: 'https://api.composio.dev',
  apiKey: 'test-api-key',
  toolRouter: {
    session: {
      create: vi.fn().mockResolvedValue({
        session_id: 'sess_123',
        mcp: { type: 'http', url: 'https://mcp.example.com/sess_123' },
        tool_router_tools: [],
      }),
      retrieve: vi.fn(),
      link: vi.fn(),
      toolkits: vi.fn(),
      executeMeta: vi.fn(),
      search: vi.fn(),
      execute: vi.fn().mockResolvedValue({
        data: { remote_result: true },
        error: null,
        log_id: 'log_remote',
      }),
      tools: vi.fn(),
    },
  },
  tools: {
    list: vi.fn(),
    retrieve: vi.fn(),
    execute: vi.fn(),
    proxy: vi.fn(),
  },
});

const localExecute = vi.fn().mockResolvedValue({
  data: { local_result: true },
  error: null,
  successful: true,
});

const customToolHandle = CustomTool({
  slug: 'GET_USER_CONTEXT',
  name: 'Get user context',
  description: 'Retrieve user preferences',
  inputParams: z.object({ category: z.string() }),
  execute: localExecute,
});

const sessionExecute = vi.fn().mockImplementation(async (input: any, session: any) => ({
  data: { userId: session.userId },
  error: null,
  successful: true,
}));

const sessionToolHandle = CustomTool({
  slug: 'GET_AD_ACCOUNTS',
  name: 'Get ad accounts',
  description: 'Get ad account IDs',
  toolkit: 'meta_ads',
  inputParams: z.object({ fields: z.string() }),
  execute: sessionExecute,
});

// ────────────────────────────────────────────────────────────────
// ToolRouter.create() with customTools
// ────────────────────────────────────────────────────────────────

describe('ToolRouter.create() with customTools', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let router: ToolRouter<unknown, unknown, MockProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    router = new ToolRouter(mockClient as unknown as ComposioClient, {
      apiKey: 'test-key',
      provider: new MockProvider(),
    });
  });

  it('should send local_tools in the create payload', async () => {
    await router.create('user_1', {
      toolkits: ['gmail'],
      customTools: [customToolHandle],
    });

    const payload = mockClient.toolRouter.session.create.mock.calls[0][0];
    expect(payload.local_tools).toEqual([
      {
        slug: 'GET_USER_CONTEXT',
        name: 'Get user context',
        description: 'Retrieve user preferences',
        input_schema: customToolHandle.inputSchema,
      },
    ]);
  });

  it('should include toolkit in local_tools when present', async () => {
    await router.create('user_1', {
      customTools: [sessionToolHandle],
    });

    const payload = mockClient.toolRouter.session.create.mock.calls[0][0];
    expect(payload.local_tools[0].toolkit).toBe('meta_ads');
  });

  it('should not send local_tools when customTools is omitted', async () => {
    await router.create('user_1', { toolkits: ['gmail'] });

    const payload = mockClient.toolRouter.session.create.mock.calls[0][0];
    expect(payload.local_tools).toBeUndefined();
  });

  it('should not send local_tools when customTools is empty', async () => {
    await router.create('user_1', { customTools: [] });

    const payload = mockClient.toolRouter.session.create.mock.calls[0][0];
    expect(payload.local_tools).toBeUndefined();
  });

  it('should return a session with the correct sessionId', async () => {
    const session = await router.create('user_1', {
      customTools: [customToolHandle],
    });

    expect(session.sessionId).toBe('sess_123');
  });
});

// ────────────────────────────────────────────────────────────────
// ToolRouterSession — execution routing
// ────────────────────────────────────────────────────────────────

describe('ToolRouterSession execution routing', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  const createSession = (
    client: ReturnType<typeof createMockClient>,
    customTools: CustomToolHandle[] = []
  ) => {
    const localToolsMap = customTools.length ? buildLocalToolsMap(customTools) : undefined;

    return new ToolRouterSession(
      client as unknown as ComposioClient,
      { apiKey: 'key', provider: new MockProvider() },
      'sess_123',
      { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
      undefined,
      localToolsMap,
      'user_1'
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    localExecute.mockClear();
    sessionExecute.mockClear();
  });

  describe('session.execute() routing', () => {
    it('should route local tool by original slug to in-process execution', async () => {
      const session = createSession(mockClient, [customToolHandle]);

      const result = await session.execute('GET_USER_CONTEXT', { category: 'prefs' });

      expect(result.data).toEqual({ local_result: true });
      expect(result.logId).toBe('local');
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'prefs' },
        expect.objectContaining({ userId: 'user_1', sessionId: 'sess_123' })
      );
      // Should NOT call remote
      expect(mockClient.toolRouter.session.execute).not.toHaveBeenCalled();
    });

    it('should route local tool by prefixed slug to in-process execution', async () => {
      const session = createSession(mockClient, [customToolHandle]);

      const result = await session.execute('LOCAL_GET_USER_CONTEXT', { category: 'all' });

      expect(result.data).toEqual({ local_result: true });
      expect(localExecute).toHaveBeenCalled();
      expect(mockClient.toolRouter.session.execute).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for local tool lookup', async () => {
      const session = createSession(mockClient, [customToolHandle]);

      const result = await session.execute('get_user_context', { category: 'test' });

      expect(result.data).toEqual({ local_result: true });
    });

    it('should route non-local tool to remote execution', async () => {
      const session = createSession(mockClient, [customToolHandle]);

      await session.execute('GMAIL_SEND_EMAIL', { to: 'test@test.com' });

      expect(mockClient.toolRouter.session.execute).toHaveBeenCalledWith('sess_123', {
        tool_slug: 'GMAIL_SEND_EMAIL',
        arguments: { to: 'test@test.com' },
      });
      expect(localExecute).not.toHaveBeenCalled();
    });

    it('should route all tools to remote when no customTools are bound', async () => {
      const session = createSession(mockClient);

      await session.execute('GET_USER_CONTEXT', { category: 'test' });

      expect(mockClient.toolRouter.session.execute).toHaveBeenCalled();
      expect(localExecute).not.toHaveBeenCalled();
    });
  });

  describe('session.execute() — SessionContext injection', () => {
    it('should inject SessionContext with correct userId and sessionId', async () => {
      const session = createSession(mockClient, [sessionToolHandle]);

      await session.execute('GET_AD_ACCOUNTS', { fields: 'id' });

      expect(sessionExecute).toHaveBeenCalledWith(
        { fields: 'id' },
        expect.objectContaining({
          userId: 'user_1',
          sessionId: 'sess_123',
        })
      );
    });

    it('should provide a working execute() on SessionContext', async () => {
      // Tool that calls another tool via session.execute()
      const chainedExecute = vi.fn().mockImplementation(async (input: any, session: any) => {
        const inner = await session.execute('GMAIL_SEND_EMAIL', { to: input.to });
        return { data: { inner_result: inner.data }, error: null, successful: true };
      });

      const chainedTool = CustomTool({
        slug: 'CHAINED_TOOL',
        name: 'Chained',
        description: 'Calls another tool',
        inputParams: z.object({ to: z.string() }),
        execute: chainedExecute,
      });

      const session = createSession(mockClient, [chainedTool]);
      await session.execute('CHAINED_TOOL', { to: 'test@test.com' });

      // The chained tool should have called session.execute, which calls the API
      expect(mockClient.toolRouter.session.execute).toHaveBeenCalledWith('sess_123', {
        tool_slug: 'GMAIL_SEND_EMAIL',
        arguments: { to: 'test@test.com' },
      });
    });
  });

  describe('session.execute() — error handling', () => {
    it('should catch errors thrown by execute function and return error response', async () => {
      const throwingTool = CustomTool({
        slug: 'THROWING_TOOL',
        name: 'Throwing',
        description: 'Throws an error',
        inputParams: z.object({}),
        execute: async () => {
          throw new Error('boom');
        },
      });

      const session = createSession(mockClient, [throwingTool]);
      const result = await session.execute('THROWING_TOOL', {});

      expect(result.error).toBe('boom');
      expect(result.data).toEqual({});
    });

    it('should handle non-Error throws gracefully', async () => {
      const throwingTool = CustomTool({
        slug: 'STRING_THROW',
        name: 'String throw',
        description: 'Throws a string',
        inputParams: z.object({}),
        execute: async () => {
          throw 'string error';
        },
      });

      const session = createSession(mockClient, [throwingTool]);
      const result = await session.execute('STRING_THROW', {});

      expect(result.error).toBe('string error');
    });
  });

  describe('session.tools() — COMPOSIO_MULTI_EXECUTE_TOOL routing', () => {
    it('should route local tools via COMPOSIO_MULTI_EXECUTE_TOOL to in-process execution', async () => {
      const provider = new MockProvider();
      // Mock wrapTools to capture the execute function and call it
      provider.wrapTools.mockImplementation((tools: any, executeFn: any) => {
        // Store executeFn so we can call it
        (provider as any)._capturedExecuteFn = executeFn;
        return 'wrapped-tools-with-routing';
      });

      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key', provider },
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
        undefined,
        buildLocalToolsMap([customToolHandle]),
        'user_1'
      );

      await session.tools();

      // Now simulate the LLM calling COMPOSIO_MULTI_EXECUTE_TOOL with a local tool
      const executeFn = (provider as any)._capturedExecuteFn;
      expect(executeFn).toBeDefined();

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tool_slug: 'LOCAL_GET_USER_CONTEXT',
        arguments: { category: 'test' },
      });

      expect(result.data).toEqual({ local_result: true });
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'test' },
        expect.objectContaining({ userId: 'user_1', sessionId: 'sess_123' })
      );
    });

    it('should route remote tools via COMPOSIO_MULTI_EXECUTE_TOOL to backend', async () => {
      const provider = new MockProvider();
      provider.wrapTools.mockImplementation((tools: any, executeFn: any) => {
        (provider as any)._capturedExecuteFn = executeFn;
        return 'wrapped';
      });

      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key', provider },
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
        undefined,
        buildLocalToolsMap([customToolHandle]),
        'user_1'
      );

      await session.tools();

      const executeFn = (provider as any)._capturedExecuteFn;
      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tool_slug: 'GMAIL_SEND_EMAIL',
        arguments: { to: 'test@test.com' },
      });

      // Should have gone to remote via executeMetaTool
      expect(result.data).toEqual({ remote: true });
      expect(localExecute).not.toHaveBeenCalled();
    });

    it('should route non-MULTI_EXECUTE meta tools to backend', async () => {
      const provider = new MockProvider();
      provider.wrapTools.mockImplementation((tools: any, executeFn: any) => {
        (provider as any)._capturedExecuteFn = executeFn;
        return 'wrapped';
      });

      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key', provider },
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
        undefined,
        buildLocalToolsMap([customToolHandle]),
        'user_1'
      );

      await session.tools();

      const executeFn = (provider as any)._capturedExecuteFn;
      const result = await executeFn('COMPOSIO_SEARCH_TOOLS', {
        queries: [{ use_case: 'send email' }],
      });

      // COMPOSIO_SEARCH_TOOLS always goes remote
      expect(result.data).toEqual({ remote: true });
    });

    it('should use standard wrapToolsForToolRouter when no local tools', async () => {
      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key', provider: new MockProvider() },
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' }
        // No localToolsMap, no userId
      );

      const result = await session.tools();

      // Should use the standard path
      expect(result).toBe('wrapped-tools');
    });
  });

  describe('multiple custom tools', () => {
    it('should route each tool to its correct execute function', async () => {
      const session = createSession(mockClient, [customToolHandle, sessionToolHandle]);

      // First tool
      await session.execute('GET_USER_CONTEXT', { category: 'prefs' });
      expect(localExecute).toHaveBeenCalled();
      expect(sessionExecute).not.toHaveBeenCalled();

      localExecute.mockClear();

      // Second tool
      await session.execute('GET_AD_ACCOUNTS', { fields: 'id' });
      expect(sessionExecute).toHaveBeenCalled();
      expect(localExecute).not.toHaveBeenCalled();
    });
  });
});
