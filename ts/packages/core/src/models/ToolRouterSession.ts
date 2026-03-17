import { telemetry } from '../telemetry/Telemetry';
import { Composio as ComposioClient } from '@composio/client';
import { BaseComposioProvider } from '../provider/BaseProvider';
import { ComposioConfig } from '../composio';
import {
  ToolRouterMCPServerConfig,
  SessionExperimental,
  ToolRouterToolkitsOptions,
  ToolRouterToolkitsOptionsSchema,
  ToolRouterSessionSearchResponse,
  ToolRouterSessionSearchResponseSchema,
  ToolRouterSessionExecuteResponse,
  ToolRouterSessionExecuteResponseSchema,
} from '../types/toolRouter.types';
import {
  transformSearchResponse,
  transformExecuteResponse,
} from '../utils/transformers/toolRouterResponseTransform';
import { SessionMetaToolOptions } from '../types/modifiers.types';
import { ConnectionRequest } from '../types/connectionRequest.types';
import { createConnectionRequest } from './ConnectionRequest';
import { ConnectedAccountStatuses } from '../types/connectedAccounts.types';
import { transform } from '../utils/transform';
import { ToolkitConnectionStateSchema } from '../types/toolRouter.types';
import { ValidationError } from '../errors';
import { Tools } from './Tools';
import { ToolRouterSessionFilesMount } from './ToolRouterSessionFileMount';
import type { CustomToolsMap, CustomToolsMapEntry, SessionContext } from '../types/customTool.types';
import type { ToolExecuteResponse } from '../types/tool.types';
import type { SessionProxyExecuteParams } from '../types/toolRouter.types';
import { SessionProxyExecuteParamsSchema } from '../types/toolRouter.types';
import { SessionContextImpl } from './SessionContext';
import { findCustomTool, executeCustomTool } from './customToolExecution';
import { transformProxyParams } from './proxyParamsTransform';

const COMPOSIO_MULTI_EXECUTE_TOOL = 'COMPOSIO_MULTI_EXECUTE_TOOL';

export class ToolRouterSession<
  TToolCollection,
  TTool,
  TProvider extends BaseComposioProvider<TToolCollection, TTool, unknown>,
