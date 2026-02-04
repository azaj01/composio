'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <h1 style={{ fontSize: '6rem', fontWeight: 700, letterSpacing: '-0.05em', color: 'rgba(0,0,0,0.1)', margin: 0, lineHeight: 1 }}>
            500
          </h1>
          <div style={{ marginTop: '0.5rem', textAlign: 'center', maxWidth: '28rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
              Something went wrong
            </h2>
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.875rem' }}>
              An unexpected error occurred. Try again or head back to the docs.
            </p>
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, borderRadius: '0.5rem', border: 'none', background: '#171414', color: '#fff', cursor: 'pointer' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, borderRadius: '0.5rem', border: '1px solid #e5e0df', background: '#fff', color: '#171414', textDecoration: 'none' }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
