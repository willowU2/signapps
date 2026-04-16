"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

/**
 * Icon-only button with a mandatory `aria-label` that doubles as the
 * tooltip text.
 *
 * Ship this instead of hand-wiring `<Tooltip><TooltipTrigger asChild>
 * <Button variant="ghost" size="icon">...</Button></TooltipTrigger>
 * <TooltipContent>...</TooltipContent></Tooltip>` — those hand-wired
 * sites are the dominant source of axe `button-name` violations in the
 * codebase (see `docs/bug-sweep/a11y-axe-summary.md`).
 *
 * The `label` prop is required by the type signature, so TypeScript
 * refuses to render this component without an accessible name. The
 * label is applied to both the `<button>` (as `aria-label`) and the
 * tooltip (as visible text).
 *
 * A single-element child is expected — typically a lucide-react icon —
 * which is automatically marked `aria-hidden` so screen readers
 * announce only the label.
 *
 * @example
 * ```tsx
 * <TooltipIconButton
 *   label="Épingler la barre latérale"
 *   variant="ghost"
 *   size="icon-sm"
 *   onClick={togglePin}
 * >
 *   <Pin className="h-4 w-4" />
 * </TooltipIconButton>
 * ```
 */
export interface TooltipIconButtonProps extends Omit<
  React.ComponentProps<typeof Button>,
  "aria-label" | "title"
> {
  /** Accessible name for the button AND visible text in the tooltip. */
  label: string;
  /** Tooltip side. Defaults to "top". */
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /**
   * Optional override — if present, the tooltip shows this text instead
   * of `label` (but the button's `aria-label` still uses `label`). Use
   * sparingly, e.g. to add a keyboard shortcut hint to the visible
   * tooltip while keeping the accessible name concise.
   */
  tooltipText?: React.ReactNode;
}

export const TooltipIconButton = React.forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(function TooltipIconButton(
  {
    label,
    tooltipSide = "top",
    tooltipText,
    children,
    variant = "ghost",
    size = "icon",
    ...rest
  },
  ref,
) {
  // Children are typically a single icon element; flag it aria-hidden so
  // AT doesn't read the SVG on top of the aria-label.
  const decoratedChildren = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ "aria-hidden"?: boolean }>,
        { "aria-hidden": true },
      )
    : children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          aria-label={label}
          variant={variant}
          size={size}
          {...rest}
        >
          {decoratedChildren}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltipText ?? label}</TooltipContent>
    </Tooltip>
  );
});
