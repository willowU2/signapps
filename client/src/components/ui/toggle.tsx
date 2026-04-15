"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
  asChild?: boolean;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      pressed,
      onPressedChange,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type="button"
        aria-pressed={pressed}
        data-state={pressed ? "on" : "off"}
        onClick={() => onPressedChange?.(!pressed)}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          pressed && "bg-accent text-accent-foreground",
          {
            "h-9 px-3": size === "default",
            "h-8 px-2": size === "sm",
            "h-10 px-3": size === "lg",
          },
          variant === "outline" &&
            "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
