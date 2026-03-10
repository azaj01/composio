/**
 * @fileoverview Session context implementation injected into custom tool execute functions.
 */
import { Composio as ComposioClient } from '@composio/client';
import type { SessionContext } from '../types/customTool.types';
import type { ToolExecuteResponse, ToolProxyParams } from '../types/tool.types';

/**
 * Concrete implementation of SessionContext.
 * Built per local tool invocation inside ToolRouterSession.executeLocalTool().
 */
export class SessionContextImpl implements SessionContext {
  public readonly userId: string;
  public readonly sessionId: string;

  constructor(
    private readonly client: ComposioClient,
    userId: string,
    sessionId: string
  ) {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  /**
   * Execute any Composio native tool from within a custom tool.
   * Delegates to the tool router session execute endpoint.
   */
  async execute(
    toolSlug: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolExecuteResponse> {
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
