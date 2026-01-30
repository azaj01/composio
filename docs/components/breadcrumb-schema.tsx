const BASE_URL = 'https://docs.composio.dev';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

/**
 * Generates JSON-LD BreadcrumbList schema for SEO.
 * Helps Google display breadcrumb trails in search results.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  if (items.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Builds breadcrumb items from a URL path and page title.
 *
 * Example: buildBreadcrumbs('/docs/auth/oauth', 'OAuth Guide')
 * Returns: [
 *   { name: 'Docs', url: '/docs' },
 *   { name: 'Auth', url: '/docs/auth' },
 *   { name: 'OAuth Guide', url: '/docs/auth/oauth' }
 * ]
 */
export function buildBreadcrumbs(url: string, pageTitle: string): BreadcrumbItem[] {
  const segments = url.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  // Build intermediate breadcrumbs from URL segments
  let currentPath = '';
  for (let i = 0; i < segments.length - 1; i++) {
    currentPath += `/${segments[i]}`;
    // Capitalize and format segment name (e.g., 'auth-configuration' -> 'Auth Configuration')
    const name = segments[i]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    items.push({ name, url: currentPath });
  }

  // Add final page with actual title
  items.push({ name: pageTitle, url });

  return items;
}
