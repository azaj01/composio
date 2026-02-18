import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import {
  type FileObject,
  printErrors,
  scanURLs,
  validateFiles,
} from 'next-validate-link';
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

type PageOf = ReturnType<AnySource['getPages']>[number];

/**
 * Slugify a heading the same way rehype-slug does.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract heading anchors from raw MDX/markdown content.
 * Falls back to this when data.toc is unavailable (outside Next.js runtime).
 */
function extractHeadingsFromContent(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      headings.push(slugify(match[1]));
    }
  }
  return headings;
}

/**
 * Get headings for a page, trying data.toc first then falling back to raw content parsing.
 */
async function getHeadingsForPage(page: PageOf): Promise<string[]> {
  if (page.data.toc?.length) {
    return page.data.toc.map((item: { url: string }) => item.url.slice(1));
  }
  if ('getText' in page.data) {
    try {
      const content = await (page.data as { getText: (mode: string) => Promise<string> }).getText('raw');
      return extractHeadingsFromContent(content);
    } catch {
      // fall through
    }
  }
  if (page.absolutePath) {
    try {
      const content = await readFile(page.absolutePath, 'utf-8');
      return extractHeadingsFromContent(content);
    } catch {
      // fall through
    }
  }
  return [];
}

/**
 * Build populate entries for a source, resolving headings asynchronously.
 */
async function buildPopulateEntries(src: AnySource) {
  return Promise.all(
    src.getPages().map(async (page) => ({
      value: { slug: page.slugs },
      hashes: await getHeadingsForPage(page),
    })),
  );
}

async function checkLinks() {
  const [docsEntries, refEntries, cookbookEntries, toolkitEntries] = await Promise.all([
    buildPopulateEntries(source),
    buildPopulateEntries(referenceSource),
    buildPopulateEntries(cookbooksSource),
    buildPopulateEntries(toolkitsSource),
  ]);

  const scanned = await scanURLs({
    preset: 'next',
    populate: {
      // Keys must include (home) route group to match app directory structure
      '(home)/docs/[[...slug]]': docsEntries,
      '(home)/reference/[[...slug]]': refEntries,
      '(home)/cookbooks/[[...slug]]': cookbookEntries,
      '(home)/toolkits/[[...slug]]': toolkitEntries,
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

  // Scan any .md files under content/ not already covered by Fumadocs sources
  const coveredPaths = new Set(allFiles.map((f) => f.path));
  const extraMdFiles = await Array.fromAsync(glob('content/**/*.md'));
  for (const filePath of extraMdFiles) {
    if (coveredPaths.has(filePath)) continue;
    const content = await readFile(filePath, 'utf-8');
    allFiles.push({ path: filePath, content });
  }

  return allFiles;
}

void checkLinks();
