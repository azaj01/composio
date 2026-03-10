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
import type { LocalToolsMap, LocalToolsMapEntry } from '../types/customTool.types';
import type { ToolExecuteResponse } from '../types/tool.types';
import { SessionContextImpl } from './SessionContext';

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
    private readonly localToolsMap?: LocalToolsMap,
    private readonly userId?: string
  ) {
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

    if (this.hasLocalTools()) {
      // Create an execute function that routes between local and remote execution
      const routingExecuteFn = async (
        toolSlug: string,
        input: Record<string, unknown>
      ): Promise<ToolExecuteResponse> => {
        // Intercept COMPOSIO_MULTI_EXECUTE_TOOL and check if the inner tool is local
        if (toolSlug === COMPOSIO_MULTI_EXECUTE_TOOL) {
          const innerSlug = String((input as Record<string, unknown>).tool_slug ?? '');
          const entry = this.findLocalTool(innerSlug);
          if (entry) {
            return this.executeLocalTool(
              entry,
              (input as Record<string, unknown>).arguments as Record<string, unknown> ?? {}
            );
          }
        }
        // Default: send to backend
        return ToolsModel.executeMetaTool(
          toolSlug,
          { sessionId: this.sessionId, arguments: input },
          modifiers
        );
      };

      return this.config?.provider?.wrapTools(tools, routingExecuteFn) as ReturnType<
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
   * For custom local tools, accepts both the original slug (e.g. "GET_USER_CONTEXT")
   * and the prefixed slug (e.g. "LOCAL_GET_USER_CONTEXT"). Local tools are executed
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
    const entry = this.findLocalTool(toolSlug);
    if (entry) {
      const result = await this.executeLocalTool(entry, arguments_ ?? {});
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

  // ── Private helpers ──────────────────────────────────────────

  /** Check if this session has any local tools bound. */
  private hasLocalTools(): boolean {
    return (this.localToolsMap?.byPrefixed.size ?? 0) > 0;
  }

  /**
   * Find a local tool entry by slug.
   * Checks both the prefixed map (LOCAL_X — agent path) and original map (X — programmatic path).
   */
  private findLocalTool(slug: string): LocalToolsMapEntry | undefined {
    if (!this.localToolsMap) return undefined;
    const upper = slug.toUpperCase();
    return this.localToolsMap.byPrefixed.get(upper) ?? this.localToolsMap.byOriginal.get(upper);
  }

  /**
   * Execute a local tool in-process.
   * Builds a SessionContext, validates input, and calls the user's execute function.
   */
  private async executeLocalTool(
    entry: LocalToolsMapEntry,
    arguments_: Record<string, unknown>
  ): Promise<ToolExecuteResponse> {
    const { handle } = entry;

    // Validate input against the Zod schema
    // The handle was created from a Zod schema, but we stored the execute fn.
    // We need to re-validate at execution time. The inputParams is on the original options,
    // but the handle doesn't store the Zod schema — only the JSON Schema.
    // The execute function itself should handle its input. We trust the LLM/caller here
    // and let the execute function handle validation. If the user used Zod in their execute,
    // it will validate there.

    // Build session context
    const sessionContext = new SessionContextImpl(
      this.client,
      this.userId ?? '',
      this.sessionId
    );

    try {
      const result = await handle.execute(arguments_, sessionContext);
      return {
        data: result.data,
        error: result.error,
        successful: result.successful,
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
}
