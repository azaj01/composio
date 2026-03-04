'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function Mermaid({ chart }: { chart: string }) {
  const renderCount = useRef(0);
  const baseId = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    const renderDiagram = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const orange = getCssVar('--composio-orange');
      const bg = isDark ? getCssVar('--color-fd-muted') : getCssVar('--color-fd-card');
      const fg = getCssVar('--color-fd-foreground');
      const border = getCssVar('--color-fd-border');

      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: bg,
          primaryColor: bg,
          primaryBorderColor: orange,
          primaryTextColor: fg,
          lineColor: orange,
          secondaryColor: bg,
          tertiaryColor: bg,
          edgeLabelBackground: bg,
          clusterBkg: bg,
          clusterBorder: border,
        },
        fontFamily: 'inherit',
      });

      const uniqueId = `${baseId.current}-${renderCount.current++}`;
      mermaid.render(uniqueId, chart).then((result) => {
        setSvg(result.svg);
      });
    };

    renderDiagram();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          renderDiagram();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [chart]);

  if (!svg) return null;

  return (
    <div className="my-4 max-w-full mx-auto">
      <Zoom>
        <img
          src={svgToDataUrl(svg)}
          alt="Mermaid diagram"
          className="mx-auto"
        />
      </Zoom>
    </div>
  );
}
