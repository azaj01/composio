import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if a string contains kebab-case (has hyphens between lowercase letters)
 */
function hasKebabCase(str: string): boolean {
  return /[a-z]-[a-z]/.test(str);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only handle API reference paths
  if (!pathname.startsWith('/reference/api-reference/')) {
    return NextResponse.next();
  }

  // Check if any path segment has kebab-case
  const segments = pathname.split('/');
  let hasKebab = false;

  for (const segment of segments) {
    if (hasKebabCase(segment)) {
      hasKebab = true;
      break;
    }
  }

  if (!hasKebab) {
    return NextResponse.next();
  }

  // Convert kebab-case segments to camelCase
  const newSegments = segments.map((segment, index) => {
    // Only convert segments after 'api-reference' (skip the tag/category names)
    // api-reference structure: /reference/api-reference/{tag}/{operationId}
    if (index <= 3) return segment; // Keep /reference/api-reference/{tag} as-is
    return kebabToCamel(segment);
  });

  const newPathname = newSegments.join('/');

  // Only redirect if the path actually changed
  if (newPathname !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/reference/api-reference/:path*',
};
