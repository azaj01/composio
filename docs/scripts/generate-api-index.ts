/**
 * Generates simple markdown index pages for each OpenAPI tag.
 * These pages provide:
 * - Tag description from OpenAPI spec
 * - Links to all endpoints in that tag
 *
 * Run: bun scripts/generate-api-index.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface OpenAPISpec {
  tags: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, { summary?: string; tags?: string[]; description?: string }>>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateIndexPages() {
  // Read OpenAPI spec
  const specPath = join(process.cwd(), 'public/openapi.json');
  const spec: OpenAPISpec = JSON.parse(readFileSync(specPath, 'utf-8'));

  // Build tag -> operations map
  const tagOperations: Record<string, Array<{ summary: string; description?: string; method: string; path: string }>> = {};
  const tagDescriptions: Record<string, string> = {};

  // Get tag descriptions
  for (const tag of spec.tags) {
    tagDescriptions[tag.name] = tag.description || '';
    tagOperations[tag.name] = [];
  }

  // Group operations by tag
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.tags) {
        for (const tag of operation.tags) {
          if (!tagOperations[tag]) {
            tagOperations[tag] = [];
          }
          tagOperations[tag].push({
            summary: operation.summary || `${method.toUpperCase()} ${path}`,
            description: operation.description,
            method: method.toUpperCase(),
            path,
          });
        }
      }
    }
  }

  // Generate MDX files for each tag
  const outputDir = join(process.cwd(), 'content/reference/api-reference');
  mkdirSync(outputDir, { recursive: true });

  for (const [tagName, operations] of Object.entries(tagOperations)) {
    if (operations.length === 0) continue;

    const tagSlug = slugify(tagName);
    const tagDescription = tagDescriptions[tagName] || `${tagName} API endpoints`;

    // Generate endpoint links
    const endpointLinks = operations.map(op => {
      const endpointSlug = slugify(op.summary);
      const url = `/reference/api-reference/${tagSlug}/${endpointSlug}`;
      return `- [${op.summary}](${url})`;
    }).join('\n');

    const content = `---
title: ${tagName}
description: "${tagDescription}"
---

{/* Auto-generated from OpenAPI spec. Do not edit directly. */}

${tagDescription}

## Endpoints

${endpointLinks}
`;

    const filePath = join(outputDir, `${tagSlug}.mdx`);
    writeFileSync(filePath, content);
    console.log(`Generated: ${tagSlug}.mdx`);
  }

  console.log('Done generating API index pages');
}

generateIndexPages();
