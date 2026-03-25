'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallback?: string;
  wrapperClassName?: string;
}

/**
 * Wrapper around next/image with lazy loading, blur placeholder, and fallback.
 * Use this instead of <img> or <NextImage> directly throughout the app.
 */
export function OptimizedImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallback = '/placeholder.svg',
  fill,
  width,
  height,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imgSrc = error ? fallback : src;

  return (
    <span
      className={cn(
        'relative inline-block overflow-hidden',
        !loaded && 'bg-muted animate-pulse',
        wrapperClassName,
      )}
      style={
        fill
          ? { display: 'block', width: '100%', height: '100%' }
          : { display: 'inline-block', width, height }
      }
    >
      <NextImage
        src={imgSrc}
        alt={alt}
        loading="lazy"
        fill={fill}
        width={fill ? undefined : (width as number)}
        height={fill ? undefined : (height as number)}
        className={cn('transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        {...props}
      />
    </span>
  );
}

export default OptimizedImage;
