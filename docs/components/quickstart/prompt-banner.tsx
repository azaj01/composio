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
        {/* Ambient glow behind sparkle */}
        <div
          className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 h-32 w-32 rounded-full blur-2xl opacity-[0.12] dark:opacity-[0.15]"
          style={{ background: 'var(--composio-orange)' }}
        />

        {/* Large 4-point star */}
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-[0.15] dark:opacity-[0.15]">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 4C20 4 22 16 20 20C18 16 20 4 20 4Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M20 36C20 36 18 24 20 20C22 24 20 36 20 36Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M4 20C4 20 16 18 20 20C16 22 4 20 4 20Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M36 20C36 20 24 22 20 20C24 18 36 20 36 20Z"
              fill="var(--composio-orange)"
            />
          </svg>
        </div>

        {/* Small 4-point star accent */}
        <div className="pointer-events-none absolute left-11 top-1.5 opacity-[0.2] dark:opacity-[0.2]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1C7 1 7.8 5.5 7 7C6.2 5.5 7 1 7 1Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M7 13C7 13 6.2 8.5 7 7C7.8 8.5 7 13 7 13Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M1 7C1 7 5.5 6.2 7 7C5.5 7.8 1 7 1 7Z"
              fill="var(--composio-orange)"
            />
            <path
              d="M13 7C13 7 8.5 7.8 7 7C8.5 6.2 13 7 13 7Z"
              fill="var(--composio-orange)"
            />
          </svg>
        </div>

        <p className="relative pl-10 text-[15px] text-fd-foreground/70">
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
            <span aria-hidden="true">→</span>
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
