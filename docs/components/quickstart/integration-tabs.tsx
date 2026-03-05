'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface TabConfig {
  value: string;
  label: string;
  icon?: string;
  iconDark?: string;
}

const defaultTabs: TabConfig[] = [
  { value: 'native', label: 'Native Tools', icon: '/images/providers/native-tools-logo.svg', iconDark: '/images/providers/native-tools-logo-dark.svg' },
  { value: 'mcp', label: 'MCP', icon: '/images/mcp-logo.svg', iconDark: '/images/mcp-logo-dark.svg' },
];

interface IntegrationTabsProps {
  children: ReactNode;
  defaultValue?: string;
  tabs?: TabConfig[];
}

function IntegrationTabsHeader({ tabs }: { tabs: TabConfig[] }) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('integration-tabs-portal'));
  }, []);

  const header = (
    <div className="mt-4 border-t border-fd-border pt-4">
      <p className="mb-3 text-sm font-medium text-fd-muted-foreground">Choose your integration type · <Link href="/docs/native-tools-vs-mcp" className="text-fd-muted-foreground hover:text-fd-foreground transition-colors underline underline-offset-2">Use this guide to decide</Link></p>
      <div className="flex items-center gap-3">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.icon && tab.iconDark && (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <Image
                    src={tab.icon}
                    alt={tab.label}
                    width={16}
                    height={16}
                    className="h-4 w-4 dark:hidden"
                  />
                  <Image
                    src={tab.iconDark}
                    alt={tab.label}
                    width={16}
                    height={16}
                    className="hidden h-4 w-4 dark:block"
                  />
                </div>
              )}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );

  if (portalTarget) {
    return createPortal(header, portalTarget);
  }

  // Fallback: render inline if portal target not found
  return <div className="mb-5">{header}</div>;
}

export function IntegrationTabs({ children, defaultValue, tabs = defaultTabs }: IntegrationTabsProps) {
  return (
    <Tabs defaultValue={defaultValue ?? tabs[0]?.value ?? 'native'} className="not-prose">
      <IntegrationTabsHeader tabs={tabs} />
      {children}
    </Tabs>
  );
}

export function IntegrationContent({
  value,
  children
}: {
  value: string;
  children: ReactNode;
}) {
  return <TabsContent value={value}>{children}</TabsContent>;
}
