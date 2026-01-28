import type { MetadataRoute } from 'next';
import { source, referenceSource, examplesSource, toolkitsSource } from '@/lib/source';

const baseUrl = 'https://docs.composio.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const docsPages = source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: page.data.lastModified ?? new Date(),
  }));

  const referencePages = referenceSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: page.data.lastModified ?? new Date(),
  }));

  const examplesPages = examplesSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: page.data.lastModified ?? new Date(),
  }));

  const toolkitsPages = toolkitsSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: page.data.lastModified ?? new Date(),
  }));

  return [
    { url: baseUrl, lastModified: new Date() },
    ...docsPages,
    ...referencePages,
    ...examplesPages,
    ...toolkitsPages,
  ];
}
