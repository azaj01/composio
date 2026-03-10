/**
 * @fileoverview Session context implementation injected into custom tool execute functions.
 */
import { Composio as ComposioClient } from '@composio/client';
import type { SessionContext } from '../types/customTool.types';
import type { ToolExecuteResponse, ToolProxyParams } from '../types/tool.types';

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
   * The session-scoped backend endpoint resolves the connected account automatically.
   *
   * TODO: Wire to session-scoped proxy endpoint (proxyExecuteForSessionRPC).
   * Currently a skeleton — will be connected to backend API.
   */
  async proxyExecute(_params: ToolProxyParams): Promise<ToolExecuteResponse> {
    // TODO: Call session-scoped proxy endpoint that resolves connected account from session.
    // Backend API: apps/apollo/src/lib/toolRouterV2/features/execution/proxyExecuteForSessionRPC.ts
    throw new Error(
      'proxyExecute is not yet implemented. Session-scoped proxy endpoint pending backend support.'
    );
  }
}
