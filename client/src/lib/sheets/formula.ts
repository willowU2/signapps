import {
  executeFunctionOp,
  initializeFunctionsRegistry,
  getRegisteredFunctionNames,
} from "./functions";

// Advanced formula evaluation engine for Spreadsheets
// Supports math, cell references, ranges, and 30+ standard functions

export type CellValueGetter = (r: number, c: number, sheet?: string) => string;

export const SHEET_ERRORS = {
  REF: "#REF!",
  NAME: "#NAME?",
  DIV_ZERO: "#DIV/0!",
  VALUE: "#VALUE!",
  ERROR: "#ERROR!",
  CYCLE: "#CYCLE!",
  NA: "#N/A",
};

initializeFunctionsRegistry();

const isError = (v: string) => Object.values(SHEET_ERRORS).includes(v);

interface CellRef {
  row: number;
  col: number;
}

export function evaluateFormula(
  formula: string,
  getData: CellValueGetter,
  currentCell?: { r: number; c: number; sheet?: string },
  visited: Set<string> = new Set(),
): string {
  if (!formula) return "";
  if (!formula.toString().startsWith("=")) {
    const num = Number(formula);
    return isNaN(num) ? formula : num.toString();
  }

  const cellId = currentCell
    ? `${currentCell.sheet || ""}!${currentCell.r},${currentCell.c}`
    : "unknown";
  if (visited.has(cellId)) return SHEET_ERRORS.CYCLE;

  const newVisited = new Set(visited);
  if (currentCell) newVisited.add(cellId);

  try {
    let expression = formula.substring(1).trim();
    // Keep original case for string functions, but uppercase function names
    const upperExpr = expression.toUpperCase();

    // Process functions (handles nesting via recursive calls)
    const result = processExpression(
      upperExpr,
      expression,
      getData,
      currentCell,
      newVisited,
    );
    if (isError(result)) return result;

    return result;
  } catch {
    return SHEET_ERRORS.ERROR;
  }
}

export function colToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + colStr.charCodeAt(i) - 64;
  }
  return index - 1;
}

export function indexToCol(index: number): string {
  let temp,
    letter = "";
  while (index >= 0) {
    temp = index % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    index = (index - temp - 1) / 26;
  }
  return letter;
}

function parseCellRef(ref: string): CellRef | null {
  const clean = ref.replace(/\$/g, "");
  const match = clean.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  return { col: colToIndex(match[1]), row: parseInt(match[2]) - 1 };
}

/** Parse a column-only reference like "A" or a full cell ref like "A1".
 *  Returns { col, row } where row is undefined for whole-column refs. */
function parseColOrCellRef(ref: string): { col: number; row?: number } | null {
  const clean = ref.replace(/\$/g, "");
  // Full cell ref: A1, AB123
  const full = clean.match(/^([A-Z]+)([0-9]+)$/);
  if (full) return { col: colToIndex(full[1]), row: parseInt(full[2]) - 1 };
  // Column-only ref: A, AB
  const colOnly = clean.match(/^([A-Z]+)$/);
  if (colOnly) return { col: colToIndex(colOnly[1]) };
  return null;
}

function extractSheetPrefix(ref: string): { sheet?: string; rest: string } {
  const m = ref.match(/^(?:'([^']+)'|([A-Z][A-Z0-9_]*))!(.+)$/i);
  if (m) return { sheet: m[1] || m[2], rest: m[3] };
  return { rest: ref };
}

