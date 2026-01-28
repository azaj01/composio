// Test imports one by one to find the failing one
export async function GET() {
  const errors: string[] = [];

  try {
    const { docs } = await import('fumadocs-mdx:collections/server');
    if (!docs) errors.push('docs is undefined');
  } catch (e) {
    errors.push(`fumadocs-mdx:collections/server: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { loader } = await import('fumadocs-core/source');
    if (!loader) errors.push('loader is undefined');
  } catch (e) {
    errors.push(`fumadocs-core/source: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { source } = await import('@/lib/source');
    if (!source) errors.push('source is undefined');
  } catch (e) {
    errors.push(`@/lib/source: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length === 0) {
    return new Response('# All imports successful!\n\nNo errors found.', {
      headers: { 'Content-Type': 'text/markdown' },
    });
  }

  return new Response(`# Import Errors\n\n${errors.map(e => `- ${e}`).join('\n')}`, {
    headers: { 'Content-Type': 'text/markdown' },
  });
}
