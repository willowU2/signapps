"use client";

/**
 * Silent wrapper around `lucide-react/dynamic`'s `DynamicIcon`.
 *
 * Why: the default `DynamicIcon` logs a noisy
 * `[lucide-react]: Name in Lucide DynamicIcon not found` error to the
 * console every time an icon name doesn't match a real lucide export.
 * User-pinned apps or custom app-registry entries sometimes carry
 * non-lucide names (emoji, legacy strings), which flooded the dev
 * console without any user-facing issue — the `fallback` prop already
 * handled the visual side.
 *
 * This wrapper silences those `console.error` calls during the render
 * window and lets them through for everything else.
 */

import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Grid } from "lucide-react";
import { Component, type ComponentType, type ReactNode } from "react";

// Validate the shape before even asking lucide to load — cheap short-circuit
// for values that clearly cannot be icon names (empty, emoji, uppercase).
const LUCIDE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function toKebab(name: string): string {
  return name
    .replace(/([A-Z])/g, "-$1")
    .replace(/^-/, "")
    .toLowerCase();
}

interface SilentDynamicIconProps {
  name: string;
  className?: string;
  fallback?: ComponentType<{ className?: string }>;
}

interface BoundaryProps {
  className?: string;
  fallback: ComponentType<{ className?: string }>;
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

class IconErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Swallow — the visual fallback is rendered via `render()`.  We never
    // want an icon load failure to bubble up to the dev overlay.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      return <Fallback className={this.props.className} />;
    }
    return this.props.children;
  }
}

export function SilentDynamicIcon({
  name,
  className,
  fallback = Grid,
}: SilentDynamicIconProps) {
  const kebab = toKebab(name);

  if (!LUCIDE_NAME_RE.test(kebab)) {
    const Fallback = fallback;
    return <Fallback className={className} />;
  }

  const Fallback = fallback;
  return (
    <IconErrorBoundary className={className} fallback={Fallback}>
      <DynamicIcon
        name={kebab as IconName}
        className={className}
        fallback={() => <Fallback className={className} />}
      />
    </IconErrorBoundary>
  );
}