function resolveRange(
  rangeStr: string,
  getData: CellValueGetter,
  currentCell: { r: number; c: number; sheet?: string } | undefined,
  visited: Set<string>,
): number[] {
  const { sheet, rest } = extractSheetPrefix(rangeStr);
  const targetSheet = sheet || currentCell?.sheet;
  const parts = rest.replace(/\$/g, "").split(":");
  if (parts.length !== 2) return [];
  // Try full cell refs first, fall back to column-only refs for whole-column ranges
  const start = parseCellRef(parts[0]) || parseColOrCellRef(parts[0]);
  const end = parseCellRef(parts[1]) || parseColOrCellRef(parts[1]);
  if (!start || !end) return [];

  const minRow = Math.min(start.row ?? 0, end.row ?? 9999);
  const maxRow = Math.max(start.row ?? 0, end.row ?? 9999);
  const minCol = Math.min(start.col, end.col),
    maxCol = Math.max(start.col, end.col);
  const values: number[] = [];
  let emptyStreak = 0;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const rawVal = getData(r, c, targetSheet);
      if (rawVal) {
        emptyStreak = 0;
        const evaluated = rawVal.startsWith("=")
          ? evaluateFormula(
              rawVal,
              getData,
              { r, c, sheet: targetSheet },
              visited,
            )
          : rawVal;
        const num = Number(evaluated);
        if (!isNaN(num)) values.push(num);
      }
    }
    // Optimization for whole-column ranges: stop after 50 consecutive empty rows
    if (!getData(r, minCol, targetSheet)) emptyStreak++;
    else emptyStreak = 0;
    if (emptyStreak > 50 && (start.row === undefined || end.row === undefined))
      break;
  }
  return values;
}

function resolveRangeStrings(
  rangeStr: string,
  getData: CellValueGetter,
  currentCell: { r: number; c: number; sheet?: string } | undefined,
  visited: Set<string>,
): string[] {
  const { sheet, rest } = extractSheetPrefix(rangeStr);
  const targetSheet = sheet || currentCell?.sheet;
  const parts = rest.replace(/\$/g, "").split(":");
  if (parts.length !== 2) return [];
  // Try full cell refs first, fall back to column-only refs for whole-column ranges
  const start = parseCellRef(parts[0]) || parseColOrCellRef(parts[0]);
  const end = parseCellRef(parts[1]) || parseColOrCellRef(parts[1]);
  if (!start || !end) return [];

  const minRow = Math.min(start.row ?? 0, end.row ?? 9999);
  const maxRow = Math.max(start.row ?? 0, end.row ?? 9999);
  const minCol = Math.min(start.col, end.col),
    maxCol = Math.max(start.col, end.col);
  const values: string[] = [];
  let emptyStreak = 0;

  for (let r = minRow; r <= maxRow; r++) {
    let rowHasData = false;
    for (let c = minCol; c <= maxCol; c++) {
      const rawVal = getData(r, c, targetSheet) || "";
      if (rawVal) rowHasData = true;
      const evaluated = rawVal.startsWith("=")
        ? evaluateFormula(
            rawVal,
            getData,
            { r, c, sheet: targetSheet },
            visited,
          )
        : rawVal;
      values.push(evaluated);
    }
    // Optimization for whole-column ranges: stop after 50 consecutive empty rows
    emptyStreak = rowHasData ? 0 : emptyStreak + 1;
    if (emptyStreak > 50 && (start.row === undefined || end.row === undefined))
      break;
  }
  return values;
}

function getCellValue(
  ref: string,
  getData: CellValueGetter,
  currentCell: { r: number; c: number; sheet?: string } | undefined,
  visited: Set<string>,
): string {
  const { sheet, rest } = extractSheetPrefix(ref);
  const parsed = parseCellRef(rest);
  if (!parsed) return ref;
  const targetSheet = sheet || currentCell?.sheet;
  const rawVal = getData(parsed.row, parsed.col, targetSheet) || "";
  return rawVal.startsWith("=")
    ? evaluateFormula(
        rawVal,
        getData,
        { r: parsed.row, c: parsed.col, sheet: targetSheet },
        visited,
      )
    : rawVal;
}

function getCellNumericValue(
  ref: string,
  getData: CellValueGetter,
  currentCell: { r: number; c: number; sheet?: string } | undefined,
  visited: Set<string>,
): number {
  const val = getCellValue(ref, getData, currentCell, visited);
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

// Parse function arguments respecting nested parentheses and quoted strings
function splitFunctionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0,
    current = "",
    inString = false,
    stringChar = "";

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth--;
      current += ch;
      continue;
    }
    if ((ch === "," || ch === ";") && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() || args.length > 0) args.push(current.trim());
  return args;
}

