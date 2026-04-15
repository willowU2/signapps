"use client";

import Image from "next/image";
import { useState } from "react";
import { useBrandingStore } from "@/stores/branding-store";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 24, md: 32, lg: 48 };

export function AppLogo({
  size = "md",
  showText = false,
  className,
}: AppLogoProps) {
  const { logoUrl, appName } = useBrandingStore();
  const [imgError, setImgError] = useState(false);
  const px = SIZES[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {logoUrl && !imgError ? (
        <Image
          src={logoUrl}
          alt={appName}
          width={px}
          height={px}
          className="object-contain rounded"
          onError={() => setImgError(true)}
          unoptimized
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold",
            size === "sm" && "h-6 w-6 text-xs",
            size === "md" && "h-8 w-8 text-sm",
            size === "lg" && "h-12 w-12 text-2xl",
          )}
        >
          S
        </div>
      )}
      {showText && (
        <span className="font-semibold text-foreground">{appName}</span>
      )}
    </div>
  );
}
