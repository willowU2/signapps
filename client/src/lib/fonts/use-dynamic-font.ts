"use client";

import { useEffect } from "react";
import { getServiceBaseUrl, ServiceName } from "@/lib/api/factory";
import type { FontFamily } from "./types";
import { useFontsCatalog } from "./use-fonts-catalog";

const loadedFonts = new Set<string>();

function variantSlug(weight: number, style: string): string {
  const w = weight === 400 ? "regular" : weight === 700 ? "bold" : `w${weight}`;
  return style === "italic" ? `${w}-italic` : w;
}

// Escape characters that could break out of a CSS string literal.
// family.name is server-controlled today but defense-in-depth is cheap.
function cssStringEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function injectFontFace(family: FontFamily) {
  if (typeof document === "undefined") return;
  const baseUrl = `${getServiceBaseUrl(ServiceName.DOCS)}/api/v1/fonts/files`;
  const safeName = cssStringEscape(family.name);
  const styleEl = document.createElement("style");
  styleEl.dataset.signappsFont = family.id;
  styleEl.textContent = family.variants
    .map((v) => {
      const slug = variantSlug(v.weight, v.style);
      return `@font-face {
        font-family: "${safeName}";
        font-weight: ${v.weight};
        font-style: ${v.style};
        font-display: swap;
        src: url("${baseUrl}/${family.id}/${slug}.woff2") format("woff2");
      }`;
    })
    .join("\n");
  document.head.appendChild(styleEl);
}

export function useDynamicFont(familyId: string | undefined) {
  const { data: catalog } = useFontsCatalog();
  useEffect(() => {
    if (!familyId || !catalog) return;
    if (loadedFonts.has(familyId)) return;
    const fam = catalog.families.find((f) => f.id === familyId);
    if (!fam) return;
    injectFontFace(fam);
    loadedFonts.add(familyId);
  }, [familyId, catalog]);
}

/** Imperative variant for hover/scroll triggers (no hook). */
export function ensureFontLoaded(
  familyId: string,
  catalog: { families: FontFamily[] } | undefined,
) {
  if (!catalog || loadedFonts.has(familyId)) return;
  const fam = catalog.families.find((f) => f.id === familyId);
  if (!fam) return;
  injectFontFace(fam);
  loadedFonts.add(familyId);
}
