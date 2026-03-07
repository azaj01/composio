'use client';

import { useState, useRef, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

interface PromptBannerProps {
  children: ReactNode;
}

export function PromptBanner({ children }: PromptBannerProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    const text = contentRef.current?.innerText ?? '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="not-prose mb-6">
      <div className="relative flex items-center justify-between gap-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card px-5 py-4">
        {/* Shader gradient blobs */}
        <div
          className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,139,60,0.15) 0%, rgba(242,139,60,0) 70%)' }}
        />
        <div
          className="pointer-events-none absolute right-20 -bottom-24 h-48 w-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,139,60,0.1) 0%, rgba(242,139,60,0) 70%)' }}
        />
        <div
          className="pointer-events-none absolute left-72 -top-20 h-44 w-44 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0) 70%)' }}
        />

        {/* Sparkle */}
        <svg className="relative shrink-0" width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 2L16.1 11.9L26 14L16.1 16.1L14 26L11.9 16.1L2 14L11.9 11.9L14 2Z" fill="var(--composio-orange)" opacity="0.25"/>
        </svg>

        <p className="relative flex-1 text-[15px] text-fd-foreground/70">
          Use skills or copy prompt to get started faster!
        </p>

        <div className="relative flex shrink-0 items-center gap-3">
          <a
            href="https://skills.sh/composiohq/skills/composio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--composio-orange)]/30 bg-transparent px-4 py-2 text-sm font-medium text-[var(--composio-orange)] transition-all hover:border-[var(--composio-orange)]/60 hover:bg-[var(--composio-orange)]/5"
          >
            Skills
            <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.98] ${copied ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500' : 'border-transparent bg-[var(--composio-orange)] text-white shadow-sm hover:brightness-110'}`}
          >
            {copied ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy prompt'}
          </button>
        </div>
      </div>
      {/* Hidden prompt content for copy button */}
      <div ref={contentRef} className="hidden">{children}</div>
    </div>
  );
}