// Find matching closing paren
function findClosingParen(expr: string, start: number): number {
  let depth = 1;
  for (let i = start; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    if (expr[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function processExpression(
  upperExpr: string,
  originalExpr: string,
  getData: CellValueGetter,
  currentCell: { r: number; c: number; sheet?: string } | undefined,
  visited: Set<string>,
): string {
  // Match function calls from innermost out dynamically based on the registry
  const registeredNames = getRegisteredFunctionNames().join("|");
  const fnRegex = new RegExp(`\\b(${registeredNames})\\(`, "i");

  let expr = upperExpr;

  // Iteratively process innermost functions first
  let maxIter = 50;
  while (maxIter-- > 0) {
    const match = expr.match(fnRegex);
    if (!match || match.index === undefined) break;

    const fnName = match[1];
    const argsStart = match.index + fnName.length + 1;
    const argsEnd = findClosingParen(expr, argsStart);
    if (argsEnd === -1) return SHEET_ERRORS.ERROR;

    const argsStr = expr.substring(argsStart, argsEnd);
    const args = splitFunctionArgs(argsStr);

    // Evaluate each arg that contains cell refs
    const evalArg = (a: string): string => {
      a = a.trim();
      if (
        (a.startsWith('"') && a.endsWith('"')) ||
        (a.startsWith("'") && a.endsWith("'"))
      ) {
        return a.slice(1, -1).replace(/""/g, '"');
      }
      // Only try to parse as a cell if it looks like one or a range
      if (a.includes(":")) return a;

      // If it's just a number, avoid hitting extractSheetPrefix which regex matches some numbers
      if (!isNaN(Number(a))) return a;

      const { rest } = extractSheetPrefix(a);
      const cellRef = parseCellRef(rest);
      if (cellRef) return getCellValue(a, getData, currentCell, visited);
      return a;
    };

    const evalArgNum = (a: string): number => {
      const v = evalArg(a);
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    let result: string;
    try {
      const rawResult = executeFunctionOp(fnName, {
        args,
        evalArg,
        evalArgNum,
        getData,
        visited,
        currentCell,
        resolveRange: (r: string) =>
          resolveRange(r, getData, currentCell, visited),
        resolveRangeStrings: (r: string) =>
          resolveRangeStrings(r, getData, currentCell, visited),
      });
      if (
        Object.values(SHEET_ERRORS).includes(rawResult) ||
        !isNaN(Number(rawResult)) ||
        rawResult.startsWith("__SPARKLINE__") ||
        rawResult === ""
      ) {
        result = rawResult;
      } else {
        result = `"${rawResult.replace(/"/g, '""')}"`;
      }
    } catch {
      result = SHEET_ERRORS.ERROR;
    }

    expr =
      expr.substring(0, match.index) + result + expr.substring(argsEnd + 1);
  }

  // Process remaining cell references (handles $A$1, Sheet!Ref, 'My Sheet'!Ref)
  expr = expr.replace(
    /(?:(?:'([^']+)'|[A-Za-z_][A-Za-z0-9_ ]*)!)?\$?([A-Z]+)\$?(\d+)/g,
    (fullMatch) => {
      const { sheet, rest } = extractSheetPrefix(fullMatch);
      const ref = parseCellRef(rest);
      if (!ref) return fullMatch;
      const targetSheet = sheet || currentCell?.sheet;
      const rawVal = getData(ref.row, ref.col, targetSheet) || "";
      const val = rawVal.startsWith("=")
        ? evaluateFormula(
            rawVal,
            getData,
            { r: ref.row, c: ref.col, sheet: targetSheet },
            visited,
          )
        : rawVal;
      if (isError(val)) return val;
      // Strip quotes around strings for math but keep numbers raw
      if (val.startsWith('"') && val.endsWith('"')) {
        const inner = val.slice(1, -1);
        if (!isNaN(Number(inner))) return inner;
      }
      const num = Number(val);
      return isNaN(num) ? "0" : num.toString();
    },
  );

  if (isError(expr)) return expr;

  // Check if it's just a fully quoted string before evaluating math
  if (expr.startsWith('"') && expr.endsWith('"')) {
    const inner = expr.slice(1, -1);
    if (!inner.includes('"') || inner.replace(/""/g, "").indexOf('"') === -1) {
      return inner.replace(/""/g, '"');
    }
  }

  // Evaluate remaining math
  return evaluateMath(expr);
}

function evaluateMath(expr: string): string {
  // Protect standard ISO date formats from being evaluated as subtraction
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/.test(expr)) {
    return expr;
  }

  if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
    // Could be a string result from a function
    if (expr.match(/^[A-Z]/i)) return expr;
    return SHEET_ERRORS.VALUE;
  }

  // Security: strip whitespace and apply strict guards before parsing.
  // The previous implementation used `Function()` which forced
  // `script-src 'unsafe-eval'` in the CSP. The pure recursive-descent
  // parser below has identical semantics on the allowed character
  // class `[0-9+\-*/().\s]`, so the CSP no longer needs that directive.
  const sanitized = expr.replace(/\s/g, "");
  if (sanitized.length === 0) return "";
  // Reject if too long (prevents resource exhaustion)
  if (sanitized.length > 200) return SHEET_ERRORS.VALUE;
  // Reject any identifier characters — no access to variables or prototypes
  if (/[a-zA-Z_$]/.test(sanitized)) return SHEET_ERRORS.VALUE;

  try {
    if (/\/0(?!\.)/.test(sanitized)) return SHEET_ERRORS.DIV_ZERO;
    const parser = new MathParser(sanitized);
    const result = parser.parse();
    if (typeof result !== "number" || isNaN(result) || !isFinite(result))
      return SHEET_ERRORS.VALUE;
    return Math.round(result * 10000000000) / 10000000000 + "";
  } catch {
    return SHEET_ERRORS.ERROR;
  }
}

/**
 * Recursive-descent parser for the sanitized math subset used by
 * `evaluateMath`. Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := '-' factor | '(' expr ')' | number
 *
 * Pure TypeScript, no dynamic code execution — lets the CSP drop
 * `'unsafe-eval'`. An identical copy lives in
 * `client/src/workers/formula.worker.ts` for off-main-thread recalc.
 */
class MathParser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.pos !== this.input.length)
      throw new Error("unexpected trailing input");
    return value;
  }

  private parseExpr(): number {
    let left = this.parseTerm();
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op !== "+" && op !== "-") break;
      this.pos++;
      const right = this.parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op !== "*" && op !== "/") break;
      this.pos++;
      const right = this.parseFactor();
      if (op === "*") left = left * right;
      else {
        if (right === 0) throw new Error("division by zero");
        left = left / right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    const ch = this.input[this.pos];
    if (ch === "+") {
      this.pos++;
      return this.parseFactor();
    }
    if (ch === "-") {
      this.pos++;
      return -this.parseFactor();
    }
    if (ch === "(") {
      this.pos++;
      const value = this.parseExpr();
      if (this.input[this.pos] !== ")") throw new Error("expected ')'");
      this.pos++;
      return value;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.pos;
    let hasDigit = false;
    while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
      this.pos++;
      hasDigit = true;
    }
    if (this.pos < this.input.length && this.input[this.pos] === ".") {
      this.pos++;
      while (
        this.pos < this.input.length &&
        /[0-9]/.test(this.input[this.pos])
      ) {
        this.pos++;
        hasDigit = true;
      }
    }
    if (!hasDigit) throw new Error("expected number");
    return parseFloat(this.input.slice(start, this.pos));
  }
}

