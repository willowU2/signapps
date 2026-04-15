"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, stringToColor } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * Standard user avatar: h-8 w-8 by default, initials fallback using getInitials().
 * Use everywhere a user avatar is needed for COH-019 consistency.
 */
export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: UserAvatarProps) {
  const initials = getInitials(name || "?");
  const bgColor = stringToColor(name || "?");

  return (
    <Avatar size={size} className={cn(className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className="text-white text-xs font-medium"
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
