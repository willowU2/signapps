/**
 * Compat shim - the real DetailPanel container lives under
 * `detail-panel/index.tsx` since SO6. This file stays to preserve
 * imports from outside the org-structure folder.
 */
export { DetailPanel } from "./detail-panel/index";
export type { DetailPanelProps } from "./detail-panel/index";
