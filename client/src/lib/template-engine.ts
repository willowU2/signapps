/**
 * Template engine for emails, documents, invoices
 */

export interface Template {
  id: string;
  name: string;
  category: "email" | "document" | "invoice" | "form" | "workflow";
  content: string;
  variables: string[];
  createdAt: string;
}

/**
 * Render a template by replacing {{variables}}
 */
export function renderTemplate(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
}

/**
 * Extract variable names from a template
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

/**
 * Validate all variables in template have values
 */
export function validateTemplate(
  template: string,
  data: Record<string, string>,
): string[] {
  const vars = extractVariables(template);
  return vars.filter((v) => !data[v]);
}
