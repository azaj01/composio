/**
 * @fileoverview Session context implementation injected into custom tool execute functions.
 */
import { Composio as ComposioClient } from '@composio/client';
import type { SessionContext } from '../types/customTool.types';
import type { ToolExecuteResponse } from '../types/tool.types';
import type { SessionProxyExecuteParams } from '../types/toolRouter.types';
import { SessionProxyExecuteParamsSchema } from '../types/toolRouter.types';
import { transformProxyParams } from './proxyParamsTransform';

/**
 * Callback that attempts local tool execution.
 * Returns a Promise if the slug matches a local tool, or undefined to fall back to remote.
 */
export type TryLocalExecuteFn = (
  slug: string,
  args: Record<string, unknown>
) => Promise<ToolExecuteResponse> | undefined;

/**
 * Concrete implementation of SessionContext.
 * Built per local tool invocation inside ToolRouterSession.
 *
 * When `tryLocalExecute` is provided, `execute()` checks sibling local tools first
 * before falling back to the backend API. This allows local tool A to call local
 * tool B via `session.execute('B', ...)` without hitting the network.
 */
export class SessionContextImpl implements SessionContext {
  public readonly userId: string;

  constructor(
    private readonly client: ComposioClient,
    userId: string,
    private readonly sessionId: string,
    private readonly tryLocalExecute?: TryLocalExecuteFn
  ) {
    this.userId = userId;
  }

  /**
   * Execute any tool from within a custom tool.
   * Routes to sibling local tools in-process when available,
   * otherwise delegates to the backend API.
   */
  async execute(
    toolSlug: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolExecuteResponse> {
    // Try local tool first (sibling routing)
    const localResult = this.tryLocalExecute?.(toolSlug, arguments_);
    if (localResult) {
      return localResult;
    }

    // Fall back to remote execution
    const response = await this.client.toolRouter.session.execute(
      this.sessionId,
      {
        tool_slug: toolSlug,
        arguments: arguments_,
      }
    );
    return {
      data: response.data,
      error: response.error,
      successful: !response.error,
    };
  }

  /**
   * Proxy API calls through Composio's auth layer.
   * The backend resolves the connected account from the toolkit within the session.
   */
  async proxyExecute(params: SessionProxyExecuteParams): Promise<ToolExecuteResponse> {
    const validated = SessionProxyExecuteParamsSchema.safeParse(params);
    if (!validated.success) {
      throw new Error(`Invalid proxy execute parameters: ${validated.error.message}`);
    }

    const body = transformProxyParams(validated.data);

    // TODO: Replace with client.toolRouter.session.proxyExecute() when @composio/client is updated
    const response = await (this.client as unknown as { post: (path: string, opts: { body: unknown }) => Promise<{ data: Record<string, unknown>; error: string | null; log_id: string }> }).post(
      `/api/v3/tool_router/session/${this.sessionId}/proxy_execute`,
      { body }
    );

    return {
      data: response.data ?? {},
      error: response.error,
      successful: !response.error,
    };
  }
}
