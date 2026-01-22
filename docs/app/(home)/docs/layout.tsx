import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
// Insert changelog into page tree at correct position (after Get Started, before Core Concepts)
const changelogPage = { type: 'page' as const, name: 'Changelog', url: '/docs/changelog' };
const pageTree = {
  ...source.pageTree,
  children: source.pageTree.children.flatMap((child) =>
    child.type === 'separator' && child.name === 'Core Concepts'
      ? [changelogPage, child]
      : [child]
  ) as typeof source.pageTree.children,
};

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={pageTree}
      nav={{ enabled: true, title: null }}
      sidebar={{ collapsible: false, footer: null, tabs: false }}
      themeSwitch={{ enabled: false }}
      searchToggle={{ enabled: false }}
    >
      {children}
    </DocsLayout>
  );
}
