import type { MetadataRoute } from 'next';
import { source, referenceSource, examplesSource, toolkitsSource } from '@/lib/source';

const baseUrl = 'https://docs.composio.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const docsPages = source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
  }));

  const referencePages = referenceSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
  }));

  const examplesPages = examplesSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
  }));

  const toolkitsPages = toolkitsSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
  }));

  return [
    { url: baseUrl },
    ...docsPages,
    ...referencePages,
    ...examplesPages,
    ...toolkitsPages,
  ];
}
