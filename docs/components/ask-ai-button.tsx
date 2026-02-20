'use client';

import { useEffect, useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { useSearchContext } from '@fumadocs/ui/contexts/search';
import { useI18n } from '@fumadocs/ui/contexts/i18n';

function openDecimalWidget() {
  // Try the global API first
  const win = window as typeof window & { Decimal?: Record<string, unknown> };
  if (win.Decimal) {
    for (const key of ['open', 'toggle', 'show'] as const) {
      if (typeof win.Decimal[key] === 'function') {
        (win.Decimal[key] as () => void)();
        return;
      }
    }
  }
  // Fallback: find and click the widget's launcher button in the DOM
  const launcher =
    document.querySelector<HTMLElement>('[data-decimal-widget]') ??
    document.querySelector<HTMLElement>('[class*="decimal" i]') ??
    document.querySelector<HTMLElement>('#decimal-widget button');
  launcher?.click();
}

function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'));
  }, []);
  return isMac;
}

let shortcutRegistered = false;

function useAskAIShortcut() {
  useEffect(() => {
    if (shortcutRegistered) return;
    shortcutRegistered = true;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        openDecimalWidget();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      shortcutRegistered = false;
    };
  }, []);
}

/** Desktop: search bar + Ask AI button side by side */
export function SearchAndAskAI() {
  const { enabled, hotKey, setOpenSearch } = useSearchContext();
  const { text } = useI18n();
  useAskAIShortcut();
  const isMac = useIsMac();

  return (
    <>
      {enabled && (
        <button
          type="button"
          data-search-full=""
          className="inline-flex items-center gap-2 rounded-full border bg-fd-secondary/50 p-1.5 ps-2.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground w-full max-w-[240px]"
          onClick={() => setOpenSearch(true)}
        >
          <Search className="size-4" />
          {text.search}
          <div className="ms-auto inline-flex gap-0.5">
            {hotKey.map((k, i) => (
              <kbd key={i} className="rounded-md border bg-fd-background px-1.5">
                {k.display}
              </kbd>
            ))}
          </div>
        </button>
      )}
      <button
        type="button"
        onClick={openDecimalWidget}
        className="inline-flex items-center gap-2 rounded-lg border bg-fd-secondary/50 p-1.5 ps-2.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground shrink-0"
      >
        Ask AI
        <div className="hidden xl:inline-flex gap-0.5">
          <kbd className="rounded-md border bg-fd-background px-1.5">{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className="rounded-md border bg-fd-background px-1.5">I</kbd>
        </div>
      </button>
    </>
  );
}

/** Mobile: search icon + Ask AI icon, shown below lg breakpoint */
export function SearchAndAskAIMobile() {
  const { enabled, setOpenSearch } = useSearchContext();

  return (
    <>
      {enabled && (
        <button
          type="button"
          data-search=""
          aria-label="Open Search"
          className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground"
          onClick={() => setOpenSearch(true)}
        >
          <Search className="size-4.5" />
        </button>
      )}
      <button
        type="button"
        aria-label="Ask AI"
        onClick={openDecimalWidget}
        className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        <MessageSquare className="size-4.5" />
      </button>
    </>
  );
}
