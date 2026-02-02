'use client';

import { useState, useEffect, type ReactElement } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
// Static import ensures CSS is available before any zoom interaction
import 'react-medium-image-zoom/dist/styles.css';

type FigureSize = 'sm' | 'md' | 'lg' | 'full';

interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  size?: FigureSize;
  className?: string;
  width?: number;
  height?: number;
  /** Set to true for above-the-fold images to prioritize LCP */
  priority?: boolean;
}

const sizeClasses: Record<FigureSize, string> = {
  sm: 'max-w-[300px]',   // Small dialogs, icons
  md: 'max-w-[500px]',   // Medium screenshots
  lg: 'max-w-[700px]',   // Large screenshots
  full: 'max-w-full',    // Full-width diagrams
};

// Default dimensions per size to minimize CLS
const defaultDimensions: Record<FigureSize, { width: number; height: number }> = {
  sm: { width: 300, height: 200 },
  md: { width: 500, height: 333 },
  lg: { width: 700, height: 467 },
  full: { width: 900, height: 600 },
};

// Responsive sizes for optimal image loading
const sizesAttr: Record<FigureSize, string> = {
  sm: '(max-width: 640px) 100vw, 300px',
  md: '(max-width: 640px) 100vw, 500px',
  lg: '(max-width: 640px) 100vw, (max-width: 768px) 90vw, 700px',
  full: '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, min(900px, 70vw)',
};

// Client-side zoom wrapper that renders children immediately (for SSR)
// and wraps with zoom functionality after hydration
function ClientZoom({ children, zoomSrc }: { children: ReactElement; zoomSrc: string }) {
  const [Zoom, setZoom] = useState<React.ComponentType<{ children: ReactElement; zoomImg: { src: string } }> | null>(null);

  useEffect(() => {
    // Dynamically load zoom component on client (CSS is statically imported)
    import('react-medium-image-zoom').then((mod) => {
      setZoom(() => mod.default);
    });
  }, []);

  // SSR and initial client render: just the image
  // After zoom loads: wrap with zoom functionality
  if (!Zoom) {
    return children;
  }

  return <Zoom zoomImg={{ src: zoomSrc }}>{children}</Zoom>;
}

export function Figure({ src, alt, caption, size = 'full', className, width, height, priority = false }: FigureProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const isConstrained = size !== 'full';
  const dimensions = defaultDimensions[size];

  // Show image on load or error (so broken images are visible for debugging)
  const handleReady = () => setIsLoaded(true);

  const image = (
    <Image
      src={src}
      alt={alt}
      width={width || dimensions.width}
      height={height || dimensions.height}
      sizes={sizesAttr[size]}
      priority={priority}
      onLoad={handleReady}
      onError={handleReady}
      className={cn(
        'rounded-lg border border-fd-border transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        sizeClasses[size],
        isConstrained ? 'w-auto h-auto' : 'w-full h-auto'
      )}
    />
  );

  return (
    <figure className={cn('my-8', isConstrained && 'flex flex-col items-center', className)}>
      <ClientZoom zoomSrc={src}>{image}</ClientZoom>
      {caption && (
        <figcaption className="mt-3 text-sm text-fd-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
