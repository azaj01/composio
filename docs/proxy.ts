import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy that serves Markdown content when AI agents request it via Accept header.
 * This follows Lee Robinson's "Agent-Ready" principle:
 * "Serve Markdown files when Accept: text/markdown is requested"
 */
export function proxy(request: NextRequest) {
  const acceptHeader = request.headers.get('accept') || '';

  // Check if the request prefers markdown (AI agents)
  const prefersMarkdown =
    acceptHeader.includes('text/markdown') ||
    acceptHeader.includes('text/plain');

  // Only apply to /docs pages (not already .md or .mdx)
  const pathname = request.nextUrl.pathname;
  if (
    prefersMarkdown &&
    pathname.startsWith('/docs') &&
    !pathname.endsWith('.md') &&
    !pathname.endsWith('.mdx')
  ) {
    // Rewrite to the markdown endpoint
    const mdUrl = new URL(`${pathname}.md`, request.nextUrl.origin);
    return NextResponse.rewrite(mdUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/docs/:path*'],
};
