import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createMDX } from 'fumadocs-mdx/next';

const __dirname = dirname(fileURLToPath(import.meta.url));
const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // Support .md and .mdx extensions for AI agents across all sections
      // Docs
      { source: '/docs/:path*.mdx', destination: '/llms.mdx/docs/:path*' },
      { source: '/docs/:path*.md', destination: '/llms.mdx/docs/:path*' },
      { source: '/docs.md', destination: '/llms.mdx/docs' },
      { source: '/docs.mdx', destination: '/llms.mdx/docs' },
      // Tool Router
      { source: '/tool-router/:path*.mdx', destination: '/llms.mdx/tool-router/:path*' },
      { source: '/tool-router/:path*.md', destination: '/llms.mdx/tool-router/:path*' },
      { source: '/tool-router.md', destination: '/llms.mdx/tool-router' },
      { source: '/tool-router.mdx', destination: '/llms.mdx/tool-router' },
      // Examples
      { source: '/examples/:path*.mdx', destination: '/llms.mdx/examples/:path*' },
      { source: '/examples/:path*.md', destination: '/llms.mdx/examples/:path*' },
      { source: '/examples.md', destination: '/llms.mdx/examples' },
      { source: '/examples.mdx', destination: '/llms.mdx/examples' },
      // Reference
      { source: '/reference/:path*.mdx', destination: '/llms.mdx/reference/:path*' },
      { source: '/reference/:path*.md', destination: '/llms.mdx/reference/:path*' },
      { source: '/reference.md', destination: '/llms.mdx/reference' },
      { source: '/reference.mdx', destination: '/llms.mdx/reference' },
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/docs',
        permanent: false,
      },
      {
        source: '/docs/welcome',
        destination: '/docs',
        permanent: true,
      },
      {
        source: '/tool-router/overview',
        destination: '/tool-router',
        permanent: true,
      },
      // Provider redirects (old fern URLs -> new docs URLs)
      {
        source: '/providers/openai',
        destination: '/docs/providers/openai',
        permanent: true,
      },
      {
        source: '/providers/anthropic',
        destination: '/docs/providers/anthropic',
        permanent: true,
      },
      {
        source: '/providers/google',
        destination: '/docs/providers/google',
        permanent: true,
      },
      {
        source: '/providers/langchain',
        destination: '/docs/providers/langchain',
        permanent: true,
      },
      {
        source: '/providers/llamaindex',
        destination: '/docs/providers/llamaindex',
        permanent: true,
      },
      {
        source: '/providers/crewai',
        destination: '/docs/providers/crewai',
        permanent: true,
      },
      {
        source: '/providers/vercel',
        destination: '/docs/providers/vercel',
        permanent: true,
      },
      {
        source: '/providers/openai-agents',
        destination: '/docs/providers/openai-agents',
        permanent: true,
      },
      {
        source: '/providers/mastra',
        destination: '/docs/providers/mastra',
        permanent: true,
      },
      {
        source: '/providers/custom/typescript',
        destination: '/docs/providers/custom-providers/typescript',
        permanent: true,
      },
      {
        source: '/providers/custom/python',
        destination: '/docs/providers/custom-providers/python',
        permanent: true,
      },
      // API reference redirects
      {
        source: '/api-reference',
        destination: '/reference',
        permanent: true,
      },
      {
        source: '/api-reference/:path*',
        destination: '/reference/:path*',
        permanent: true,
      },
      {
        source: '/rest-api/:path*',
        destination: '/reference/api-reference/:path*',
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
