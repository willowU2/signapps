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

function injectFontFace(family: FontFamily) {
  if (typeof document === "undefined") return;
  const baseUrl = `${getServiceBaseUrl(ServiceName.DOCS)}/api/v1/fonts/files`;
  const styleEl = document.createElement("style");
  styleEl.dataset.signappsFont = family.id;
  styleEl.textContent = family.variants
    .map((v) => {
      const slug = variantSlug(v.weight, v.style);
      return `@font-face {
        font-family: "${family.name}";
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
