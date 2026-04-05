/**
 * SignApps Design System — Central Source of Truth
 *
 * This file defines ALL design constants used across the platform.
 * Every component and page MUST reference these constants instead of
 * hardcoding values. This ensures world-class consistency.
 */

// ── Typography Scale ──

export const TYPOGRAPHY = {
  /** Page title — one per page */
  pageTitle: "text-2xl font-semibold tracking-tight",
  /** Section heading */
  sectionTitle: "text-lg font-semibold",
  /** Card title */
  cardTitle: "text-sm font-medium",
  /** Body text */
  body: "text-sm",
  /** Small/caption text */
  small: "text-xs text-muted-foreground",
  /** Monospace (codes, IDs) */
  mono: "text-xs font-mono text-muted-foreground",
  /** Label for form fields */
  label: "text-sm font-medium",
} as const;

// ── Spacing Scale (multiples of 4px) ──

export const SPACING = {
  /** Page content gap between sections */
  pageSections: "space-y-6",
  /** Card internal padding */
  cardPadding: "p-4",
  /** Between cards in a grid */
  cardGap: "gap-4",
  /** Form fields gap */
  formGap: "space-y-4",
  /** Compact list items */
  listGap: "space-y-2",
  /** Table cell padding */
  cellPadding: "px-3 py-2",
  /** Between button group items */
  buttonGap: "gap-2",
  /** Between icon and text in buttons */
  iconGap: "gap-2",
} as const;

// ── Icon Sizes ──

export const ICON_SIZE = {
  /** Inline with text (buttons, badges) */
  inline: "h-4 w-4",
  /** Standalone (toolbar, actions) */
  standard: "h-5 w-5",
  /** Card headers, section icons */
  medium: "h-6 w-6",
  /** Empty states, hero sections */
  large: "h-8 w-8",
  /** Page-level empty states */
  xlarge: "h-12 w-12",
} as const;

// ── Button Sizes ──

export const BUTTON_SIZE = {
  /** Page-level primary actions (PageHeader) */
  pageAction: "sm" as const,
  /** Card-level actions */
  cardAction: "sm" as const,
  /** Table row actions */
  rowAction: "icon" as const,
  /** Form submit */
  formSubmit: "default" as const,
  /** Dialog footer */
  dialogAction: "default" as const,
} as const;

// ── Status Colors (semantic) ──

export const STATUS_COLORS = {
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
  info: "text-blue-500",
  neutral: "text-muted-foreground",
} as const;

export const STATUS_BG = {
  success: "bg-green-500/10 text-green-700 dark:text-green-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  error: "bg-red-500/10 text-red-700 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground",
} as const;

// ── Chart Colors (themed) ──

export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  series: [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ],
} as const;

// ── Entity Type Colors (for KG, org charts, etc.) ──

export const ENTITY_COLORS: Record<string, { text: string; bg: string }> = {
  person: { text: "text-blue-500", bg: "bg-blue-500/10" },
  organization: { text: "text-emerald-500", bg: "bg-emerald-500/10" },
  department: { text: "text-cyan-500", bg: "bg-cyan-500/10" },
  team: { text: "text-teal-500", bg: "bg-teal-500/10" },
  concept: { text: "text-violet-500", bg: "bg-violet-500/10" },
  technology: { text: "text-amber-500", bg: "bg-amber-500/10" },
  event: { text: "text-red-500", bg: "bg-red-500/10" },
  group: { text: "text-pink-500", bg: "bg-pink-500/10" },
  document: { text: "text-orange-500", bg: "bg-orange-500/10" },
  default: { text: "text-muted-foreground", bg: "bg-muted" },
};

// ── Grid Layouts ──

export const GRID = {
  /** Stats cards (1-4 responsive) */
  stats: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
  /** Feature cards (1-3 responsive) */
  features: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
  /** Navigation cards (2-5 responsive) */
  nav: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3",
  /** Full width single column */
  single: "max-w-4xl mx-auto",
} as const;

// ── Transition Standards ──

export const TRANSITIONS = {
  /** Default for interactive elements */
  default: "transition-colors duration-150",
  /** Layout shifts */
  layout: "transition-all duration-200 ease-out",
  /** Hover effects */
  hover: "transition-shadow duration-200",
  /** Page enter */
  pageEnter: "animate-in fade-in duration-200",
} as const;

// ── Z-Index Scale ──

export const Z_INDEX = {
  /** Base content */
  content: "z-0",
  /** Sticky headers */
  sticky: "z-10",
  /** Dropdown menus */
  dropdown: "z-20",
  /** Sidebar */
  sidebar: "z-30",
  /** Right sidebar */
  rightSidebar: "z-40",
  /** Modals */
  modal: "z-50",
  /** Toast notifications */
  toast: "z-[100]",
} as const;
