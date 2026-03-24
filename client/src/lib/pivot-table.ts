/**
 * Pivot table engine for analytics
 */

export interface PivotConfig {
  rows: string[];
  cols: string[];
  values: string[];
  aggregation: "sum" | "count" | "avg" | "min" | "max";
}

export interface PivotResult {
  headers: string[];
  rows: Array<{ key: string; values: Record<string, number> }>;
  totals: Record<string, number>;
}

function aggregate(nums: number[], agg: PivotConfig["aggregation"]): number {
  if (nums.length === 0) return 0;
  switch (agg) {
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "count": return nums.length;
    case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
  }
}

export function computePivot(data: Record<string, unknown>[], config: PivotConfig): PivotResult {
  const grouped: Record<string, Record<string, number[]>> = {};
  const colSet = new Set<string>();

  data.forEach(row => {
    const rowKey = config.rows.map(r => String(row[r] || "")).join(" | ");
    const colKey = config.cols.map(c => String(row[c] || "")).join(" | ");
    colSet.add(colKey);

    if (!grouped[rowKey]) grouped[rowKey] = {};
    if (!grouped[rowKey][colKey]) grouped[rowKey][colKey] = [];

    config.values.forEach(v => {
      const val = Number(row[v]) || 0;
      grouped[rowKey][colKey].push(val);
    });
  });

  const headers = [...colSet].sort();
  const totals: Record<string, number> = {};
  const rows = Object.entries(grouped).map(([key, cols]) => {
    const values: Record<string, number> = {};
    headers.forEach(h => {
      values[h] = aggregate(cols[h] || [], config.aggregation);
      totals[h] = (totals[h] || 0) + values[h];
    });
    return { key, values };
  });

  return { headers, rows, totals };
}
