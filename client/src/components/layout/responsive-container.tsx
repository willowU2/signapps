import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: ReactNode;
  /** Override the default max-width constraint */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Extra classes forwarded to the wrapper element */
  className?: string;
  /** Render as a different HTML element (default: div) */
  as?: "div" | "section" | "article" | "main";
}

const MAX_WIDTH_CLASSES: Record<
  NonNullable<ResponsiveContainerProps["maxWidth"]>,
  string
> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

/**
 * ResponsiveContainer — wraps page content with adaptive padding and a
 * centred max-width that scales across mobile / tablet / desktop breakpoints.
 *
 * Mobile  (<768px)  : px-4  py-4   — tight, full-width
 * Tablet  (768px+)  : px-6  py-6   — moderate breathing room
 * Desktop (1024px+) : px-8  py-8   — generous, centred column
 */
export function ResponsiveContainer({
  children,
  maxWidth = "2xl",
  className,
  as: Tag = "div",
}: ResponsiveContainerProps) {
  return (
    <Tag
      className={cn(
        "w-full mx-auto",
        "px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8",
        // Add bottom padding on mobile to avoid content being hidden behind
        // the fixed MobileBottomNav bar (h-16 = 4rem)
        "pb-20 md:pb-6 lg:pb-8",
        MAX_WIDTH_CLASSES[maxWidth],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
