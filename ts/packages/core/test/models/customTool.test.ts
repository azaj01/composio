import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v3';
import { createCustomTool, buildLocalToolsMap, serializeLocalTools, LOCAL_TOOL_PREFIX } from '../../src/models/CustomTool';
import { SessionContextImpl } from '../../src/models/SessionContext';
import type { CustomTool, SessionContext } from '../../src/types/customTool.types';

// ────────────────────────────────────────────────────────────────
// createCustomTool() factory
// ────────────────────────────────────────────────────────────────

describe('createCustomTool', () => {
  const baseOptions = {
    slug: 'GET_USER_CONTEXT',
    name: 'Get user context',
    description: 'Retrieve what we know about a user',
    inputParams: z.object({
      category: z.string().describe('The category'),
    }),
    execute: vi.fn().mockResolvedValue({ result: 'ok' }),
  };

  it('should return a valid tool with correct fields', () => {
    const tool = createCustomTool(baseOptions);

    expect(tool.slug).toBe('GET_USER_CONTEXT');
    expect(tool.name).toBe('Get user context');
    expect(tool.description).toBe('Retrieve what we know about a user');
    expect(tool.toolkit).toBeUndefined();
    expect(tool.execute).toBe(baseOptions.execute);
    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        category: { type: 'string', description: 'The category' },
      },
      required: ['category'],
    });
    expect(tool.inputParams).toBe(baseOptions.inputParams);
  });

  it('should include toolkit when provided', () => {
    const tool = createCustomTool({ ...baseOptions, toolkit: 'meta_ads' });
    expect(tool.toolkit).toBe('meta_ads');
  });

  it('should convert Zod schema with optional fields correctly', () => {
    const tool = createCustomTool({
      ...baseOptions,
      inputParams: z.object({
        required_field: z.string(),
        optional_field: z.number().optional(),
      }),
    });

    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'number' },
      },
      required: ['required_field'],
    });
  });

  it('should convert Zod schema with defaults correctly', () => {
    const tool = createCustomTool({
      ...baseOptions,
      inputParams: z.object({
        category: z.string().default('all'),
      }),
    });

    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        category: expect.objectContaining({ type: 'string' }),
      },
    });
  });

  describe('validation', () => {
    it('should throw if slug is missing', () => {
      expect(() => createCustomTool({ ...baseOptions, slug: '' })).toThrow('slug is required');
    });

    it('should throw if slug starts with LOCAL_ prefix', () => {
      expect(() => createCustomTool({ ...baseOptions, slug: 'LOCAL_MY_TOOL' })).toThrow(
        /LOCAL_/
      );
    });

    it('should throw if slug starts with local_ prefix (case-insensitive)', () => {
      expect(() => createCustomTool({ ...baseOptions, slug: 'local_something' })).toThrow(
        /LOCAL_/
      );
    });

    it('should throw if name is missing', () => {
      expect(() => createCustomTool({ ...baseOptions, name: '' })).toThrow('name is required');
    });

    it('should throw if description is missing', () => {
      expect(() => createCustomTool({ ...baseOptions, description: '' })).toThrow(
        'description is required'
      );
    });

    it('should throw if inputParams is missing', () => {
      expect(() => createCustomTool({ ...baseOptions, inputParams: null as any })).toThrow(
        'inputParams is required'
      );
    });

    it('should throw if execute is not a function', () => {
      expect(() => createCustomTool({ ...baseOptions, execute: 'not-fn' as any })).toThrow(
        'execute must be a function'
      );
    });
  });

  describe('execute function signatures', () => {
    it('should allow no-session execute (input only)', async () => {
      const noSessionExecute = vi.fn().mockResolvedValue({ result: 42 });

      const tool = createCustomTool({
        ...baseOptions,
        execute: noSessionExecute,
      });

      // Call without session — JS ignores extra params
      const result = await tool.execute({ category: 'test' } as any);
      expect(result.result).toBe(42);
      expect(noSessionExecute).toHaveBeenCalledWith({ category: 'test' });
    });

    it('should allow session-based execute (input + session)', async () => {
      const sessionExecute = vi.fn().mockResolvedValue({ userId: 'u1' });

      const tool = createCustomTool({
        ...baseOptions,
        execute: sessionExecute,
      });

      const mockSession: SessionContext = {
        userId: 'user_1',
        execute: vi.fn(),
        proxyExecute: vi.fn(),
      };

      const result = await tool.execute({ category: 'test' }, mockSession);
      expect(result.userId).toBe('u1');
      expect(sessionExecute).toHaveBeenCalledWith({ category: 'test' }, mockSession);
    });
  });
});

// ────────────────────────────────────────────────────────────────
// buildLocalToolsMap()
// ────────────────────────────────────────────────────────────────

