import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { SidebarTrigger } from 'fumadocs-ui/components/sidebar/base';
import { Menu } from 'lucide-react';

// Insert changelog into page tree at correct position (after capabilities, before Tools and Triggers)
const changelogPage = { type: 'page' as const, name: 'Changelog', url: '/docs/changelog' };
const pageTree = {
  ...source.pageTree,
  children: source.pageTree.children.flatMap((child) =>
    child.type === 'separator' && child.name === 'Tools and Triggers'
      ? [changelogPage, child]
      : [child]
  ) as typeof source.pageTree.children,
};

// Minimal mobile header - only shows sidebar trigger, hidden on desktop
function MobileSidebarNav() {
  return (
    <header className="sticky top-14 z-30 flex items-center h-12 px-4 border-b bg-fd-background/80 backdrop-blur-sm md:hidden">
      <SidebarTrigger className="p-2 -ml-2 rounded-md hover:bg-fd-accent">
        <Menu className="size-5" />
      </SidebarTrigger>
    </header>
  );
}

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={pageTree}
      nav={{ enabled: true, title: null, component: <MobileSidebarNav /> }}
      searchToggle={{ enabled: false }}
      sidebar={{ collapsible: false, footer: null }}
      themeSwitch={{ enabled: false }}
    >
      {children}
    </DocsLayout>
  );
}
