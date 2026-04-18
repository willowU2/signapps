/**
 * Server-side Render API client -- document, slide, thumbnail, and template rendering.
 *
 * All requests go to signapps-docs (port 3010) which hosts the render endpoints.
 *
 * Endpoints:
 *   POST /render/document  -- render Tiptap JSON to PDF or PNG
 *   POST /render/slide     -- render slide elements to SVG or PNG
 *   POST /render/thumbnail -- generate a small preview for any document
 *   POST /render/template  -- resolve template variables + render to PDF/PNG
 */

import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.DOCS);

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

export const renderApi = {
  /**
   * Render a Tiptap JSON document to PDF or PNG.
   * Returns binary data with the appropriate content type.
   */
  renderDocument: (
    content: unknown,
    format: "pdf" | "png",
    width?: number,
    height?: number,
  ) =>
    client.post<Blob>(
      "/render/document",
      { content, format, width, height },
      {
        responseType: "blob",
      },
    ),

  /**
   * Render slide elements (DrawPrimitive-compatible shapes) to SVG or PNG.
   * Returns SVG XML text or PNG binary data.
   */
  renderSlide: (
    elements: unknown[],
    width: number,
    height: number,
    format: "svg" | "png",
  ) =>
    client.post(
      "/render/slide",
      { elements, width, height, format },
      { responseType: format === "svg" ? "text" : "blob" },
    ),

  /**
   * Generate a small preview thumbnail (PNG) for any document type.
   * Default max width is 256px with proportional height.
   */
  renderThumbnail: (
    content: unknown,
    docType: "document" | "slide" | "spreadsheet",
    maxWidth?: number,
  ) =>
    client.post<Blob>(
      "/render/thumbnail",
      { content, doc_type: docType, max_width: maxWidth ?? 256 },
      { responseType: "blob" },
    ),

  /**
   * Resolve template variables in the content and render to PDF or PNG.
   * Variables are replaced using {{name}} syntax before rendering.
   */
  renderTemplate: (
    templateContent: unknown,
    variables: Record<string, string>,
    format: "pdf" | "png",
  ) =>
    client.post<Blob>(
      "/render/template",
      { template_content: templateContent, variables, format },
      { responseType: "blob" },
    ),
};