/**
 * Shift the relative cell references inside a formula by (dr, dc).
 *
 * Respects absolute references marked with `$`:
 *   `$A$1` stays fixed, `A$1` shifts only the column, `$A1` shifts only
 *   the row, and `A1` shifts both. Range endpoints (`A1:C5`) are each
 *   adjusted individually. Sheet-prefixed refs (`Sheet1!A1`,
 *   `'My Sheet'!A1`) are preserved and their cell part is shifted.
 *
 * String literals enclosed in double-quotes are left untouched so
 * formulas like `=IF(A1>5, "A1 big", "A1 small")` only shift the real
 * `A1` reference, not the ones inside the quoted strings.
 *
 * If any adjusted reference would leave the grid (row < 0 or col < 0),
 * returns `#REF!` — matches Excel/Sheets behavior.
 *
 * Examples:
 *   adjustFormulaReferences("=A1*2", 1, 0)         → "=A2*2"
 *   adjustFormulaReferences("=A$1*2", 5, 0)        → "=A$1*2"
 *   adjustFormulaReferences("=$A1*2", 0, 3)        → "=$A1*2"
 *   adjustFormulaReferences("=$A$1*2", 5, 5)       → "=$A$1*2"
 *   adjustFormulaReferences("=SUM(A1:A3)", 1, 0)   → "=SUM(A2:A4)"
 *   adjustFormulaReferences("=A1+B1", 2, 1)        → "=B3+C3"
 *   adjustFormulaReferences("=A1", -1, 0)          → "#REF!"
 *   adjustFormulaReferences("=Sheet1!A1", 1, 0)    → "=Sheet1!A2"
 */
