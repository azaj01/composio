import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  try {
    const pages = source.getPages();
    const results = await Promise.all(
      pages.map(async (page) => {
        try {
          return await getLLMText(page);
        } catch {
          // Graceful fallback if getText fails
          return `# ${page.data.title} (${page.url})\n\n${page.data.description || ''}`;
        }
      })
    );

    return new Response(results.join('\n\n---\n\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[llms-full.txt] Error generating content:', error);
    return new Response('Error generating LLM content', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
