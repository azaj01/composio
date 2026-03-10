import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v3';
import { CustomTool, buildLocalToolsMap, serializeLocalTools, LOCAL_TOOL_PREFIX } from '../../src/models/CustomTool';
import { SessionContextImpl } from '../../src/models/SessionContext';
import type { CustomToolHandle, SessionContext } from '../../src/types/customTool.types';

// ────────────────────────────────────────────────────────────────
// CustomTool() factory
// ────────────────────────────────────────────────────────────────

describe('CustomTool', () => {
  const baseOptions = {
    slug: 'GET_USER_CONTEXT',
    name: 'Get user context',
    description: 'Retrieve what we know about a user',
    inputParams: z.object({
      category: z.string().describe('The category'),
    }),
    execute: vi.fn().mockResolvedValue({
      data: { result: 'ok' },
      error: null,
      successful: true,
    }),
  };

  it('should return a valid handle with correct fields', () => {
    const handle = CustomTool(baseOptions);

    expect(handle.slug).toBe('GET_USER_CONTEXT');
    expect(handle.name).toBe('Get user context');
    expect(handle.description).toBe('Retrieve what we know about a user');
    expect(handle.toolkit).toBeUndefined();
    expect(handle.execute).toBe(baseOptions.execute);
    expect(handle.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        category: { type: 'string', description: 'The category' },
      },
      required: ['category'],
    });
  });

  it('should include toolkit when provided', () => {
    const handle = CustomTool({ ...baseOptions, toolkit: 'meta_ads' });
    expect(handle.toolkit).toBe('meta_ads');
  });

  it('should convert Zod schema with optional fields correctly', () => {
    const handle = CustomTool({
      ...baseOptions,
      inputParams: z.object({
        required_field: z.string(),
        optional_field: z.number().optional(),
      }),
    });

    expect(handle.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'number' },
      },
      required: ['required_field'],
    });
  });

  it('should convert Zod schema with defaults correctly', () => {
    const handle = CustomTool({
      ...baseOptions,
      inputParams: z.object({
        category: z.string().default('all'),
      }),
    });

    expect(handle.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        category: expect.objectContaining({ type: 'string' }),
      },
    });
  });

  describe('validation', () => {
    it('should throw if slug is missing', () => {
      expect(() => CustomTool({ ...baseOptions, slug: '' })).toThrow('slug is required');
    });

    it('should throw if name is missing', () => {
      expect(() => CustomTool({ ...baseOptions, name: '' })).toThrow('name is required');
    });

    it('should throw if description is missing', () => {
      expect(() => CustomTool({ ...baseOptions, description: '' })).toThrow(
        'description is required'
      );
    });

    it('should throw if inputParams is missing', () => {
      expect(() => CustomTool({ ...baseOptions, inputParams: null as any })).toThrow(
        'inputParams is required'
      );
    });

    it('should throw if execute is not a function', () => {
      expect(() => CustomTool({ ...baseOptions, execute: 'not-fn' as any })).toThrow(
        'execute must be a function'
      );
    });
  });

  describe('execute function signatures', () => {
    it('should allow no-session execute (input only)', async () => {
      const noSessionExecute = vi.fn().mockResolvedValue({
        data: { result: 42 },
        error: null,
        successful: true,
      });

      const handle = CustomTool({
        ...baseOptions,
        execute: noSessionExecute,
      });

      // Call without session — JS ignores extra params
      const result = await handle.execute({ category: 'test' } as any);
      expect(result.data.result).toBe(42);
      expect(noSessionExecute).toHaveBeenCalledWith({ category: 'test' });
    });

    it('should allow session-based execute (input + session)', async () => {
      const sessionExecute = vi.fn().mockResolvedValue({
        data: { userId: 'u1' },
        error: null,
        successful: true,
      });

      const handle = CustomTool({
        ...baseOptions,
        execute: sessionExecute,
      });

      const mockSession: SessionContext = {
        userId: 'user_1',
        sessionId: 'sess_1',
        execute: vi.fn(),
        proxyExecute: vi.fn(),
      };

      const result = await handle.execute({ category: 'test' }, mockSession);
      expect(result.data.userId).toBe('u1');
      expect(sessionExecute).toHaveBeenCalledWith({ category: 'test' }, mockSession);
    });
  });
});

// ────────────────────────────────────────────────────────────────
// buildLocalToolsMap()
// ────────────────────────────────────────────────────────────────

describe('buildLocalToolsMap', () => {
  const makeHandle = (slug: string): CustomToolHandle => ({
    slug,
    name: `Tool ${slug}`,
    description: `Description for ${slug}`,
    inputSchema: { type: 'object', properties: {} },
    execute: vi.fn(),
  });

  it('should create maps with both prefixed and original slug keys', () => {
    const handles = [makeHandle('MY_TOOL'), makeHandle('OTHER_TOOL')];
    const map = buildLocalToolsMap(handles);

    expect(map.byPrefixed.size).toBe(2);
    expect(map.byOriginal.size).toBe(2);

    // Prefixed lookup
    expect(map.byPrefixed.has('LOCAL_MY_TOOL')).toBe(true);
    expect(map.byPrefixed.has('LOCAL_OTHER_TOOL')).toBe(true);

    // Original lookup
    expect(map.byOriginal.has('MY_TOOL')).toBe(true);
    expect(map.byOriginal.has('OTHER_TOOL')).toBe(true);
  });

  it('should store correct prefixedSlug on each entry', () => {
    const handles = [makeHandle('FOO')];
    const map = buildLocalToolsMap(handles);

    const entry = map.byPrefixed.get('LOCAL_FOO');
    expect(entry?.prefixedSlug).toBe('LOCAL_FOO');
    expect(entry?.handle.slug).toBe('FOO');
  });

  it('should handle case-insensitive slugs (uppercased internally)', () => {
    const handle = makeHandle('my_tool');
    const map = buildLocalToolsMap([handle]);

    expect(map.byOriginal.has('MY_TOOL')).toBe(true);
    expect(map.byPrefixed.has('LOCAL_MY_TOOL')).toBe(true);
  });

  it('should throw on duplicate slugs', () => {
    const handles = [makeHandle('DUPE'), makeHandle('DUPE')];
    expect(() => buildLocalToolsMap(handles)).toThrow('duplicate slug "DUPE"');
  });

  it('should return empty maps for empty input', () => {
    const map = buildLocalToolsMap([]);
    expect(map.byPrefixed.size).toBe(0);
    expect(map.byOriginal.size).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────
// serializeLocalTools()
// ────────────────────────────────────────────────────────────────

describe('serializeLocalTools', () => {
  it('should serialize handles into backend format', () => {
    const handle: CustomToolHandle = {
      slug: 'GET_DATA',
      name: 'Get Data',
      description: 'Gets some data',
      toolkit: 'my_toolkit',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      execute: vi.fn(),
    };

    const result = serializeLocalTools([handle]);

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
    const handle: CustomToolHandle = {
      slug: 'NO_TOOLKIT',
      name: 'No Toolkit',
      description: 'No toolkit tool',
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn(),
    };

    const result = serializeLocalTools([handle]);
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

  it('should expose userId and sessionId', () => {
    const ctx = new SessionContextImpl(mockClient as any, 'user_1', 'sess_1');
    expect(ctx.userId).toBe('user_1');
    expect(ctx.sessionId).toBe('sess_1');
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
