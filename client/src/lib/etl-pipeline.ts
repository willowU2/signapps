/**
 * ETL Pipeline utilities — import/export/transform data
 */

export type DataFormat = "csv" | "json" | "xlsx";

export interface ImportResult {
  success: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

/**
 * Parse CSV string to array of objects
 */
export function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

/**
 * Transform data with field mapping
 */
export function transformData(
  data: Record<string, unknown>[],
  fieldMap: Record<string, string>
): Record<string, unknown>[] {
  return data.map(row => {
    const out: Record<string, unknown> = {};
    Object.entries(fieldMap).forEach(([from, to]) => {
      if (row[from] !== undefined) out[to] = row[from];
    });
    return out;
  });
}

/**
 * Validate imported data against schema
 */
export function validateImport(
  data: Record<string, unknown>[],
  requiredFields: string[]
): ImportResult {
  let success = 0;
  const errors: Array<{ row: number; message: string }> = [];
  data.forEach((row, i) => {
    const missing = requiredFields.filter(f => !row[f] && row[f] !== 0);
    if (missing.length > 0) {
      errors.push({ row: i + 1, message: `Champs manquants: ${missing.join(", ")}` });
    } else {
      success++;
    }
  });
  return { success, errors, total: data.length };
}
