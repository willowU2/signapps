/**
 * Sheet Formats API Client — cell format overrides and sheet metadata.
 *
 * Endpoints served by signapps-docs (port 3010).
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

export const sheetFormatsApi = {
  /** List cell formats for a sheet (default sheet index 0). */
  getFormats: (docId: string, sheet?: number) =>
    client.get(`/sheets/${docId}/formats`, { params: { sheet: sheet ?? 0 } }),

  /** Create or update a single cell format. */
  upsertFormat: (
    docId: string,
    cellRef: string,
    data: {
      style_id?: string;
      format_override?: Record<string, unknown>;
      conditional_rules?: unknown[];
    },
    sheet?: number,
  ) =>
    client.put(`/sheets/${docId}/formats/${cellRef}`, data, {
      params: { sheet: sheet ?? 0 },
    }),

  /** Delete a cell format override. */
  deleteFormat: (docId: string, cellRef: string, sheet?: number) =>
    client.delete(`/sheets/${docId}/formats/${cellRef}`, {
      params: { sheet: sheet ?? 0 },
    }),

  /** Batch upsert multiple cell formats. */
  batchUpsert: (
    docId: string,
    formats: Array<{
      cell_ref: string;
      style_id?: string;
      format_override?: Record<string, unknown>;
      conditional_rules?: unknown[];
    }>,
    sheet?: number,
  ) =>
    client.post(
      `/sheets/${docId}/formats/batch`,
      { formats },
      { params: { sheet: sheet ?? 0 } },
    ),

  /** Get sheet metadata (frozen panes, column widths, etc.). */
  getMetadata: (docId: string, sheet?: number) =>
    client.get(`/sheets/${docId}/metadata`, { params: { sheet: sheet ?? 0 } }),

  /** Create or update sheet metadata. */
  upsertMetadata: (
    docId: string,
    data: {
      sheet_name?: string;
      frozen_rows?: number;
      frozen_cols?: number;
      col_widths?: Record<string, number>;
      row_heights?: Record<string, number>;
      sort_config?: unknown[];
      filter_config?: unknown[];
    },
    sheet?: number,
  ) =>
    client.put(`/sheets/${docId}/metadata`, data, {
      params: { sheet: sheet ?? 0 },
    }),
};
