import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type FileObject,
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
import type { InferPageType } from 'fumadocs-core/source';
import {
  source,
  referenceSource,
  cookbooksSource,
  toolkitsSource,
} from '../lib/source';

type AnySource =
  | typeof source
  | typeof referenceSource
  | typeof cookbooksSource
  | typeof toolkitsSource;

async function checkLinks() {
  const scanned = await scanURLs({
    preset: 'next',
    populate: {
      // Dynamic routes (keys must include (home) route group to match app directory structure)
      '(home)/docs/[[...slug]]': source.getPages().map((page) => ({
        value: { slug: page.slugs },
        hashes: getHeadings(page),
      })),
      '(home)/reference/[[...slug]]': referenceSource.getPages().map((page) => ({
        value: { slug: page.slugs },
        hashes: getHeadings(page),
      })),
      '(home)/cookbooks/[[...slug]]': cookbooksSource.getPages().map((page) => ({
        value: { slug: page.slugs },
        hashes: getHeadings(page),
      })),
      '(home)/toolkits/[[...slug]]': toolkitsSource.getPages().map((page) => ({
        value: { slug: page.slugs },
        hashes: getHeadings(page),
      })),
    },
  });

  const errors = await validateFiles(await getFiles(), {
    scanned,
    markdown: {
      components: {
        Card: { attributes: ['href'] },
      },
    },
    checkRelativePaths: 'as-url',
  });

  // Filter out API route URLs (these are valid but not detected as pages)
  const ignoredUrls = ['/llms.txt', '/llms-full.txt'];
  const filteredErrors = errors
    .map((fileError) => ({
      ...fileError,
      errors: fileError.errors.filter((e) => !ignoredUrls.includes(e.url)),
      detected: fileError.detected.filter((d) => !ignoredUrls.includes(d[0] as string)),
    }))
    .filter((fileError) => fileError.errors.length > 0);

  printErrors(filteredErrors, true);
  if (filteredErrors.length > 0) {
    process.exit(1);
  }
}

function getHeadings({ data }: InferPageType<AnySource>): string[] {
  if (!data.toc) return [];
  return data.toc.map((item) => item.url.slice(1));
}

async function getFiles(): Promise<FileObject[]> {
  const sources = [source, referenceSource, cookbooksSource, toolkitsSource];
  const allFiles: FileObject[] = [];

  for (const src of sources) {
    const pages = src.getPages();
    for (const page of pages) {
      if (!page.absolutePath) continue;
      if (!page.absolutePath.endsWith('.mdx') && !page.absolutePath.endsWith('.md')) continue;
      // Skip OpenAPI-generated pages (they don't have getText)
      if (!('getText' in page.data)) continue;

      allFiles.push({
        path: page.absolutePath,
        content: await (page.data as { getText: (mode: string) => Promise<string> }).getText('raw'),
        url: page.url,
        data: page.data,
      });
    }
  }

  // Toolkit FAQ files (embedded snippets not in any Fumadocs source)
  const faqDir = join(process.cwd(), 'content/toolkit-faq');
  try {
    const faqFiles = await readdir(faqDir);
    for (const file of faqFiles) {
      if (!file.endsWith('.md')) continue;
      const filePath = join(faqDir, file);
      const content = await readFile(filePath, 'utf-8');
      const slug = file.replace(/\.md$/, '');
      allFiles.push({
        path: filePath,
        content,
        url: `/toolkits/${slug}`,
      });
    }
  } catch {
    // toolkit-faq directory doesn't exist, skip
  }

  return allFiles;
}

void checkLinks();
