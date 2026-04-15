/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * Tenant Branding
 *
 * Components for applying tenant branding (colors, logos, fonts).
 */

import * as React from "react";
import { useTenantBranding } from "./context";
import type { TenantBranding, TenantColors } from "./types";

// ============================================================================
// Sanitization Utilities
// ============================================================================

/**
 * Sanitize CSS to prevent injection attacks.
 * Removes @import, expression(), and dangerous url() schemes.
 */
function sanitizeCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;/gi, "/* blocked @import */")
    .replace(/expression\s*\(/gi, "/* blocked expression */(")
    .replace(/url\s*\(\s*['"]?\s*(?:javascript|data):/gi, "url(blocked:");
}

/**
 * Sanitize font-family values to only allow safe characters.
 */
function sanitizeFontFamily(font: string): string {
  return font.replace(/[^a-zA-Z0-9\s,\-'"]/g, "");
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Convert hex color to HSL values
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Generate CSS variables from tenant colors
 */
function generateColorVariables(colors: TenantColors): string {
  const variables: string[] = [];

  // Primary color
  if (colors.primary) {
    const hsl = hexToHsl(colors.primary);
    if (hsl) {
      variables.push(`--primary: ${hsl.h} ${hsl.s}% ${hsl.l}%;`);
      // Generate foreground color (white or black based on lightness)
      const foregroundL = hsl.l > 50 ? 10 : 98;
      variables.push(
        `--primary-foreground: ${hsl.h} ${Math.max(0, hsl.s - 20)}% ${foregroundL}%;`,
      );
    }
  }

  // Secondary color
  if (colors.secondary) {
    const hsl = hexToHsl(colors.secondary);
    if (hsl) {
      variables.push(`--secondary: ${hsl.h} ${hsl.s}% ${hsl.l}%;`);
      const foregroundL = hsl.l > 50 ? 10 : 98;
      variables.push(
        `--secondary-foreground: ${hsl.h} ${Math.max(0, hsl.s - 20)}% ${foregroundL}%;`,
      );
    }
  }

  // Background
  if (colors.background) {
    const hsl = hexToHsl(colors.background);
    if (hsl) {
      variables.push(`--background: ${hsl.h} ${hsl.s}% ${hsl.l}%;`);
    }
  }

  // Sidebar background
  if (colors.sidebarBackground) {
    const hsl = hexToHsl(colors.sidebarBackground);
    if (hsl) {
      variables.push(`--sidebar-background: ${hsl.h} ${hsl.s}% ${hsl.l}%;`);
    }
  }

  // Header background
  if (colors.headerBackground) {
    const hsl = hexToHsl(colors.headerBackground);
    if (hsl) {
      variables.push(`--header-background: ${hsl.h} ${hsl.s}% ${hsl.l}%;`);
    }
  }

  return variables.join("\n  ");
}

// ============================================================================
// CSS Injector Component
// ============================================================================

interface BrandingStylesProps {
  branding?: TenantBranding;
}

export function BrandingStyles({
  branding: propBranding,
}: BrandingStylesProps) {
  const contextBranding = useTenantBranding();
  const branding = propBranding || contextBranding;

  const cssContent = React.useMemo(() => {
    const parts: string[] = [];

    // Light mode variables
    const lightVariables = generateColorVariables(branding.colors);
    if (lightVariables) {
      parts.push(`:root {\n  ${lightVariables}\n}`);
    }

    // Dark mode variables
    if (branding.colors.primaryDark) {
      const darkColors: TenantColors = {
        primary: branding.colors.primaryDark,
        secondary: branding.colors.secondary,
      };
      const darkVariables = generateColorVariables(darkColors);
      if (darkVariables) {
        parts.push(`.dark {\n  ${darkVariables}\n}`);
      }
    }

    // Typography
    if (branding.typography) {
      const fontVars: string[] = [];
      if (branding.typography.fontFamily) {
        fontVars.push(
          `--font-sans: ${sanitizeFontFamily(branding.typography.fontFamily)};`,
        );
      }
      if (branding.typography.headingFontFamily) {
        fontVars.push(
          `--font-heading: ${sanitizeFontFamily(branding.typography.headingFontFamily)};`,
        );
      }
      if (branding.typography.baseFontSize) {
        fontVars.push(`font-size: ${branding.typography.baseFontSize}px;`);
      }
      if (fontVars.length > 0) {
        parts.push(`:root {\n  ${fontVars.join("\n  ")}\n}`);
      }
    }

    // Custom CSS (sanitized)
    if (branding.customCss) {
      parts.push(sanitizeCss(branding.customCss));
    }

    return parts.join("\n\n").replace(/<\/style/gi, "<\\/style");
  }, [branding]);

  if (!cssContent) return null;

  return (
    <style
      id="tenant-branding"
      dangerouslySetInnerHTML={{ __html: cssContent }}
    />
  );
}

// ============================================================================
// Logo Component
// ============================================================================

interface TenantLogoProps {
  variant?: "primary" | "secondary";
  className?: string;
  width?: number;
  height?: number;
}

export function TenantLogo({
  variant = "primary",
  className,
  width = 120,
  height = 40,
}: TenantLogoProps) {
  const branding = useTenantBranding();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    // Watch for changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Determine which logo to use
  let logoUrl: string;
  if (variant === "primary") {
    logoUrl =
      isDark && branding.logo.primaryDark
        ? branding.logo.primaryDark
        : branding.logo.primary;
  } else {
    logoUrl =
      isDark && branding.logo.secondaryDark
        ? branding.logo.secondaryDark
        : branding.logo.secondary || branding.logo.primary;
  }

  return (
    <img
      src={logoUrl}
      alt={branding.name}
      width={width}
      height={height}
      className={className}
    />
  );
}

// ============================================================================
// Favicon Component
// ============================================================================

export function TenantFavicon() {
  const branding = useTenantBranding();

  React.useEffect(() => {
    if (branding.logo.favicon) {
      // Update favicon
      const link =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
        document.createElement("link");
      link.rel = "icon";
      link.href = branding.logo.favicon;
      if (!link.parentNode) {
        document.head.appendChild(link);
      }
    }
  }, [branding.logo.favicon]);

  return null;
}

// ============================================================================
// Document Title Component
// ============================================================================

interface TenantTitleProps {
  suffix?: string;
}

export function TenantTitle({ suffix }: TenantTitleProps) {
  const branding = useTenantBranding();

  React.useEffect(() => {
    document.title = suffix ? `${suffix} | ${branding.name}` : branding.name;
  }, [branding.name, suffix]);

  return null;
}

// ============================================================================
// Combined Branding Provider
// ============================================================================

interface BrandingProviderProps {
  children: React.ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  return (
    <>
      <BrandingStyles />
      <TenantFavicon />
      {children}
    </>
  );
}
