"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const AvatarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center -space-x-3", className)}
    {...props}
  />
));
AvatarGroup.displayName = "AvatarGroup";

const AvatarMore = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { count: number }
>(({ className, count, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground z-10",
      className
    )}
    {...props}
  >
    +{count}
  </div>
));
AvatarMore.displayName = "AvatarMore";

export { AvatarGroup, AvatarMore };