export function adjustFormulaReferences(
  formula: string,
  dr: number,
  dc: number,
): string {
  if (!formula || !formula.startsWith("=")) return formula;
  if (dr === 0 && dc === 0) return formula;

  // Mask string literals so refs inside them aren't rewritten.
  // We also mask the leading "=" to keep the regex simple.
  const strings: string[] = [];
  const masked = formula.substring(1).replace(/"[^"]*"/g, (s) => {
    strings.push(s);
    return `\u0001${strings.length - 1}\u0001`;
  });

  let hasRefError = false;

  // Match cell references with optional absolute markers.
  // Pattern: ($?)([A-Z]+)($?)(\d+)
  //   group 1: "$" or "" on column
  //   group 2: column letters (A, B, ..., AA, AB, ...)
  //   group 3: "$" or "" on row
  //   group 4: row number (1-based)
  //
  // Negative lookbehind (?<![A-Z0-9_]) ensures we don't match inside a
  // longer identifier. Negative lookahead (?![!\w]) skips matches that
  // are actually part of a sheet-qualified reference like "SHEET1!A1"
  // (we want to preserve the sheet name and only shift the A1 part)
  // or function/identifier names that happen to end in digits.
  const adjusted = masked.replace(
    /(?<![A-Z0-9_])(\$?)([A-Z]+)(\$?)(\d+)(?![!\w])/g,
    (
      match,
      colAbs: string,
      colLetter: string,
      rowAbs: string,
      rowNum: string,
    ) => {
      const colFixed = colAbs === "$";
      const rowFixed = rowAbs === "$";
      const currentCol = colToIndex(colLetter);
      const currentRow = parseInt(rowNum, 10) - 1;

      const newCol = colFixed ? currentCol : currentCol + dc;
      const newRow = rowFixed ? currentRow : currentRow + dr;

      if (newCol < 0 || newRow < 0) {
        hasRefError = true;
        return match;
      }

      return `${colAbs}${indexToCol(newCol)}${rowAbs}${newRow + 1}`;
    },
  );

  if (hasRefError) return SHEET_ERRORS.REF;

  // Restore string literals.
  const restored = adjusted.replace(
    /\u0001(\d+)\u0001/g,
    (_, idx: string) => strings[parseInt(idx, 10)],
  );

  return "=" + restored;
}
