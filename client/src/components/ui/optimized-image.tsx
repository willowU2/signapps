"use client";

import NextImage, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// A tiny 8x8 gray pixel encoded as base64 — used as blur placeholder
// when no blurDataURL is provided. Avoids layout shift and gives instant
// visual feedback before the real image loads.
const BLUR_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAS0lEQVQoU2NkYGD4z8BQDwAEhgF/h6hKRgAAAABJRU5ErkJggg==";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
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
  fallback = "/placeholder.svg",
  fill,
  width,
  height,
  placeholder,
  blurDataURL,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imgSrc = error ? fallback : src;

  // Default to blur placeholder unless caller explicitly passes 'empty' or a custom blurDataURL
  const resolvedPlaceholder = placeholder ?? "blur";
  const resolvedBlurDataURL = blurDataURL ?? BLUR_PLACEHOLDER;

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden",
        !loaded && "bg-muted",
        wrapperClassName,
      )}
      style={
        fill
          ? { display: "block", width: "100%", height: "100%" }
          : { display: "inline-block", width, height }
      }
    >
      <NextImage
        src={imgSrc}
        alt={alt}
        loading="lazy"
        fill={fill}
        width={fill ? undefined : (width as number)}
        height={fill ? undefined : (height as number)}
        placeholder={resolvedPlaceholder}
        blurDataURL={resolvedBlurDataURL}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        {...props}
      />
    </span>
  );
}

export default OptimizedImage;
