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

// OpenAPI spec cache
let openapiSpecCache: Record<string, unknown> | null = null;

async function getOpenAPISpec(): Promise<Record<string, unknown>> {
  if (openapiSpecCache) return openapiSpecCache;
  const filePath = join(process.cwd(), 'public/openapi.json');
  const data = await readFile(filePath, 'utf-8');
  const spec = JSON.parse(data) as Record<string, unknown>;
  openapiSpecCache = spec;
  return spec;
}

interface OpenAPIOperation {
  method: string;
  path: string;
  tags?: string[];
}

interface OpenAPIPageData {
  title: string;
  description?: string;
  getAPIPageProps: () => {
    document: string;
    operations?: OpenAPIOperation[];
    webhooks?: { name: string; method: string }[];
  };
}

// Helper to render JSON schema properties as markdown
function renderSchemaProperties(
  schema: Record<string, unknown>,
  indent = 0
): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  if (schema.type === 'object' && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const required = (schema.required as string[]) || [];

    for (const [name, prop] of Object.entries(props)) {
      const isRequired = required.includes(name);
      const type = (prop.type as string) || 'any';
      const desc = (prop.description as string) || '';
      const reqMark = isRequired ? ' **(required)**' : '';

      lines.push(`${prefix}- \`${name}\` (${type})${reqMark}: ${desc}`);

      // Recurse for nested objects
      if (prop.type === 'object' && prop.properties) {
        lines.push(...renderSchemaProperties(prop, indent + 1));
      }
    }
  } else if (schema.oneOf || schema.anyOf) {
    const variants = (schema.oneOf || schema.anyOf) as Record<string, unknown>[];
    lines.push(`${prefix}One of the following:`);
    for (const variant of variants.slice(0, 3)) {
      if (variant.type === 'object') {
        lines.push(...renderSchemaProperties(variant, indent + 1));
      }
    }
  }

  return lines;
}

// Generate cURL example
function generateCurlExample(
  method: string,
  path: string,
  baseUrl: string,
  hasBody: boolean
): string {
  const pathWithExample = path.replace(/\{(\w+)\}/g, 'example_$1');
  let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${pathWithExample}"`;
  curl += ` \\\n  -H "x-api-key: YOUR_API_KEY"`;
  if (hasBody) {
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '{}'`;
  }
  return curl;
}

// Convert OpenAPI page to markdown
async function openapiPageToMarkdown(
  page: { url: string; data: OpenAPIPageData }
): Promise<string> {
  const { title, description } = page.data;
  const props = page.data.getAPIPageProps();
  const spec = await getOpenAPISpec();
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  const securitySchemes = (spec.components as Record<string, unknown>)?.securitySchemes as Record<string, Record<string, unknown>> | undefined;
  const servers = spec.servers as Array<{ url: string; description?: string }> | undefined;
  const baseUrl = servers?.[0]?.url || 'https://backend.composio.dev';

  const lines: string[] = [`# ${title} (${page.url})`, ''];

  if (description) {
    lines.push(description, '');
  }

  // Process operations
  if (props.operations && paths) {
    for (const op of props.operations) {
      const pathData = paths[op.path];
      if (!pathData) continue;

      const methodData = pathData[op.method] as Record<string, unknown> | undefined;
      if (!methodData) continue;

      lines.push(`## ${(op.method as string).toUpperCase()} ${op.path}`, '');
      lines.push(`**Base URL:** \`${baseUrl}\``, '');

      if (methodData.summary) {
        lines.push(`${methodData.summary}`, '');
      }

      if (methodData.description) {
        lines.push(`${methodData.description}`, '');
      }

      // Authentication
      const security = methodData.security as Array<Record<string, string[]>> | undefined;
      if (security && security.length > 0 && securitySchemes) {
        lines.push('### Authentication', '');
        for (const secReq of security) {
          for (const schemeName of Object.keys(secReq)) {
            const scheme = securitySchemes[schemeName];
            if (scheme) {
              const inLoc = scheme.in as string;
              const headerName = scheme.name as string;
              const schemeDesc = scheme.description as string;
              lines.push(`- **${schemeName}**: ${schemeDesc || ''}`);
              lines.push(`  - Type: \`${scheme.type}\``);
              lines.push(`  - In: \`${inLoc}\``);
              lines.push(`  - Header: \`${headerName}\``);
            }
          }
        }
        lines.push('');
      }

      // Parameters
      const parameters = methodData.parameters as Array<{
        name: string;
        in: string;
        description?: string;
        required?: boolean;
        schema?: { type?: string; format?: string; default?: unknown };
      }> | undefined;

      if (parameters && parameters.length > 0) {
        lines.push('### Parameters', '');
        lines.push('| Name | In | Required | Type | Description |');
        lines.push('|------|-----|----------|------|-------------|');
        for (const param of parameters) {
          const type = param.schema?.type || 'string';
          const format = param.schema?.format ? ` (${param.schema.format})` : '';
          const required = param.required ? 'Yes' : 'No';
          const desc = (param.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
          lines.push(`| ${param.name} | ${param.in} | ${required} | ${type}${format} | ${desc} |`);
        }
        lines.push('');
      }

      // Request body
      const requestBody = methodData.requestBody as {
        description?: string;
        required?: boolean;
        content?: Record<string, { schema?: Record<string, unknown> }>;
      } | undefined;

      if (requestBody?.content) {
        lines.push('### Request Body', '');
        if (requestBody.description) {
          lines.push(requestBody.description, '');
        }
        const jsonContent = requestBody.content['application/json'];
        if (jsonContent?.schema) {
          const schemaProps = renderSchemaProperties(jsonContent.schema);
          if (schemaProps.length > 0) {
            lines.push('**Properties:**', '');
            lines.push(...schemaProps);
            lines.push('');
          }
        }
      }

      // Responses
      const responses = methodData.responses as Record<string, {
        description?: string;
        content?: Record<string, { schema?: Record<string, unknown> }>;
      }> | undefined;

      if (responses) {
        // Response status codes table
        lines.push('### Responses', '');
        lines.push('| Status | Description |');
        lines.push('|--------|-------------|');
        for (const [status, response] of Object.entries(responses)) {
          const desc = (response.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
          lines.push(`| ${status} | ${desc} |`);
        }
        lines.push('');

        // Success response body (2xx only)
        for (const [status, response] of Object.entries(responses)) {
          if (!status.startsWith('2')) continue;
          const jsonContent = response.content?.['application/json'];
          if (jsonContent?.schema) {
            const schemaProps = renderSchemaProperties(jsonContent.schema);
            if (schemaProps.length > 0) {
              lines.push(`### Response Body (${status})`, '');
              lines.push(...schemaProps);
              lines.push('');
            }
          }
        }
      }

      // cURL example
      lines.push('### Example Request', '');
      lines.push('```bash');
      lines.push(generateCurlExample(op.method, op.path, baseUrl, !!requestBody?.content));
      lines.push('```', '');
    }
  }

  return lines.join('\n').trim();
}

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
    // Check if this is an OpenAPI page
    if ('getAPIPageProps' in page.data) {
      const markdown = await openapiPageToMarkdown(
        page as { url: string; data: OpenAPIPageData }
      );
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      });
    }

    // Regular MDX page
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Response(await getLLMText(page as any), {
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
