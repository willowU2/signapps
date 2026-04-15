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

function findFamily(
  catalog: { families: FontFamily[] } | undefined,
  idOrName: string,
): FontFamily | undefined {
  if (!catalog) return undefined;
  return (
    catalog.families.find((f) => f.id === idOrName) ??
    catalog.families.find((f) => f.name === idOrName)
  );
}

export function useDynamicFont(idOrName: string | undefined) {
  const { data: catalog } = useFontsCatalog();
  useEffect(() => {
    if (!idOrName || !catalog) return;
    if (loadedFonts.has(idOrName)) return;
    const fam = findFamily(catalog, idOrName);
    if (!fam) return;
    injectFontFace(fam);
    loadedFonts.add(idOrName);
    loadedFonts.add(fam.id);
    loadedFonts.add(fam.name);
  }, [idOrName, catalog]);
}

/** Imperative variant for hover/scroll triggers (no hook). */
export function ensureFontLoaded(
  idOrName: string,
  catalog: { families: FontFamily[] } | undefined,
) {
  if (!catalog || loadedFonts.has(idOrName)) return;
  const fam = findFamily(catalog, idOrName);
  if (!fam) return;
  injectFontFace(fam);
  loadedFonts.add(idOrName);
  loadedFonts.add(fam.id);
  loadedFonts.add(fam.name);
}
