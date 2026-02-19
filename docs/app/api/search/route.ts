// Use direct imports from collections to avoid top-level await in lib/source.ts
import { docs, reference, cookbooks, toolkits, changelog } from 'fumadocs-mdx:collections/server';
import { createSearchAPI } from 'fumadocs-core/search/server';
import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { getAllToolkitsSync } from '@/lib/toolkit-data';

// Create loaders directly here to avoid the problematic lib/source.ts import
const docsSource = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const cookbooksSource = loader({
  baseUrl: '/cookbooks',
  source: cookbooks.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const toolkitsSource = loader({
  baseUrl: '/toolkits',
  source: toolkits.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

// Sync reference source (MDX pages only — SDK reference, errors, rate-limits, etc.)
// OpenAPI-generated API reference pages require async loading and can't be indexed here
const referenceSource = loader({
  baseUrl: '/reference',
  source: reference.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

// MDX pages from Fumadocs sources
const mdxIndexes = [
  ...docsSource.getPages(),
  ...cookbooksSource.getPages(),
  ...toolkitsSource.getPages(),
  ...referenceSource.getPages(),
].map((page) => ({
  id: page.url,
  title: page.data.title ?? 'Untitled',
  description: page.data.description,
  url: page.url,
  structuredData: page.data.structuredData,
  keywords: 'keywords' in page.data ? page.data.keywords : undefined,
}));

// Dynamic toolkit pages from toolkits.json
const mdxToolkitSlugs = new Set(
  toolkitsSource.getPages().map((page) => page.slugs.join('/')),
);

const dynamicToolkitIndexes = getAllToolkitsSync()
  .filter((toolkit) => !mdxToolkitSlugs.has(toolkit.slug))
  .map((toolkit) => ({
    id: `/toolkits/${toolkit.slug}`,
    title: toolkit.name,
    description: toolkit.description,
    url: `/toolkits/${toolkit.slug}`,
    structuredData: { headings: [], contents: [] },
    keywords: [toolkit.slug, toolkit.category].filter(Boolean) as string[],
  }));

// Changelog entries
const changelogIndexes = changelog.map((entry) => ({
  id: `/docs/changelog/${entry.date.replace(/-/g, '/')}`,
  title: entry.title,
  description: entry.description ?? '',
  url: `/docs/changelog/${entry.date.replace(/-/g, '/')}`,
  structuredData: { headings: [], contents: [] },
  keywords: ['changelog'],
}));

export const { GET } = createSearchAPI('advanced', {
  indexes: [...mdxIndexes, ...dynamicToolkitIndexes, ...changelogIndexes],
});