describe('buildLocalToolsMap', () => {
  const makeTool = (slug: string): CustomTool => ({
    slug,
    name: `Tool ${slug}`,
    description: `Description for ${slug}`,
    inputSchema: { type: 'object', properties: {} },
    inputParams: z.object({}),
    execute: vi.fn(),
  });

  it('should create maps with both prefixed and original slug keys', () => {
    const tools = [makeTool('MY_TOOL'), makeTool('OTHER_TOOL')];
    const map = buildLocalToolsMap(tools);

    expect(map.byPrefixed.size).toBe(2);
    expect(map.byOriginal.size).toBe(2);

    // Prefixed lookup
    expect(map.byPrefixed.has('LOCAL_MY_TOOL')).toBe(true);
    expect(map.byPrefixed.has('LOCAL_OTHER_TOOL')).toBe(true);

    // Original lookup
    expect(map.byOriginal.has('MY_TOOL')).toBe(true);
    expect(map.byOriginal.has('OTHER_TOOL')).toBe(true);
  });

  it('should handle case-insensitive slugs (uppercased internally)', () => {
    const tool = makeTool('my_tool');
    const map = buildLocalToolsMap([tool]);

    expect(map.byOriginal.has('MY_TOOL')).toBe(true);
    expect(map.byPrefixed.has('LOCAL_MY_TOOL')).toBe(true);
  });

  it('should throw on duplicate slugs', () => {
    const tools = [makeTool('DUPE'), makeTool('DUPE')];
    expect(() => buildLocalToolsMap(tools)).toThrow('duplicate slug "DUPE"');
  });

});

// ────────────────────────────────────────────────────────────────
// serializeLocalTools()
// ────────────────────────────────────────────────────────────────

describe('serializeLocalTools', () => {
  it('should serialize tools into backend format', () => {
    const tool: CustomTool = {
      slug: 'GET_DATA',
      name: 'Get Data',
      description: 'Gets some data',
      toolkit: 'my_toolkit',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      inputParams: z.object({ id: z.string() }),
      execute: vi.fn(),
    };

    const result = serializeLocalTools([tool]);

    expect(result).toEqual([
      {
        slug: 'GET_DATA',
        name: 'Get Data',
        description: 'Gets some data',
        toolkit: 'my_toolkit',
        input_schema: { type: 'object', properties: { id: { type: 'string' } } },
      },
    ]);
  });

  it('should omit toolkit when not provided', () => {
    const tool: CustomTool = {
      slug: 'NO_TOOLKIT',
      name: 'No Toolkit',
      description: 'No toolkit tool',
      inputSchema: { type: 'object', properties: {} },
      inputParams: z.object({}),
      execute: vi.fn(),
    };

    const result = serializeLocalTools([tool]);
    expect(result[0]).not.toHaveProperty('toolkit');
  });
});

// ────────────────────────────────────────────────────────────────
// SessionContextImpl
// ────────────────────────────────────────────────────────────────

describe('SessionContextImpl', () => {
  const mockClient = {
    toolRouter: {
      session: {
        execute: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose userId', () => {
    const ctx = new SessionContextImpl(mockClient as any, 'user_1', 'sess_1');
    expect(ctx.userId).toBe('user_1');
  });

  it('should delegate execute() to client.toolRouter.session.execute()', async () => {
    mockClient.toolRouter.session.execute.mockResolvedValue({
      data: { result: 'ok' },
      error: null,
      log_id: 'log_1',
    });

    const ctx = new SessionContextImpl(mockClient as any, 'user_1', 'sess_1');
    const result = await ctx.execute('GMAIL_SEND_EMAIL', { to: 'test@test.com' });

    expect(mockClient.toolRouter.session.execute).toHaveBeenCalledWith('sess_1', {
      tool_slug: 'GMAIL_SEND_EMAIL',
      arguments: { to: 'test@test.com' },
    });
    expect(result).toEqual({
      data: { result: 'ok' },
      error: null,
      successful: true,
    });
  });

  it('should set successful=false when execute() returns an error', async () => {
    mockClient.toolRouter.session.execute.mockResolvedValue({
      data: {},
      error: 'something went wrong',
      log_id: 'log_2',
    });

    const ctx = new SessionContextImpl(mockClient as any, 'user_1', 'sess_1');
    const result = await ctx.execute('BAD_TOOL', {});

    expect(result.successful).toBe(false);
    expect(result.error).toBe('something went wrong');
  });

  it('should throw on proxyExecute() (not yet implemented)', async () => {
    const ctx = new SessionContextImpl(mockClient as any, 'user_1', 'sess_1');
    await expect(
      ctx.proxyExecute({ endpoint: '/test', method: 'GET' })
    ).rejects.toThrow('proxyExecute is not yet implemented');
  });
});
