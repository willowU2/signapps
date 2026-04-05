/**
 * Standard page layout patterns.
 *
 * Every admin page should follow one of these patterns for consistency.
 */

/** Standard page container class */
export const PAGE_CONTAINER = "space-y-6";

/** Standard page with header + content */
export const PAGE_WITH_HEADER = {
  container: "space-y-6",
  header: "flex items-center justify-between",
  content: "space-y-6",
} as const;

/** Standard CRUD page layout */
export const CRUD_PAGE = {
  container: "space-y-6",
  toolbar: "flex items-center justify-between gap-4",
  searchBar: "flex items-center gap-2",
  table: "rounded-md border",
  emptyState: "text-center py-12",
} as const;

/** Standard settings page layout */
export const SETTINGS_PAGE = {
  container: "space-y-6 max-w-4xl",
  section: "space-y-4",
  sectionTitle: "text-lg font-semibold",
  sectionDescription: "text-sm text-muted-foreground",
} as const;

/** Standard dashboard layout */
export const DASHBOARD_PAGE = {
  container: "space-y-6",
  statsGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
  contentGrid: "grid grid-cols-1 lg:grid-cols-2 gap-6",
} as const;
