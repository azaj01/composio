import type { MetadataRoute } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  source,
  referenceSource,
  examplesSource,
  toolkitsSource,
  changelogEntries,
  dateToChangelogUrl,
} from '@/lib/source';

const baseUrl = 'https://docs.composio.dev';

interface Toolkit {
  slug: string;
}

function getToolkitsFromJson(): Toolkit[] {
  try {
    const filePath = join(process.cwd(), 'public/data/toolkits.json');
    const data = readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as Toolkit[];
  } catch {
    return [];
  }
}

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

  // MDX toolkit pages
  const toolkitsMdxPages = toolkitsSource.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
  }));

  // JSON toolkit pages (dynamically generated from toolkits.json)
  const toolkitsJsonPages = getToolkitsFromJson().map((toolkit) => ({
    url: `${baseUrl}/toolkits/${toolkit.slug}`,
  }));

  // Changelog pages
  const changelogPages = [...changelogEntries].map((entry) => ({
    url: `${baseUrl}${dateToChangelogUrl(entry.date)}`,
  }));

  return [
    { url: baseUrl },
    { url: `${baseUrl}/docs/changelog` },
    ...docsPages,
    ...referencePages,
    ...examplesPages,
    ...toolkitsMdxPages,
    ...toolkitsJsonPages,
    ...changelogPages,
  ];
}
