import {
  source,
  toolRouterSource,
  referenceSource,
  examplesSource,
  toolkitsSource,
  getLLMText,
} from '@/lib/source';
import { notFound } from 'next/navigation';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Toolkit } from '@/types/toolkit';

export const revalidate = false;

// Map URL prefixes to their sources
const sources = [
  { prefix: 'docs', source },
  { prefix: 'tool-router', source: toolRouterSource },
  { prefix: 'reference', source: referenceSource },
  { prefix: 'examples', source: examplesSource },
  { prefix: 'toolkits', source: toolkitsSource },
];

// Generate markdown from toolkit JSON data
function toolkitToMarkdown(toolkit: Toolkit): string {
  const lines: string[] = [
    `# ${toolkit.name.trim()}`,
    '',
    toolkit.description,
    '',
    `- **Category:** ${toolkit.category || 'Uncategorized'}`,
    `- **Auth:** ${toolkit.authSchemes.join(', ') || 'None'}`,
    `- **Tools:** ${toolkit.toolCount}`,
    `- **Triggers:** ${toolkit.triggerCount}`,
  ];

  if (toolkit.tools.length > 0) {
    lines.push('', '## Tools', '');
    for (const tool of toolkit.tools) {
      lines.push(`### ${tool.name}`, '', tool.description, '');
    }
  }

  if (toolkit.triggers.length > 0) {
    lines.push('', '## Triggers', '');
    for (const trigger of toolkit.triggers) {
      lines.push(`### ${trigger.name}`, '', trigger.description, '');
    }
  }

  return lines.join('\n');
}

async function getToolkit(slug: string): Promise<Toolkit | null> {
  try {
    const filePath = join(process.cwd(), 'public/data/toolkits.json');
    const data = await readFile(filePath, 'utf-8');
    const toolkits = JSON.parse(data) as Toolkit[];
    return toolkits.find((t) => t.slug === slug) || null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug = [] } = await params;
  const [prefix, ...rest] = slug;

  // Find the matching source
  const match = sources.find((s) => s.prefix === prefix);
  if (!match) notFound();

  // Get the page from that source (MDX pages)
  const page = match.source.getPage(rest.length > 0 ? rest : undefined);

  if (page) {
    try {
      return new Response(await getLLMText(page), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      });
    } catch {
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

  // Special handling for JSON toolkit pages
  if (prefix === 'toolkits' && rest.length === 1) {
    const toolkit = await getToolkit(rest[0]);
    if (toolkit) {
      return new Response(toolkitToMarkdown(toolkit), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      });
    }
  }

  notFound();
}