> {
  public readonly sessionId: string;
  public readonly mcp: ToolRouterMCPServerConfig;
  public readonly experimental: SessionExperimental;

  constructor(
    private readonly client: ComposioClient,
    private readonly config: ComposioConfig<TProvider> | undefined,
    sessionId: string,
    mcp: ToolRouterMCPServerConfig,
    experimentalOverrides?: Pick<SessionExperimental, 'assistivePrompt'>,
    private readonly customToolsMap?: CustomToolsMap,
    private readonly userId?: string
  ) {
    if (customToolsMap && !userId) {
      throw new Error('userId is required when custom tools are bound to a session.');
    }
    this.sessionId = sessionId;
    this.mcp = mcp;
    this.experimental = {
      assistivePrompt: experimentalOverrides?.assistivePrompt,
      files: new ToolRouterSessionFilesMount(client, sessionId),
    };
    telemetry.instrument(this, 'ToolRouterSession');
  }

  /**
   * Get the tools available in the session, formatted for your AI framework.
   * Requires a provider to be configured in the Composio constructor.
   *
   * When custom tools are bound to the session, execution of COMPOSIO_MULTI_EXECUTE_TOOL
   * is intercepted: local tools are executed in-process, remote tools are sent to the backend.
   */
  async tools(modifiers?: SessionMetaToolOptions): Promise<ReturnType<TProvider['wrapTools']>> {
    const ToolsModel = new Tools<TToolCollection, TTool, TProvider>(this.client, this.config);
    const tools = await ToolsModel.getRawToolRouterMetaTools(
      this.sessionId,
      modifiers?.modifySchema ? { modifySchema: modifiers.modifySchema } : undefined
    );

    if (this.hasCustomTools()) {
      // Create an execute function that splits local/remote tools in COMPOSIO_MULTI_EXECUTE_TOOL
      const routingExecuteFn = async (
        toolSlug: string,
        input: Record<string, unknown>
      ): Promise<ToolExecuteResponse> => {
        if (toolSlug === COMPOSIO_MULTI_EXECUTE_TOOL) {
          return this.routeMultiExecute(input, ToolsModel, modifiers);
        }
        // Non-multi-execute meta tools always go to backend
        return ToolsModel.executeMetaTool(
          toolSlug,
          { sessionId: this.sessionId, arguments: input },
          modifiers
        );
      };

      if (!this.config?.provider) {
        throw new Error(
          'A provider is required when using custom tools with session.tools(). ' +
          'Pass a provider in the Composio constructor.'
        );
      }
      return this.config.provider.wrapTools(tools, routingExecuteFn) as ReturnType<
        TProvider['wrapTools']
      >;
    }

    // Standard path (no local tools)
    const wrappedTools = ToolsModel.wrapToolsForToolRouter(this.sessionId, tools, modifiers);
    return wrappedTools as ReturnType<TProvider['wrapTools']>;
  }

  /**
   * Initiate an authorization flow for a toolkit.
   * Returns a ConnectionRequest with a redirect URL for the user.
   */
  async authorize(toolkit: string, options?: { callbackUrl?: string }): Promise<ConnectionRequest> {
    const response = await this.client.toolRouter.session.link(this.sessionId, {
      ...(options?.callbackUrl ? { callback_url: options.callbackUrl } : {}),
      toolkit,
    });

    return createConnectionRequest(
      this.client,
      response.connected_account_id,
      ConnectedAccountStatuses.INITIATED,
      response.redirect_url
    );
  }

  /**
   * Query the connection state of toolkits in the session.
   * Supports pagination and filtering by toolkit slugs.
   */
  async toolkits(options?: ToolRouterToolkitsOptions) {
    const toolkitOptions = ToolRouterToolkitsOptionsSchema.safeParse(options ?? {});
    if (!toolkitOptions.success) {
      throw new ValidationError('Failed to parse toolkits options', {
        cause: toolkitOptions.error,
      });
    }

    const result = await this.client.toolRouter.session.toolkits(this.sessionId, {
      cursor: toolkitOptions.data.nextCursor,
      limit: toolkitOptions.data.limit,
      toolkits: toolkitOptions.data.toolkits,
      is_connected: toolkitOptions.data.isConnected,
      search: toolkitOptions.data.search,
    });

    const toolkitConnectedStates = result.items.map(item => {
      const connectedState = transform(item)
        .with(ToolkitConnectionStateSchema)
        .using(item => ({
          slug: item.slug,
          name: item.name,
          logo: item.meta?.logo,
          isNoAuth: item.is_no_auth,
          connection: item.is_no_auth
            ? undefined
            : {
                isActive: item.connected_account?.status === 'ACTIVE',
                authConfig: item.connected_account && {
                  id: item.connected_account?.auth_config.id,
                  mode: item.connected_account?.auth_config.auth_scheme,
                  isComposioManaged: item.connected_account?.auth_config.is_composio_managed,
                },
                connectedAccount: item.connected_account
                  ? {
                      id: item.connected_account.id,
                      status: item.connected_account.status,
                    }
                  : undefined,
              },
        }));
      return connectedState;
    });

    return {
      items: toolkitConnectedStates,
      nextCursor: result.next_cursor ?? undefined,
      totalPages: result.total_pages,
    };
  }

  /**
   * Search for tools by semantic use case.
   * Returns relevant tools for the given query with schemas and guidance.
   */
  async search(params: {
    query: string;
    toolkits?: string[];
  }): Promise<ToolRouterSessionSearchResponse> {
    const response = await this.client.toolRouter.session.search(this.sessionId, {
      queries: [{ use_case: params.query }],
      ...(params.toolkits?.length ? { toolkits: params.toolkits } : {}),
    });
    const transformed = transformSearchResponse(response);
    return ToolRouterSessionSearchResponseSchema.parse(transformed);
  }

  /**
   * Execute a tool within the session.
   *
   * For custom tools, accepts both the original slug (e.g. "GET_USER_CONTEXT")
   * and the prefixed slug (e.g. "LOCAL_GET_USER_CONTEXT"). Custom tools are executed
   * in-process; remote tools are sent to the Composio backend.
   *
   * @param toolSlug - The tool slug to execute
   * @param arguments_ - Optional tool arguments
   * @returns The tool execution result
   */
  async execute(
    toolSlug: string,
    arguments_?: Record<string, unknown>
  ): Promise<ToolRouterSessionExecuteResponse> {
    // Check if this is a local tool (by original or prefixed slug)
    const entry = findCustomTool(this.customToolsMap, toolSlug);
    if (entry) {
      const result = await executeCustomTool(entry, arguments_ ?? {}, this.buildSessionContext());
      return {
        data: result.data,
        error: result.error,
        logId: 'local',
      };
    }

    // Remote execution
    const response = await this.client.toolRouter.session.execute(this.sessionId, {
      tool_slug: toolSlug,
      arguments: arguments_ ?? {},
    });
    const transformed = transformExecuteResponse(response);
    return ToolRouterSessionExecuteResponseSchema.parse(transformed);
  }

  /**
   * Proxy an API call through Composio's auth layer using the session's connected account.
   * The backend resolves the connected account from the toolkit within the session.
   *
   * @param params - Proxy request parameters (toolkit, endpoint, method, body, headers/query params)
   * @returns The proxied API response
   */
  async proxyExecute(params: SessionProxyExecuteParams): Promise<ToolRouterSessionExecuteResponse> {
    const validated = SessionProxyExecuteParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new ValidationError('Invalid proxy execute parameters', { cause: validated.error });
    }

    const body = transformProxyParams(validated.data);

    // TODO: Replace with client.toolRouter.session.proxyExecute() when @composio/client is updated
    const response = await (this.client as unknown as { post: (path: string, opts: { body: unknown }) => Promise<{ data: Record<string, unknown>; error: string | null; log_id: string }> }).post(
      `/api/v3/tool_router/session/${this.sessionId}/proxy_execute`,
      { body }
    );

    return ToolRouterSessionExecuteResponseSchema.parse({
      data: response.data,
      error: response.error,
      logId: response.log_id,
    });
  }

  // ── Private helpers ──────────────────────────────────────────

  /** Check if this session has any custom tools bound. */
  private hasCustomTools(): boolean {
    return (this.customToolsMap?.byPrefixed.size ?? 0) > 0;
  }

  /**
   * Build a SessionContext for local tool execution.
   * Includes sibling routing: session.execute() inside a custom tool checks
   * local tools first before falling back to the backend API.
   */
  private buildSessionContext(): SessionContext {
    return new SessionContextImpl(
      this.client,
      this.userId!,
      this.sessionId,
      (slug, args) => {
        const entry = findCustomTool(this.customToolsMap, slug);
        if (!entry) return undefined;
        return executeCustomTool(entry, args, this.buildSessionContext());
      }
    );
  }

  /** Parse an individual tool item from COMPOSIO_MULTI_EXECUTE_TOOL's tools array */
  private parseToolItem(item: unknown): { tool_slug: string; arguments: Record<string, unknown> } {
    if (typeof item !== 'object' || item === null) {
      return { tool_slug: '', arguments: {} };
    }
    const obj = item as Record<string, unknown>;
    return {
      tool_slug: String(obj.tool_slug ?? ''),
      arguments: (obj.arguments as Record<string, unknown> | undefined) ?? {},
    };
  }

  /**
   * Route a COMPOSIO_MULTI_EXECUTE_TOOL call.
   * Splits the tools[] array into local and remote, executes each appropriately,
   * and merges results preserving original order.
   */
  private async routeMultiExecute(
    input: Record<string, unknown>,
    ToolsModel: Tools<TToolCollection, TTool, TProvider>,
    modifiers?: SessionMetaToolOptions
  ): Promise<ToolExecuteResponse> {
    const toolItems = input.tools as unknown[];
    if (!Array.isArray(toolItems) || toolItems.length === 0) {
      // Fallback: send to backend as-is
      return ToolsModel.executeMetaTool(
        COMPOSIO_MULTI_EXECUTE_TOOL,
        { sessionId: this.sessionId, arguments: input },
        modifiers
      );
    }

    const parsed = toolItems.map(item => this.parseToolItem(item));

    // Partition into local (with resolved entry) and remote
    const localItems: Array<{ index: number; entry: CustomToolsMapEntry }> = [];
    const remoteIndices: number[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const entry = findCustomTool(this.customToolsMap, parsed[i].tool_slug);
      if (entry) {
        localItems.push({ index: i, entry });
      } else {
        remoteIndices.push(i);
      }
    }

    // All remote — just forward entire payload
    if (localItems.length === 0) {
      return ToolsModel.executeMetaTool(
        COMPOSIO_MULTI_EXECUTE_TOOL,
        { sessionId: this.sessionId, arguments: input },
        modifiers
      );
    }

    // Execute local tools in parallel
    const localPromises = localItems.map(async ({ index, entry }) => {
      const result = await executeCustomTool(entry, parsed[index].arguments, this.buildSessionContext());
      return { index, result };
    });

    // Execute remote tools via backend in parallel with local
    let remotePromise: Promise<ToolExecuteResponse> | undefined;
    if (remoteIndices.length > 0) {
      const remoteToolItems = remoteIndices.map(i => toolItems[i]);
      const remoteInput = { ...input, tools: remoteToolItems };
      remotePromise = ToolsModel.executeMetaTool(
        COMPOSIO_MULTI_EXECUTE_TOOL,
        { sessionId: this.sessionId, arguments: remoteInput },
        modifiers
      );
    }

    const [localResults, remoteResult] = await Promise.all([
      Promise.all(localPromises),
      remotePromise,
    ]);

    // If only local tools, return the single/first result unwrapped
    if (remoteIndices.length === 0 && localResults.length === 1) {
      return localResults[0].result;
    }

    // Merge results into the backend's results[] format.
    // Backend returns: { results: [{ response, tool_slug, index }], total_count, ... }
    // We append local tool results in the same shape.
    const remoteData = (remoteResult?.data ?? {}) as Record<string, unknown>;
    const remoteResults = (Array.isArray(remoteData.results) ? remoteData.results : []) as unknown[];

    // Build local result entries matching backend format
    const localEntries = localResults.map(({ index, result }) => ({
      response: {
        successful: result.successful,
        data: result.data,
        ...(result.error ? { error: result.error } : {}),
      },
      tool_slug: parsed[index].tool_slug,
      ...(result.error ? { error: result.error } : {}),
    }));

    // Merge and re-index sequentially so there are no collisions
    const merged: Array<Record<string, unknown>> = [
      ...(remoteResults as Array<Record<string, unknown>>),
      ...localEntries,
    ];
    const allResults = merged.map((entry, i): Record<string, unknown> => ({
      ...entry,
      index: i,
    }));
    const hasAnyError = localResults.some(r => r.result.error) || !!remoteResult?.error;

    return {
      data: { ...remoteData, results: allResults },
      error: hasAnyError
        ? `${allResults.filter(r => r.error).length} out of ${allResults.length} tools failed`
        : null,
      successful: !hasAnyError,
    };
  }

}
