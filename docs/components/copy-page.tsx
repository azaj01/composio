'use client';

import { useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';

interface CopyPageProps {
  /** The URL path to fetch markdown from (e.g., /docs/quickstart) */
  path: string;
}

/**
 * Button that copies the current page's markdown content to clipboard.
 * Fetches from the .md endpoint for clean, AI-friendly content.
 */
export function CopyPage({ path }: CopyPageProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied'>('idle');

  const handleCopy = async () => {
    setState('loading');

    try {
      const response = await fetch(`${path}.md`);
      if (!response.ok) throw new Error('Failed to fetch');

      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);

      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={state === 'loading'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground bg-fd-secondary hover:bg-fd-accent rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-50"
      aria-label="Copy page as markdown"
    >
      {state === 'loading' ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : state === 'copied' ? (
        <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
      ) : (
        <Copy className="w-4 h-4" aria-hidden="true" />
      )}
      {state === 'copied' ? 'Copied!' : 'Copy page'}
    </button>
  );
}
