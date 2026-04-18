/**
 * Unit conversion system — inspired by Polotno's unit handling.
 *
 * Internal storage is always in pixels (px).
 * Display converts to user-selected unit via DPI.
 *
 * Supported units: px, pt, mm, cm, in
 */

export type Unit = "px" | "pt" | "mm" | "cm" | "in";

/** Conversion factors: 1 inch at 96 DPI = 96 px */
const PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
const CM_PER_INCH = 2.54;
const PT_PER_INCH = 72;

/**
 * Convert pixels to a target unit.
 *
 * @param px - Value in pixels
 * @param unit - Target unit
 * @param dpi - Dots per inch (default 96 for screen, 300 for print)
 */
export function pxToUnit(
  px: number,
  unit: Unit,
  dpi: number = PX_PER_INCH,
): number {
  const inches = px / dpi;
  switch (unit) {
    case "px":
      return px;
    case "pt":
      return inches * PT_PER_INCH;
    case "mm":
      return inches * MM_PER_INCH;
    case "cm":
      return inches * CM_PER_INCH;
    case "in":
      return inches;
  }
}

/**
 * Convert a value in a unit to pixels.
 *
 * @param value - Value in the source unit
 * @param unit - Source unit
 * @param dpi - Dots per inch
 */
export function unitToPx(
  value: number,
  unit: Unit,
  dpi: number = PX_PER_INCH,
): number {
  switch (unit) {
    case "px":
      return value;
    case "pt":
      return (value / PT_PER_INCH) * dpi;
    case "mm":
      return (value / MM_PER_INCH) * dpi;
    case "cm":
      return (value / CM_PER_INCH) * dpi;
    case "in":
      return value * dpi;
  }
}

/**
 * Format a pixel value with the target unit suffix.
 *
 * @param px - Value in pixels
 * @param unit - Display unit
 * @param dpi - DPI for conversion
 * @param decimals - Decimal places (default 1)
 */
export function formatWithUnit(
  px: number,
  unit: Unit,
  dpi: number = PX_PER_INCH,
  decimals: number = 1,
): string {
  const converted = pxToUnit(px, unit, dpi);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Get the unit label for display.
 */
export function unitLabel(unit: Unit): string {
  switch (unit) {
    case "px":
      return "px";
    case "pt":
      return "pt";
    case "mm":
      return "mm";
    case "cm":
      return "cm";
    case "in":
      return "in";
  }
}

/** Common page sizes in mm. */
export const PAGE_SIZES = {
  A4: { width: 210, height: 297, label: "A4" },
  A3: { width: 297, height: 420, label: "A3" },
  A5: { width: 148, height: 210, label: "A5" },
  Letter: { width: 215.9, height: 279.4, label: "Letter" },
  Legal: { width: 215.9, height: 355.6, label: "Legal" },
  Tabloid: { width: 279.4, height: 431.8, label: "Tabloid" },
} as const;

/** Social media preset sizes in px. */
export const SOCIAL_SIZES = {
  "instagram-post": {
    width: 1080,
    height: 1080,
    label: "Instagram Post",
    platform: "instagram",
  },
  "instagram-story": {
    width: 1080,
    height: 1920,
    label: "Instagram Story",
    platform: "instagram",
  },
  "facebook-post": {
    width: 1200,
    height: 630,
    label: "Facebook Post",
    platform: "facebook",
  },
  "facebook-cover": {
    width: 820,
    height: 312,
    label: "Facebook Cover",
    platform: "facebook",
  },
  "linkedin-post": {
    width: 1200,
    height: 627,
    label: "LinkedIn Post",
    platform: "linkedin",
  },
  "linkedin-banner": {
    width: 1584,
    height: 396,
    label: "LinkedIn Banner",
    platform: "linkedin",
  },
  "twitter-post": {
    width: 1200,
    height: 675,
    label: "Twitter/X Post",
    platform: "twitter",
  },
  "twitter-header": {
    width: 1500,
    height: 500,
    label: "Twitter/X Header",
    platform: "twitter",
  },
  "youtube-thumbnail": {
    width: 1280,
    height: 720,
    label: "YouTube Thumbnail",
    platform: "youtube",
  },
  "youtube-banner": {
    width: 2560,
    height: 1440,
    label: "YouTube Banner",
    platform: "youtube",
  },
  "tiktok-cover": {
    width: 1080,
    height: 1920,
    label: "TikTok Cover",
    platform: "tiktok",
  },
  "pinterest-pin": {
    width: 1000,
    height: 1500,
    label: "Pinterest Pin",
    platform: "pinterest",
  },
  "whatsapp-status": {
    width: 1080,
    height: 1920,
    label: "WhatsApp Status",
    platform: "whatsapp",
  },
} as const;

/**
 * Convert a page size from mm to pixels at a given DPI.
 */
export function pageSizeToPx(
  size: { width: number; height: number },
  dpi: number = PX_PER_INCH,
): { width: number; height: number } {
  return {
    width: Math.round(unitToPx(size.width, "mm", dpi)),
    height: Math.round(unitToPx(size.height, "mm", dpi)),
  };
}
