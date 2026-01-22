'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Check, Clipboard } from 'lucide-react';
import { cn } from '@/lib/utils';

function CopyButton({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!containerRef.current) return;
    const pre = containerRef.current.querySelector('pre');
    if (!pre) return;
    const text = pre.textContent || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        'text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted'
      )}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
    </button>
  );
}

export interface CodeTabsProps {
  children: React.ReactNode;
  groupId?: string;
  items: string[];
  persist?: boolean;
}

export function CodeTabs({ children, groupId, items, persist }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(items[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const storageKey = persist && groupId ? `code-tabs-${groupId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored && items.map(i => i.toLowerCase()).includes(stored.toLowerCase())) {
      setActiveTab(stored);
    }
  }, [storageKey, items]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (storageKey) {
      localStorage.setItem(storageKey, value);
    }
  };

  return (
    <div className="my-4 rounded-xl border bg-fd-secondary overflow-hidden">
      <div className="flex items-center justify-between border-b px-1">
        <div className="flex">
          {items.map((item) => {
            const isActive = activeTab.toLowerCase() === item.toLowerCase();
            return (
              <button
                key={item}
                onClick={() => handleTabChange(item)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors relative',
                  isActive
                    ? 'text-fd-primary'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                )}
              >
                {item}
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-fd-primary" />
                )}
              </button>
            );
          })}
        </div>
        <div className="pr-2">
          <CopyButton containerRef={containerRef} />
        </div>
      </div>

      {/* DEBUG: Just render children directly */}
      <div
        ref={containerRef}
        className="[&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:bg-transparent [&_pre]:my-0 [&_pre]:rounded-none [&_pre]:border-0 [&_pre]:bg-transparent [&_figure>div:last-child]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

export interface CodeTabProps {
  children: React.ReactNode;
  value: string;
}

export function CodeTab({ children }: CodeTabProps) {
  return <>{children}</>;
}
