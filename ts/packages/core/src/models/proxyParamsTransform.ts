/**
 * @fileoverview Shared transform for converting SDK SessionProxyExecuteParams
 * to the backend proxy execute request format.
 */
import type { SessionProxyExecuteParams } from '../types/toolRouter.types';

/** Backend session proxy execute request body shape. */
export interface SessionProxyExecuteRequestBody {
  toolkit_slug: string;
  endpoint: string;
  method: string;
  body?: unknown;
  parameters?: Array<{ name: string; type: 'header' | 'query'; value: string }>;
}

/**
 * Transform SDK session proxy params to the backend request format.
 * Converts `in` (query/header) to `type` and stringifies values.
 */
export function transformProxyParams(params: SessionProxyExecuteParams): SessionProxyExecuteRequestBody {
  const parameters = params.parameters?.map(p => ({
    name: p.name,
    type: p.in as 'header' | 'query',
    value: p.value.toString(),
  }));

  return {
    toolkit_slug: params.toolkit,
    endpoint: params.endpoint,
    method: params.method,
    ...(params.body !== undefined ? { body: params.body } : {}),
    ...(parameters?.length ? { parameters } : {}),
  };
}
