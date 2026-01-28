export async function GET() {
  return new Response('# Test\n\nThis is a test route.', {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
