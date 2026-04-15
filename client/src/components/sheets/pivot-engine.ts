export type AggFn = "SUM" | "COUNT" | "AVERAGE" | "MIN" | "MAX";

export interface PivotField {
  id: string;
  name: string;
  colIndex: number;
}

export interface PivotConfig {
  rows: PivotField[];
  columns: PivotField[];
  values: { field: PivotField; agg: AggFn }[];
  filters: { field: PivotField; selected: Set<string> }[];
}

export type Zone = "rows" | "columns" | "values" | "filters" | "available";

function computeAggregate(values: number[], agg: AggFn): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "SUM":
      return values.reduce((a, b) => a + b, 0);
    case "COUNT":
      return values.length;
    case "AVERAGE":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "MIN":
      return Math.min(...values);
    case "MAX":
      return Math.max(...values);
  }
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export function buildPivot(
  rawData: string[][],
  config: PivotConfig,
): { headers: string[]; rows: string[][] } {
  if (config.rows.length === 0 || config.values.length === 0)
    return { headers: [], rows: [] };

  let filtered = rawData;
  for (const f of config.filters) {
    const ci = f.field.colIndex;
    filtered = filtered.filter((row) => f.selected.has(row[ci] ?? ""));
  }

  if (config.columns.length > 0) {
    const colField = config.columns[0];
    const allColValues = [
      ...new Set(filtered.map((r) => r[colField.colIndex] ?? "")),
    ].sort();
    const headers = [
      ...config.rows.map((r) => r.name),
      ...allColValues.flatMap((cv) =>
        config.values.map((v) => `${cv} (${v.agg} ${v.field.name})`),
      ),
    ];
    const grouped = new Map<string, Map<string, number[][]>>();
    for (const row of filtered) {
      const rowKey = config.rows.map((r) => row[r.colIndex] ?? "").join(" | ");
      const colKey = row[colField.colIndex] ?? "";
      if (!grouped.has(rowKey)) grouped.set(rowKey, new Map());
      const colMap = grouped.get(rowKey)!;
      if (!colMap.has(colKey)) colMap.set(colKey, []);
      colMap.get(colKey)!.push(
        config.values.map((v) => {
          const raw = row[v.field.colIndex];
          return raw !== undefined ? Number(raw) : NaN;
        }),
      );
    }
    const resultRows: string[][] = [];
    for (const [rowKey, colMap] of grouped) {
      const vals: string[] = [];
      for (const cv of allColValues) {
        const entries = colMap.get(cv) || [];
        for (let vi = 0; vi < config.values.length; vi++) {
          vals.push(
            fmtNum(
              computeAggregate(
                entries.map((e) => e[vi]).filter((n) => !isNaN(n)),
                config.values[vi].agg,
              ),
            ),
          );
        }
      }
      resultRows.push([...rowKey.split(" | "), ...vals]);
    }
    return { headers, rows: resultRows };
  }

  const groups = new Map<string, number[][]>();
  for (const row of filtered) {
    const rowKey = config.rows.map((r) => row[r.colIndex] ?? "").join(" | ");
    if (!groups.has(rowKey)) groups.set(rowKey, []);
    groups.get(rowKey)!.push(
      config.values.map((v) => {
        const raw = row[v.field.colIndex];
        return raw !== undefined ? Number(raw) : NaN;
      }),
    );
  }

  const headers = [
    ...config.rows.map((r) => r.name),
    ...config.values.map((v) => `${v.agg}(${v.field.name})`),
  ];
  const resultRows: string[][] = [];
  for (const [rowKey, entries] of groups) {
    resultRows.push([
      ...rowKey.split(" | "),
      ...config.values.map((v, vi) =>
        fmtNum(
          computeAggregate(
            entries.map((e) => e[vi]).filter((n) => !isNaN(n)),
            v.agg,
          ),
        ),
      ),
    ]);
  }
  return { headers, rows: resultRows };
}
