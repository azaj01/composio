import { source, examplesSource, referenceSource, toolkitsSource } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  try {
    const docsPages = source.getPages();
    const examplesPages = examplesSource.getPages();
    const referencePages = referenceSource.getPages();
    const toolkitsPages = toolkitsSource.getPages();

    // Group docs pages by directory
    const groupedDocs = new Map<string, typeof docsPages>();

    for (const page of docsPages) {
      const slugs = page.slugs;
      // Get category from first slug if nested, otherwise 'core'
      const category = slugs.length > 1 ? slugs[0] : 'core';
      if (!groupedDocs.has(category)) {
        groupedDocs.set(category, []);
      }
      groupedDocs.get(category)!.push(page);
    }

    // Format page as simple URL (like Cursor's llms.txt)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatPage = (page: any) =>
      `- https://docs.composio.dev${page.url}.md`;

    // Build sections based on actual folder structure
    const coreDocs = groupedDocs.get('core') || [];
    const providerDocs = groupedDocs.get('providers') || [];
    const toolsDirectDocs = groupedDocs.get('tools-direct') || [];
    const authConfigDocs = groupedDocs.get('auth-configuration') || [];
    const authenticatingUsersDocs = groupedDocs.get('authenticating-users') || [];
    const toolkitsDocs = groupedDocs.get('toolkits') || [];
    const troubleshootingDocs = groupedDocs.get('troubleshooting') || [];
    const migrationDocs = groupedDocs.get('migration-guide') || [];

    const index = `# Composio Documentation

> Composio is the simplest way to connect AI agents to external tools and services. Build AI agents with 800+ tools across GitHub, Slack, Gmail, and more.

## Getting Started

${coreDocs.filter(p => ['quickstart', 'index'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}
${toolsDirectDocs.filter(p => ['authenticating-tools', 'executing-tools', 'fetching-tools'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Core Concepts

${coreDocs.filter(p => ['tools-and-toolkits', 'authentication', 'users-and-sessions', 'configuring-sessions'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Authentication & Users

${authenticatingUsersDocs.map(formatPage).join('\n')}
${coreDocs.filter(p => ['managing-multiple-connected-accounts', 'using-custom-auth-configuration', 'white-labeling-authentication'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Auth Configuration

${authConfigDocs.map(formatPage).join('\n')}

## Tools & Execution

${toolsDirectDocs.filter(p => ['custom-tools', 'toolkit-versioning'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}
${toolkitsDocs.map(formatPage).join('\n')}

## Modify Tool Behavior

${toolsDirectDocs.filter(p => p.slugs.includes('modify-tool-behavior')).map(formatPage).join('\n')}

## MCP (Model Context Protocol)

${coreDocs.filter(p => ['single-toolkit-mcp'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Triggers

${coreDocs.filter(p => ['triggers'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Providers

${providerDocs.map(formatPage).join('\n')}

## Troubleshooting

${troubleshootingDocs.map(formatPage).join('\n')}
${coreDocs.filter(p => ['cli', 'debugging-info'].some(s => p.slugs.includes(s))).map(formatPage).join('\n')}

## Migration Guides

${migrationDocs.map(formatPage).join('\n')}

## Examples

${examplesPages.map(formatPage).join('\n')}

## API Reference

${referencePages.map(formatPage).join('\n')}

## Toolkits

${toolkitsPages.map(formatPage).join('\n')}

## Full Documentation

- https://docs.composio.dev/llms-full.txt
`;

    return new Response(index, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating llms.txt:', error);
    return new Response('Error generating documentation index', { status: 500 });
  }
}
