/**
 * SmartAvatar — SO4 IN4 universal avatar.
 *
 * Renders a person photo when `photoUrl` is provided AND loads
 * successfully, otherwise falls back to a tinted initials badge using
 * the existing org-structure helpers (`avatarTint`, `personInitials`).
 *
 * No JS-heavy fallback chain — `<img onError>` swaps a single boolean
 * to switch from raster to text. Works in SSR (the initial render is
 * the photo when given; failure surfaces on the client only).
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type SmartAvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<SmartAvatarSize, string> = {
  sm: "h-6 w-6 text-[0.6rem]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-14 w-14 text-base",
};

export interface SmartAvatarProps {
  /** Photo URL — defers to initials when null/undefined or on load error. */
  photoUrl?: string | null;
  /** Initials shown in the fallback (auto-uppercased / clamped to 2). */
  initials: string;
  /**
   * Tailwind classes applied to the fallback bubble (e.g. the result of
   * `avatarTint(personId)`).
   */
  tintClass: string;
  /** Accessible description (alt text for the photo, aria-label for SVG). */
  alt: string;
  /** Avatar size token. */
  size?: SmartAvatarSize;
  /** Extra classes merged on the outer element. */
  className?: string;
}

/**
 * Universal avatar — photo first, tinted initials as fallback.
 */
export function SmartAvatar(props: SmartAvatarProps) {
  const { photoUrl, initials, tintClass, alt, size = "md", className } = props;
  const [errored, setErrored] = useState(false);
  const sizeClass = SIZE_CLASS[size];
  const showPhoto = photoUrl && !errored;

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions
      <img
        src={photoUrl}
        alt={alt}
        className={cn(
          "inline-block rounded-full object-cover",
          sizeClass,
          className,
        )}
        onError={() => setErrored(true)}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const text = initials.slice(0, 2).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold uppercase",
        sizeClass,
        tintClass,
        className,
      )}
      aria-label={alt}
      role="img"
    >
      {text}
    </span>
  );
}

export default SmartAvatar;
