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

// Execute returns data directly (simplified API)
const localExecute = vi.fn().mockResolvedValue({ local_result: true });

const customToolHandle = CustomTool({
  slug: 'GET_USER_CONTEXT',
  name: 'Get user context',
  description: 'Retrieve user preferences',
  inputParams: z.object({ category: z.string() }),
  execute: localExecute,
});

const sessionExecute = vi.fn().mockImplementation(async (input: any, session: any) => ({
  userId: session.userId,
}));

const sessionToolHandle = CustomTool({
  slug: 'GET_AD_ACCOUNTS',
  name: 'Get ad accounts',
  description: 'Get ad account IDs',
  connectedToolkit: 'meta_ads',
  inputParams: z.object({ fields: z.string() }),
  execute: sessionExecute,
});

// ── Shared helpers for provider-aware session tests ────────────

const createSessionWithProvider = (
  client: ReturnType<typeof createMockClient>,
  provider: MockProvider,
  customTools: CustomToolHandle[]
) => {
  return new ToolRouterSession(
    client as unknown as ComposioClient,
    { apiKey: 'key', provider },
    'sess_123',
    { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
    undefined,
    buildLocalToolsMap(customTools),
    'user_1'
  );
};

const captureExecuteFn = (provider: MockProvider) => {
  provider.wrapTools.mockImplementation((tools: any, executeFn: any) => {
    (provider as any)._capturedExecuteFn = executeFn;
    (provider as any)._capturedTools = tools;
    return 'wrapped-tools-with-routing';
  });
};

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

  it('should include toolkit in local_tools when connectedToolkit is present', async () => {
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

      // User returns data directly, SDK wraps it
      expect(result.data).toEqual({ local_result: true });
      expect(result.logId).toBe('local');
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'prefs' },
        expect.objectContaining({ userId: 'user_1' })
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
    it('should inject SessionContext with correct userId', async () => {
      const session = createSession(mockClient, [sessionToolHandle]);

      await session.execute('GET_AD_ACCOUNTS', { fields: 'id' });

      expect(sessionExecute).toHaveBeenCalledWith(
        { fields: 'id' },
        expect.objectContaining({
          userId: 'user_1',
        })
      );
    });

    it('should provide a working execute() on SessionContext', async () => {
      // Tool that calls another tool via session.execute()
      const chainedExecute = vi.fn().mockImplementation(async (input: any, session: any) => {
        const inner = await session.execute('GMAIL_SEND_EMAIL', { to: input.to });
        return { inner_result: inner.data };
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

    it('should apply Zod defaults when input is missing optional fields', async () => {
      const defaultExecute = vi.fn().mockImplementation(async (input: any) => ({
        category: input.category,
      }));

      const toolWithDefaults = CustomTool({
        slug: 'DEFAULTS_TOOL',
        name: 'Defaults',
        description: 'Tool with default values',
        inputParams: z.object({ category: z.string().default('all') }),
        execute: defaultExecute,
      });

      const session = createSession(mockClient, [toolWithDefaults]);
      const result = await session.execute('DEFAULTS_TOOL', {});

      // Zod default should be applied
      expect(defaultExecute).toHaveBeenCalledWith(
        { category: 'all' },
        expect.anything()
      );
      expect(result.data).toEqual({ category: 'all' });
    });

    it('should return validation error for invalid input', async () => {
      const strictTool = CustomTool({
        slug: 'STRICT_TOOL',
        name: 'Strict',
        description: 'Tool with strict input',
        inputParams: z.object({ count: z.number() }),
        execute: vi.fn(),
      });

      const session = createSession(mockClient, [strictTool]);
      const result = await session.execute('STRICT_TOOL', { count: 'not-a-number' });

      expect(result.error).toContain('Input validation failed');
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

  describe('session.tools() — COMPOSIO_MULTI_EXECUTE_TOOL routing with tools[] array', () => {
    it('should route all-local tools[] to in-process execution', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'test' } },
        ],
        sync_response_to_workbench: false,
      });

      expect(result.data).toEqual({ local_result: true });
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'test' },
        expect.objectContaining({ userId: 'user_1' })
      );
    });

    it('should route local tool by non-prefixed slug in multi-execute', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'GET_USER_CONTEXT', arguments: { category: 'no-prefix' } },
        ],
        sync_response_to_workbench: false,
      });

      expect(result.data).toEqual({ local_result: true });
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'no-prefix' },
        expect.objectContaining({ userId: 'user_1' })
      );
    });

    it('should route all-remote tools[] to backend', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'test@test.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // All remote — goes to executeMetaTool
      expect(result.data).toEqual({ remote: true });
      expect(localExecute).not.toHaveBeenCalled();
    });

    it('should split mixed local+remote tools and merge results', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();

      // Re-mock executeMetaTool after session.tools() created the Tools instance
      const latestToolsInstance = (Tools as any).mock.results[
        (Tools as any).mock.results.length - 1
      ].value;
      latestToolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: { GMAIL_SEND_EMAIL: { messageId: 'msg_1' } },
        error: null,
        successful: true,
      });

      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'prefs' } },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'test@test.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // Both should have been called
      expect(localExecute).toHaveBeenCalled();
      // Remote goes to backend — merged results keyed by slug
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
      expect(result.data).toHaveProperty('GMAIL_SEND_EMAIL');
      expect(result.data.GMAIL_SEND_EMAIL).toEqual({ messageId: 'msg_1' });
    });

    it('should route non-MULTI_EXECUTE meta tools to backend', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

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

  describe('COMPOSIO_MULTI_EXECUTE_TOOL — detailed split/merge behavior', () => {
    /** Helper: set up provider + session + capture executeFn + get latest Tools mock */
    const setupMultiExecute = async (
      client: ReturnType<typeof createMockClient>,
      customTools: CustomToolHandle[]
    ) => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(client, provider, customTools);
      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;
      const toolsInstance = (Tools as any).mock.results[
        (Tools as any).mock.results.length - 1
      ].value;
      return { executeFn, toolsInstance, provider, session };
    };

    it('should only send remote items in the backend payload (not local ones)', async () => {
      const { executeFn, toolsInstance } = await setupMultiExecute(mockClient, [customToolHandle]);

      toolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: { GMAIL_SEND_EMAIL: { sent: true } },
        error: null,
        successful: true,
      });

      await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'a' } },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'x@y.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // Backend should only receive the remote tool
      const metaCall = toolsInstance.executeMetaTool.mock.calls[0];
      const backendTools = metaCall[1].arguments.tools;
      expect(backendTools).toHaveLength(1);
      expect(backendTools[0].tool_slug).toBe('GMAIL_SEND_EMAIL');
    });

    it('should merge results with remote keys first, local keys last', async () => {
      const { executeFn, toolsInstance } = await setupMultiExecute(mockClient, [customToolHandle]);

      toolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: { GMAIL_SEND_EMAIL: { sent: true } },
        error: null,
        successful: true,
      });

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'a' } },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'x@y.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // Verify ordering: remote keys come before local keys
      const keys = Object.keys(result.data);
      const remoteIdx = keys.indexOf('GMAIL_SEND_EMAIL');
      const localIdx = keys.indexOf('LOCAL_GET_USER_CONTEXT');
      expect(remoteIdx).toBeLessThan(localIdx);
    });

    it('should handle multiple local tools in same batch', async () => {
      const { executeFn } = await setupMultiExecute(mockClient, [customToolHandle, sessionToolHandle]);

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'batch' } },
          { tool_slug: 'LOCAL_GET_AD_ACCOUNTS', arguments: { fields: 'id,name' } },
        ],
        sync_response_to_workbench: false,
      });

      expect(localExecute).toHaveBeenCalledWith(
        { category: 'batch' },
        expect.objectContaining({ userId: 'user_1' })
      );
      expect(sessionExecute).toHaveBeenCalledWith(
        { fields: 'id,name' },
        expect.objectContaining({ userId: 'user_1' })
      );
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
      expect(result.data).toHaveProperty('LOCAL_GET_AD_ACCOUNTS');
    });

    it('should handle mixed batch with multiple locals + multiple remotes', async () => {
      const { executeFn, toolsInstance } = await setupMultiExecute(
        mockClient,
        [customToolHandle, sessionToolHandle]
      );

      toolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: {
          GMAIL_SEND_EMAIL: { sent: true },
          SLACK_POST_MESSAGE: { ts: '999' },
        },
        error: null,
        successful: true,
      });

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'x' } },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'a@b.com' } },
          { tool_slug: 'LOCAL_GET_AD_ACCOUNTS', arguments: { fields: 'id' } },
          { tool_slug: 'SLACK_POST_MESSAGE', arguments: { channel: '#dev' } },
        ],
        sync_response_to_workbench: false,
      });

      // All 4 tools should appear in result
      expect(Object.keys(result.data)).toHaveLength(4);
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
      expect(result.data).toHaveProperty('LOCAL_GET_AD_ACCOUNTS');
      expect(result.data).toHaveProperty('GMAIL_SEND_EMAIL');
      expect(result.data).toHaveProperty('SLACK_POST_MESSAGE');

      // Backend only got the 2 remote tools
      const backendTools = toolsInstance.executeMetaTool.mock.calls[0][1].arguments.tools;
      expect(backendTools).toHaveLength(2);
      expect(backendTools.map((t: any) => t.tool_slug)).toEqual([
        'GMAIL_SEND_EMAIL',
        'SLACK_POST_MESSAGE',
      ]);

      // Both local execute fns were called
      expect(localExecute).toHaveBeenCalled();
      expect(sessionExecute).toHaveBeenCalled();
    });

    it('should still succeed when one local tool errors in a mixed batch', async () => {
      const throwingHandle = CustomTool({
        slug: 'MIXED_THROWER',
        name: 'Throws in batch',
        description: 'Throws',
        inputParams: z.object({}),
        execute: async () => { throw new Error('batch-boom'); },
      });

      const { executeFn, toolsInstance } = await setupMultiExecute(
        mockClient,
        [customToolHandle, throwingHandle]
      );

      toolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: { GMAIL_SEND_EMAIL: { sent: true } },
        error: null,
        successful: true,
      });

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'ok' } },
          { tool_slug: 'LOCAL_MIXED_THROWER', arguments: {} },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'a@b.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // Successful local tool still has its data
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
      // Throwing tool has empty data
      expect(result.data.LOCAL_MIXED_THROWER).toEqual({});
      // Remote tool still ran
      expect(result.data).toHaveProperty('GMAIL_SEND_EMAIL');
      // Error is surfaced
      expect(result.error).toBe('batch-boom');
      expect(result.successful).toBe(false);
    });

    it('should forward to backend when tools array is empty', async () => {
      const { executeFn, toolsInstance } = await setupMultiExecute(mockClient, [customToolHandle]);

      await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [],
        sync_response_to_workbench: false,
      });

      // Empty array → fallback to backend with full original input
      expect(toolsInstance.executeMetaTool).toHaveBeenCalledWith(
        'COMPOSIO_MULTI_EXECUTE_TOOL',
        expect.objectContaining({
          sessionId: 'sess_123',
          arguments: expect.objectContaining({ tools: [] }),
        }),
        undefined
      );
    });

    it('should handle non-object items in tools array gracefully', async () => {
      const { executeFn, toolsInstance } = await setupMultiExecute(mockClient, [customToolHandle]);

      toolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: {},
        error: null,
        successful: true,
      });

      // Malformed: string instead of object — should not crash
      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: ['not-an-object', null, { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'ok' } }],
        sync_response_to_workbench: false,
      });

      // The valid local tool should still execute
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'ok' },
        expect.objectContaining({ userId: 'user_1' })
      );
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
    });

    it('should execute local and remote in parallel (not sequentially)', async () => {
      // Track call timing to verify parallelism
      const callOrder: string[] = [];

      const slowLocalHandle = CustomTool({
        slug: 'SLOW_LOCAL',
        name: 'Slow local',
        description: 'Slow',
        inputParams: z.object({}),
        execute: async () => {
          callOrder.push('local-start');
          await new Promise(r => setTimeout(r, 50));
          callOrder.push('local-end');
          return { slow: true };
        },
      });

      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [slowLocalHandle]);
      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;
      const toolsInstance = (Tools as any).mock.results[
        (Tools as any).mock.results.length - 1
      ].value;

      toolsInstance.executeMetaTool.mockImplementation(async () => {
        callOrder.push('remote-start');
        await new Promise(r => setTimeout(r, 50));
        callOrder.push('remote-end');
        return { data: { GMAIL_SEND_EMAIL: { sent: true } }, error: null, successful: true };
      });

      await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_SLOW_LOCAL', arguments: {} },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'x@y.com' } },
        ],
        sync_response_to_workbench: false,
      });

      // Both should start before either ends (parallel execution)
      const localStartIdx = callOrder.indexOf('local-start');
      const remoteStartIdx = callOrder.indexOf('remote-start');
      const localEndIdx = callOrder.indexOf('local-end');
      const remoteEndIdx = callOrder.indexOf('remote-end');

      // Both started
      expect(localStartIdx).toBeGreaterThanOrEqual(0);
      expect(remoteStartIdx).toBeGreaterThanOrEqual(0);
      // Both started before either finished
      expect(Math.max(localStartIdx, remoteStartIdx)).toBeLessThan(
        Math.min(localEndIdx, remoteEndIdx)
      );
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

  describe('remote batch duplication fix — each remote tool gets its own result', () => {
    it('should return per-tool keyed results when multiple remote tools are in a mixed batch', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      // Mock executeMetaTool to return data keyed by slug (like real backend)
      const toolsInstance = (Tools as any).mock.results[
        (Tools as any).mock.results.length - 1
      ]?.value;

      await session.tools();

      // Re-mock executeMetaTool after session.tools() created the Tools instance
      const latestToolsInstance = (Tools as any).mock.results[
        (Tools as any).mock.results.length - 1
      ].value;
      latestToolsInstance.executeMetaTool.mockResolvedValueOnce({
        data: {
          GMAIL_SEND_EMAIL: { message_id: 'msg_1' },
          SLACK_POST_MESSAGE: { ts: '123456' },
        },
        error: null,
        successful: true,
      });

      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: [
          { tool_slug: 'LOCAL_GET_USER_CONTEXT', arguments: { category: 'prefs' } },
          { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { to: 'a@b.com' } },
          { tool_slug: 'SLACK_POST_MESSAGE', arguments: { channel: '#general' } },
        ],
        sync_response_to_workbench: false,
      });

      // Local tool result keyed by its slug
      expect(result.data).toHaveProperty('LOCAL_GET_USER_CONTEXT');
      expect(result.data.LOCAL_GET_USER_CONTEXT).toEqual({ local_result: true });

      // Each remote tool gets its own keyed result, not the entire batch blob
      expect(result.data).toHaveProperty('GMAIL_SEND_EMAIL');
      expect(result.data.GMAIL_SEND_EMAIL).toEqual({ message_id: 'msg_1' });

      expect(result.data).toHaveProperty('SLACK_POST_MESSAGE');
      expect(result.data.SLACK_POST_MESSAGE).toEqual({ ts: '123456' });
    });
  });

  describe('provider guard — session.tools() throws without provider', () => {
    it('should throw when provider is not configured but local tools exist', async () => {
      const localToolsMap = buildLocalToolsMap([customToolHandle]);

      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key' } as any, // no provider
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' },
        undefined,
        localToolsMap,
        'user_1'
      );

      await expect(session.tools()).rejects.toThrow(
        'A provider is required when using custom tools with session.tools()'
      );
    });
  });

  describe('localTools() method', () => {
    it('should return wrapped tools with COMPOSIO_EXECUTE_LOCAL_TOOL slug', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      const result = await session.localTools();

      expect(result).toBe('wrapped-tools-with-routing');
      expect(provider.wrapTools).toHaveBeenCalled();

      const tools = (provider as any)._capturedTools;
      expect(tools).toHaveLength(1);
      expect(tools[0].slug).toBe('COMPOSIO_EXECUTE_LOCAL_TOOL');
    });

    it('should route to local tool correctly when executing via localTools()', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.localTools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_EXECUTE_LOCAL_TOOL', {
        tool_slug: 'LOCAL_GET_USER_CONTEXT',
        arguments: { category: 'test' },
      });

      expect(result.data).toEqual({ local_result: true });
      expect(result.successful).toBe(true);
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'test' },
        expect.objectContaining({ userId: 'user_1' })
      );
    });

    it('should return error when executing with invalid slug via localTools()', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.localTools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_EXECUTE_LOCAL_TOOL', {
        tool_slug: 'NON_EXISTENT_TOOL',
        arguments: {},
      });

      expect(result.successful).toBe(false);
      expect(result.error).toContain('Local tool "NON_EXISTENT_TOOL" not found');
      expect(result.data).toEqual({});
    });

    it('should throw when calling localTools() without custom tools', async () => {
      const session = new ToolRouterSession(
        mockClient as unknown as ComposioClient,
        { apiKey: 'key', provider: new MockProvider() },
        'sess_123',
        { type: 'http' as const, url: 'https://mcp.example.com/sess_123' }
        // No localToolsMap, no userId
      );

      await expect(session.localTools()).rejects.toThrow(
        'No custom tools are bound to this session.'
      );
    });
  });

  describe('COMPOSIO_EXECUTE_LOCAL_TOOL interception in routing', () => {
    it('should route COMPOSIO_EXECUTE_LOCAL_TOOL to the correct local tool via session.tools() routing', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_EXECUTE_LOCAL_TOOL', {
        tool_slug: 'LOCAL_GET_USER_CONTEXT',
        arguments: { category: 'routing-test' },
      });

      expect(result.data).toEqual({ local_result: true });
      expect(result.successful).toBe(true);
      expect(localExecute).toHaveBeenCalledWith(
        { category: 'routing-test' },
        expect.objectContaining({ userId: 'user_1' })
      );
      // Should NOT call remote
      expect(mockClient.toolRouter.session.execute).not.toHaveBeenCalled();
    });

    it('should return error for COMPOSIO_EXECUTE_LOCAL_TOOL with unknown slug', async () => {
      const provider = new MockProvider();
      captureExecuteFn(provider);
      const session = createSessionWithProvider(mockClient, provider, [customToolHandle]);

      await session.tools();
      const executeFn = (provider as any)._capturedExecuteFn;

      const result = await executeFn('COMPOSIO_EXECUTE_LOCAL_TOOL', {
        tool_slug: 'DOES_NOT_EXIST',
        arguments: {},
      });

      expect(result.successful).toBe(false);
      expect(result.error).toContain('Local tool "DOES_NOT_EXIST" not found');
      expect(result.data).toEqual({});
    });
  });
});
