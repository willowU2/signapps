/**
 * Unified document filter API client.
 *
 * Talks to the /api/v1/filters/* endpoints on the docs service,
 * powered by the FilterRegistry pipeline.
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

export interface FormatInfo {
  name: string;
  extension: string;
  mime_type: string;
  can_import: boolean;
  can_export: boolean;
}

export const filtersApi = {
  /** List all supported import/export formats. */
  listFormats: () => client.get<FormatInfo[]>("/filters/formats"),

  /** Import a file into an IntermediateDocument (JSON). */
  importFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return client.post("/filters/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** Export an IntermediateDocument to a target format (returns blob). */
  exportDocument: (format: string, document: unknown) =>
    client.post(
      "/filters/export",
      { format, document },
      { responseType: "blob" },
    ),

  /** Convert a file from one format to another (returns blob). */
  convertFile: (file: File, targetFormat: string) => {
    const form = new FormData();
    form.append("file", file);
    return client.post(`/filters/convert?target_format=${targetFormat}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob",
    });
  },
};
