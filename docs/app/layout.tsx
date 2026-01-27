import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import Script from 'next/script';
import './global.css';
import { IBM_Plex_Mono } from 'next/font/google';
import { PostHogProvider } from '@/components/posthog-provider';

export const metadata: Metadata = {
  title: {
    default: 'Composio Docs',
    template: '%s | Composio',
  },
  description: 'Build AI agents with 250+ tools. Connect LLMs to external services like GitHub, Slack, Gmail, and more.',
  metadataBase: new URL('https://docs.composio.dev'),
  openGraph: {
    title: 'Composio Docs',
    description: 'Build AI agents with 250+ tools. Connect LLMs to external services like GitHub, Slack, Gmail, and more.',
    siteName: 'Composio Docs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Composio Docs',
    description: 'Build AI agents with 250+ tools. Connect LLMs to external services like GitHub, Slack, Gmail, and more.',
  },
};

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={ibmPlexMono.variable}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#131211" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen font-sans">
        <PostHogProvider>
          <RootProvider
            theme={{
              defaultTheme: 'light',
              attribute: 'class',
              enableSystem: false,
            }}
            search={{
              options: {
                api: '/api/search',
              },
            }}
          >
            {children}
          </RootProvider>
        </PostHogProvider>
        <Script
          src="https://app.getdecimal.ai/widget/v1/widget.js"
          data-widget-id="wgt_Ze0kCx97w7YXIydXpEAbAVWfu7FO6HG1"
          data-public-config="eyJhbGciOiJIUzI1NiJ9.eyJ3aWQiOiJ3Z3RfWmUwa0N4OTd3N1lYSXlkWHBFQWJBVldmdTdGTzZIRzEiLCJkb21haW5zIjpbImNvbXBvc2lvLmRldiIsImNvbXBvc2lvLWRlY2ltYWwudmVyY2VsLmFwcCIsImxvY2FsaG9zdDozMDAwIiwiZG9jcy5jb21wb3Npby5kZXYiXSwiaWF0IjoxNzY3Mzc2ODkyfQ.Aflg_XVLCmd2tY9P9h4YWle2FKA_DRZFLBhp0yClJCE"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
