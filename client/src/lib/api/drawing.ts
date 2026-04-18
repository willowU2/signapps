/**
 * Drawing API client -- stateless rendering and chart generation.
 *
 * All requests go to signapps-docs (port 3010) which hosts the drawing endpoints.
 *
 * Endpoints:
 *   POST /drawing/render/svg  -- render primitives to SVG
 *   POST /drawing/render/png  -- render primitives to PNG
 *   POST /drawing/charts      -- generate chart primitives from a definition
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** A single data series for chart generation. */
export interface ChartSeries {
  /** Human-readable label for the series. */
  label: string;
  /** Numeric values (one per category/data point). */
  values: number[];
  /** CSS hex color string (e.g. "#3b82f6"). */
  color: string;
}

/** Chart definition sent to the charts endpoint. */
export interface ChartDefinition {
  /** Type of chart: bar, line, pie, donut, area, scatter. */
  chart_type: string;
  /** Optional chart title displayed at the top. */
  title?: string;
  /** Category labels for the x-axis or segment labels. */
  categories: string[];
  /** Data series to plot. */
  series: ChartSeries[];
  /** Total chart width in pixels. */
  width: number;
  /** Total chart height in pixels. */
  height: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

export const drawingApi = {
  /** Render drawing primitives to SVG XML. */
  renderSvg: (primitives: unknown[], width: number, height: number) =>
    client.post<string>(
      "/drawing/render/svg",
      { primitives, width, height },
      { responseType: "text" },
    ),

  /** Render drawing primitives to PNG image bytes. */
  renderPng: (primitives: unknown[], width: number, height: number) =>
    client.post<Blob>(
      "/drawing/render/png",
      { primitives, width, height },
      { responseType: "blob" },
    ),

  /** Generate chart primitives from a chart definition. */
  generateChart: (chartDef: ChartDefinition) =>
    client.post<unknown[]>("/drawing/charts", chartDef),
};
