import {
  source,
  toolRouterSource,
  referenceSource,
  examplesSource,
  getLLMText,
} from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

// Map URL prefixes to their sources
const sources = [
  { prefix: 'docs', source },
  { prefix: 'tool-router', source: toolRouterSource },
  { prefix: 'reference', source: referenceSource },
  { prefix: 'examples', source: examplesSource },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug = [] } = await params;
  const [prefix, ...rest] = slug;

  // Find the matching source
  const match = sources.find((s) => s.prefix === prefix);
  if (!match) notFound();

  // Get the page from that source
  const page = match.source.getPage(rest.length > 0 ? rest : undefined);
  if (!page) notFound();

  try {
    return new Response(await getLLMText(page), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch {
    // Graceful fallback
    return new Response(
      `# ${page.data.title} (${page.url})\n\n${page.data.description || ''}`,
      {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      }
    );
  }
}
