'use client';

import { useState } from 'react';
import Image from 'next/image';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import { cn } from '@/lib/utils';

type FigureSize = 'sm' | 'md' | 'lg' | 'full';

interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  size?: FigureSize;
  className?: string;
  width?: number;
  height?: number;
}

const sizeClasses: Record<FigureSize, string> = {
  sm: 'max-w-[300px]',   // Small dialogs, icons
  md: 'max-w-[500px]',   // Medium screenshots
  lg: 'max-w-[700px]',   // Large screenshots
  full: 'max-w-full',    // Full-width diagrams
};

const sizesAttr: Record<FigureSize, string> = {
  sm: '(max-width: 300px) 100vw, 300px',
  md: '(max-width: 500px) 100vw, 500px',
  lg: '(max-width: 700px) 100vw, 700px',
  full: '(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px',
};

export function Figure({ src, alt, caption, size = 'full', className, width, height }: FigureProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const isConstrained = size !== 'full';

  return (
    <figure className={cn('my-8', isConstrained && 'flex flex-col items-center', className)}>
      <Zoom zoomImg={{ src }}>
        <Image
          src={src}
          alt={alt}
          width={width || 1200}
          height={height || 800}
          sizes={sizesAttr[size]}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            'rounded-lg border border-fd-border transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            sizeClasses[size],
            isConstrained ? 'w-auto h-auto' : 'w-full h-auto'
          )}
        />
      </Zoom>
      {caption && (
        <figcaption className="mt-3 text-sm text-fd-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
