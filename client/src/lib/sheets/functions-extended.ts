/**
 * Extended formula function library for SignApps Spreadsheets.
 *
 * Adds 50+ new functions: lookup & reference, conditional aggregation,
 * math, text, date, statistical, logical, and information functions.
 *
 * Functions that already exist in the base registry (math.ts, logic.ts,
 * text.ts, date.ts) are NOT re-registered here to avoid conflicts.
 * Instead, this module provides real implementations for stubs (INDEX,
 * MATCH) and brand-new functions.
 */

import { SHEET_ERRORS, colToIndex, evaluateFormula } from "./formula";
import {
  registerFunction,
  type FunctionContext,
  type SheetFunction,
} from "./functions/registry";
import { matchesCriteria } from "./functions/math";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten args that may contain ranges into a single string[] of evaluated values. */
function flattenArgsStrings(ctx: FunctionContext): string[] {
  const { args, evalArg, resolveRangeStrings } = ctx;
  const out: string[] = [];
  for (const a of args) {
    if (a.includes(":")) out.push(...resolveRangeStrings(a));
    else out.push(evalArg(a));
  }
  return out;
}

/** Flatten args into numbers (skip non-numeric). */
function flattenArgsNums(ctx: FunctionContext): number[] {
  const { args, evalArgNum, resolveRange } = ctx;
  const nums: number[] = [];
  for (const a of args) {
    if (a.includes(":")) nums.push(...resolveRange(a));
    else nums.push(evalArgNum(a));
  }
  return nums;
}

/** Parse a date from a string or Excel serial number. */
function parseDate(val: string | number): Date {
  if (typeof val === "number") {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + val);
    return d;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + "T00:00:00");
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
}

function formatDate(d: Date): string {
  if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a cell reference like "A1" into { col, row }. */
function parseCellRef(ref: string): { col: number; row: number } | null {
  const clean = ref.replace(/\$/g, "");
  const match = clean.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  return { col: colToIndex(match[1]), row: parseInt(match[2]) - 1 };
}

/** Parse a column-only or full cell reference. */
function parseColOrCellRef(ref: string): { col: number; row?: number } | null {
  const clean = ref.replace(/\$/g, "");
  const full = clean.match(/^([A-Z]+)([0-9]+)$/);
  if (full) return { col: colToIndex(full[1]), row: parseInt(full[2]) - 1 };
  const colOnly = clean.match(/^([A-Z]+)$/);
  if (colOnly) return { col: colToIndex(colOnly[1]) };
  return null;
}

/** Extract optional sheet prefix from a reference. */
function extractSheetPrefix(ref: string): { sheet?: string; rest: string } {
  const m = ref.match(/^(?:'([^']+)'|([A-Z][A-Z0-9_]*))!(.+)$/i);
  if (m) return { sheet: m[1] || m[2], rest: m[3] };
  return { rest: ref };
}

/** GCD of two non-negative integers. */
function gcd2(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/** LCM of two non-negative integers. */
function lcm2(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  if (a === 0 || b === 0) return 0;
  return (a / gcd2(a, b)) * b;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerExtendedFunctions(): void {
  // =========================================================================
  // LOOKUP & REFERENCE
  // =========================================================================

  // HLOOKUP(lookup_value, table_array, row_index, [range_lookup])
  const hlookupFn: SheetFunction = ({
    args,
    evalArg,
    getData,
    visited,
    currentCell,
  }) => {
    if (args.length < 3) return SHEET_ERRORS.NA;

    const searchKey = evalArg(args[0]);
    const rangeStr = args[1].trim();
    const rowIndex = Number(evalArg(args[2]));
    const isTrueStr = (s: string) => {
      const up = s.toUpperCase();
      return up === "TRUE" || up === "VRAI";
    };
    const isSorted = args.length >= 4 ? isTrueStr(evalArg(args[3])) : true;

    if (isNaN(rowIndex) || rowIndex < 1) return SHEET_ERRORS.VALUE;

    let sheet: string | undefined;
    let rest = rangeStr;
    const sheetMatch = rest.match(/^(?:'([^']+)'|([A-Z][A-Z0-9_ ]*))!(.+)$/i);
    if (sheetMatch) {
      sheet = sheetMatch[1] || sheetMatch[2];
      rest = sheetMatch[3];
    }
    const targetSheet = sheet || currentCell?.sheet;

    const rangeParts = rest.replace(/\$/g, "").split(":");
    if (rangeParts.length !== 2) return SHEET_ERRORS.NA;

    const startRef = parseColOrCellRef(rangeParts[0]);
    const endRef = parseColOrCellRef(rangeParts[1]);
    if (!startRef || !endRef) return SHEET_ERRORS.NA;

    const minCol = Math.min(startRef.col, endRef.col);
    const maxCol = Math.max(startRef.col, endRef.col);
    const lookupRow = startRef.row ?? 0;
    const resultRow = lookupRow + rowIndex - 1;

    const searchNum = Number(searchKey);
    const searchIsNum = !isNaN(searchNum) && searchKey.trim() !== "";
    let lastMatchCol = -1;

    for (let c = minCol; c <= maxCol; c++) {
      const rawVal = getData(lookupRow, c, targetSheet);
      if (!rawVal) continue;

      const cellVal = rawVal.startsWith("=")
        ? evaluateFormula(
            rawVal,
            getData,
            { r: lookupRow, c, sheet: targetSheet },
            visited,
          )
        : rawVal;

      if (isSorted) {
        if (searchIsNum) {
          const cellNum = Number(cellVal);
          if (!isNaN(cellNum) && cellNum <= searchNum) lastMatchCol = c;
          else if (!isNaN(cellNum) && cellNum > searchNum) break;
        } else {
          if (cellVal.toUpperCase() <= searchKey.toUpperCase())
            lastMatchCol = c;
          else break;
        }
      } else {
        if (searchIsNum) {
          if (Number(cellVal) === searchNum) {
            lastMatchCol = c;
            break;
          }
        } else {
          if (cellVal.toUpperCase() === searchKey.toUpperCase()) {
            lastMatchCol = c;
            break;
          }
        }
      }
    }

    if (lastMatchCol === -1) return SHEET_ERRORS.NA;

    const resultRaw = getData(resultRow, lastMatchCol, targetSheet);
    if (!resultRaw) return "";
    return resultRaw.startsWith("=")
      ? evaluateFormula(
          resultRaw,
          getData,
          { r: resultRow, c: lastMatchCol, sheet: targetSheet },
          visited,
        )
      : resultRaw;
  };
  registerFunction("HLOOKUP", hlookupFn);
  registerFunction("RECHERCHEH", hlookupFn);

  // INDEX(array, row_num, [col_num]) -- real implementation replacing stub
  const indexFn: SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
    getData,
    visited,
    currentCell,
  }) => {
    if (args.length < 2) return SHEET_ERRORS.NA;

    const rangeStr = args[0].trim();
    const rowNum = Math.floor(evalArgNum(args[1]));
    const colNum = args.length >= 3 ? Math.floor(evalArgNum(args[2])) : 1;

    if (rowNum < 1 || colNum < 1) return SHEET_ERRORS.VALUE;

    const { sheet, rest } = extractSheetPrefix(rangeStr);
    const targetSheet = sheet || currentCell?.sheet;
    const parts = rest.replace(/\$/g, "").split(":");
    if (parts.length !== 2) return SHEET_ERRORS.NA;

    const startRef = parseColOrCellRef(parts[0]);
    const endRef = parseColOrCellRef(parts[1]);
    if (!startRef || !endRef) return SHEET_ERRORS.NA;

    const minRow = Math.min(startRef.row ?? 0, endRef.row ?? 9999);
    const minCol = Math.min(startRef.col, endRef.col);

    const targetRow = minRow + rowNum - 1;
    const targetCol = minCol + colNum - 1;

    const maxRow = Math.max(startRef.row ?? 0, endRef.row ?? 9999);
    const maxCol = Math.max(startRef.col, endRef.col);
    if (targetRow > maxRow || targetCol > maxCol) return SHEET_ERRORS.REF;

    const rawVal = getData(targetRow, targetCol, targetSheet) || "";
    return rawVal.startsWith("=")
      ? evaluateFormula(
          rawVal,
          getData,
          { r: targetRow, c: targetCol, sheet: targetSheet },
          visited,
        )
      : rawVal;
  };
  registerFunction("INDEX", indexFn);

  // MATCH(lookup_value, lookup_array, [match_type]) -- real implementation
  const matchFn: SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
    getData,
    visited,
    currentCell,
  }) => {
    if (args.length < 2) return SHEET_ERRORS.NA;

    const lookupValue = evalArg(args[0]);
    const rangeStr = args[1].trim();
    const matchType = args.length >= 3 ? Math.floor(evalArgNum(args[2])) : 1;

    const { sheet, rest } = extractSheetPrefix(rangeStr);
    const targetSheet = sheet || currentCell?.sheet;
    const parts = rest.replace(/\$/g, "").split(":");
    if (parts.length !== 2) return SHEET_ERRORS.NA;

    const startRef = parseColOrCellRef(parts[0]);
    const endRef = parseColOrCellRef(parts[1]);
    if (!startRef || !endRef) return SHEET_ERRORS.NA;

    const minRow = Math.min(startRef.row ?? 0, endRef.row ?? 9999);
    const maxRow = Math.max(startRef.row ?? 0, endRef.row ?? 9999);
    const minCol = Math.min(startRef.col, endRef.col);
    const maxCol = Math.max(startRef.col, endRef.col);

    // Determine direction: 1D array (single row or single column)
    const isRow = minRow === maxRow;

    const lookupNum = Number(lookupValue);
    const lookupIsNum = !isNaN(lookupNum) && lookupValue.trim() !== "";

    const values: string[] = [];
    if (isRow) {
      for (let c = minCol; c <= maxCol; c++) {
        const rawVal = getData(minRow, c, targetSheet) || "";
        const val = rawVal.startsWith("=")
          ? evaluateFormula(
              rawVal,
              getData,
              { r: minRow, c, sheet: targetSheet },
              visited,
            )
          : rawVal;
        values.push(val);
      }
    } else {
      let emptyStreak = 0;
      for (let r = minRow; r <= maxRow; r++) {
        const rawVal = getData(r, minCol, targetSheet) || "";
        if (!rawVal) {
          emptyStreak++;
          if (
            emptyStreak > 50 &&
            (startRef.row === undefined || endRef.row === undefined)
          )
            break;
        } else {
          emptyStreak = 0;
        }
        const val = rawVal.startsWith("=")
          ? evaluateFormula(
              rawVal,
              getData,
              { r, c: minCol, sheet: targetSheet },
              visited,
            )
          : rawVal;
        values.push(val);
      }
    }

    if (matchType === 0) {
      // Exact match
      for (let i = 0; i < values.length; i++) {
        if (lookupIsNum) {
          if (Number(values[i]) === lookupNum) return i + 1;
        } else {
          if (values[i].toUpperCase() === lookupValue.toUpperCase())
            return i + 1;
        }
      }
      return SHEET_ERRORS.NA;
    } else if (matchType === 1) {
      // Largest value <= lookup_value (data must be ascending)
      let lastMatch = -1;
      for (let i = 0; i < values.length; i++) {
        if (lookupIsNum) {
          const cellNum = Number(values[i]);
          if (!isNaN(cellNum) && cellNum <= lookupNum) lastMatch = i;
          else if (!isNaN(cellNum) && cellNum > lookupNum) break;
        } else {
          if (values[i].toUpperCase() <= lookupValue.toUpperCase())
            lastMatch = i;
          else break;
        }
      }
      return lastMatch === -1 ? SHEET_ERRORS.NA : lastMatch + 1;
    } else {
      // matchType === -1: smallest value >= lookup_value (data must be descending)
      let lastMatch = -1;
      for (let i = 0; i < values.length; i++) {
        if (lookupIsNum) {
          const cellNum = Number(values[i]);
          if (!isNaN(cellNum) && cellNum >= lookupNum) lastMatch = i;
          else if (!isNaN(cellNum) && cellNum < lookupNum) break;
        } else {
          if (values[i].toUpperCase() >= lookupValue.toUpperCase())
            lastMatch = i;
          else break;
        }
      }
      return lastMatch === -1 ? SHEET_ERRORS.NA : lastMatch + 1;
    }
  };
  registerFunction("MATCH", matchFn);
  registerFunction("EQUIV", matchFn);

  // OFFSET(reference, rows, cols, [height], [width]) -- returns a value description
  const offsetFn: SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
    getData,
    visited,
    currentCell,
  }) => {
    if (args.length < 3) return SHEET_ERRORS.NA;
    const refStr = args[0].trim();
    const rowOffset = Math.floor(evalArgNum(args[1]));
    const colOffset = Math.floor(evalArgNum(args[2]));

    const { sheet, rest } = extractSheetPrefix(refStr);
    const targetSheet = sheet || currentCell?.sheet;
    const parsed = parseCellRef(rest);
    if (!parsed) return SHEET_ERRORS.REF;

    const newRow = parsed.row + rowOffset;
    const newCol = parsed.col + colOffset;
    if (newRow < 0 || newCol < 0) return SHEET_ERRORS.REF;

    // Without height/width, return single cell value
    const rawVal = getData(newRow, newCol, targetSheet) || "";
    return rawVal.startsWith("=")
      ? evaluateFormula(
          rawVal,
          getData,
          { r: newRow, c: newCol, sheet: targetSheet },
          visited,
        )
      : rawVal;
  };
  registerFunction("OFFSET", offsetFn);
  registerFunction("DECALER", offsetFn);

  // =========================================================================
  // CONDITIONAL AGGREGATION
  // =========================================================================

  // SUMIF(range, criteria, [sum_range])
  const sumifFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
    const criteriaRange = resolveRangeStrings(args[0]);
    const criteria = evalArg(args[1]);
    const sumValues =
      args.length === 3 ? resolveRange(args[2]) : criteriaRange.map(Number);

    let total = 0;
    for (let i = 0; i < criteriaRange.length; i++) {
      if (matchesCriteria(criteriaRange[i], criteria)) {
        const val = i < sumValues.length ? sumValues[i] : 0;
        if (!isNaN(val)) total += val;
      }
    }
    return total;
  };
  registerFunction("SUMIF", sumifFn);
  registerFunction("SOMME.SI", sumifFn);

  // SUMIFS(sum_range, criteria_range1, criteria1, ...)
  const sumifsFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 3 || (args.length - 1) % 2 !== 0) return SHEET_ERRORS.NA;
    const sumValues = resolveRange(args[0]);
    const pairs: { range: string[]; criteria: string }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      pairs.push({
        range: resolveRangeStrings(args[i]),
        criteria: evalArg(args[i + 1]),
      });
    }

    let total = 0;
    for (let i = 0; i < sumValues.length; i++) {
      const allMatch = pairs.every(
        (p) => i < p.range.length && matchesCriteria(p.range[i], p.criteria),
      );
      if (allMatch && !isNaN(sumValues[i])) total += sumValues[i];
    }
    return total;
  };
  registerFunction("SUMIFS", sumifsFn);
  registerFunction("SOMME.SI.ENS", sumifsFn);

  // COUNTIFS(criteria_range1, criteria1, ...)
  const countifsFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
  }) => {
    if (args.length < 2 || args.length % 2 !== 0) return SHEET_ERRORS.NA;
    const pairs: { range: string[]; criteria: string }[] = [];
    for (let i = 0; i < args.length; i += 2) {
      pairs.push({
        range: resolveRangeStrings(args[i]),
        criteria: evalArg(args[i + 1]),
      });
    }

    const len = pairs[0].range.length;
    let count = 0;
    for (let i = 0; i < len; i++) {
      const allMatch = pairs.every(
        (p) => i < p.range.length && matchesCriteria(p.range[i], p.criteria),
      );
      if (allMatch) count++;
    }
    return count;
  };
  registerFunction("COUNTIFS", countifsFn);
  registerFunction("NB.SI.ENS", countifsFn);

  // AVERAGEIF(range, criteria, [average_range])
  const averageifFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
    const criteriaRange = resolveRangeStrings(args[0]);
    const criteria = evalArg(args[1]);
    const avgValues =
      args.length === 3 ? resolveRange(args[2]) : criteriaRange.map(Number);

    let total = 0;
    let count = 0;
    for (let i = 0; i < criteriaRange.length; i++) {
      if (matchesCriteria(criteriaRange[i], criteria)) {
        const val = i < avgValues.length ? avgValues[i] : 0;
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      }
    }
    return count === 0 ? SHEET_ERRORS.DIV_ZERO : total / count;
  };
  registerFunction("AVERAGEIF", averageifFn);
  registerFunction("MOYENNE.SI", averageifFn);

  // AVERAGEIFS(average_range, criteria_range1, criteria1, ...)
  const averageifsFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 3 || (args.length - 1) % 2 !== 0) return SHEET_ERRORS.NA;
    const avgValues = resolveRange(args[0]);
    const pairs: { range: string[]; criteria: string }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      pairs.push({
        range: resolveRangeStrings(args[i]),
        criteria: evalArg(args[i + 1]),
      });
    }

    let total = 0;
    let count = 0;
    for (let i = 0; i < avgValues.length; i++) {
      const allMatch = pairs.every(
        (p) => i < p.range.length && matchesCriteria(p.range[i], p.criteria),
      );
      if (allMatch && !isNaN(avgValues[i])) {
        total += avgValues[i];
        count++;
      }
    }
    return count === 0 ? SHEET_ERRORS.DIV_ZERO : total / count;
  };
  registerFunction("AVERAGEIFS", averageifsFn);
  registerFunction("MOYENNE.SI.ENS", averageifsFn);

  // MINIFS(min_range, criteria_range1, criteria1, ...)
  const minifsFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 3 || (args.length - 1) % 2 !== 0) return SHEET_ERRORS.NA;
    const minValues = resolveRange(args[0]);
    const pairs: { range: string[]; criteria: string }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      pairs.push({
        range: resolveRangeStrings(args[i]),
        criteria: evalArg(args[i + 1]),
      });
    }

    let result: number | null = null;
    for (let i = 0; i < minValues.length; i++) {
      const allMatch = pairs.every(
        (p) => i < p.range.length && matchesCriteria(p.range[i], p.criteria),
      );
      if (allMatch && !isNaN(minValues[i])) {
        if (result === null || minValues[i] < result) result = minValues[i];
      }
    }
    return result === null ? 0 : result;
  };
  registerFunction("MINIFS", minifsFn);
  registerFunction("MIN.SI.ENS", minifsFn);

  // MAXIFS(max_range, criteria_range1, criteria1, ...)
  const maxifsFn: SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
    resolveRange,
  }) => {
    if (args.length < 3 || (args.length - 1) % 2 !== 0) return SHEET_ERRORS.NA;
    const maxValues = resolveRange(args[0]);
    const pairs: { range: string[]; criteria: string }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      pairs.push({
        range: resolveRangeStrings(args[i]),
        criteria: evalArg(args[i + 1]),
      });
    }

    let result: number | null = null;
    for (let i = 0; i < maxValues.length; i++) {
      const allMatch = pairs.every(
        (p) => i < p.range.length && matchesCriteria(p.range[i], p.criteria),
      );
      if (allMatch && !isNaN(maxValues[i])) {
        if (result === null || maxValues[i] > result) result = maxValues[i];
      }
    }
    return result === null ? 0 : result;
  };
  registerFunction("MAXIFS", maxifsFn);
  registerFunction("MAX.SI.ENS", maxifsFn);

  // =========================================================================
  // MATH (new functions not in base math.ts)
  // =========================================================================

  // PRODUCT(number1, ...)
  const productFn: SheetFunction = (ctx) => {
    const nums = flattenArgsNums(ctx);
    if (nums.length === 0) return 0;
    return nums.reduce((acc, n) => acc * n, 1);
  };
  registerFunction("PRODUCT", productFn);
  registerFunction("PRODUIT", productFn);

  // TRUNC(number, [num_digits])
  const truncFn: SheetFunction = ({ args, evalArgNum }) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const num = evalArgNum(args[0]);
    const digits = args.length === 2 ? Math.floor(evalArgNum(args[1])) : 0;
    const factor = Math.pow(10, digits);
    return Math.trunc(num * factor) / factor;
  };
  registerFunction("TRUNC", truncFn);
  registerFunction("TRONQUE", truncFn);

  // FACT(number)
  const factFn: SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const n = Math.floor(evalArgNum(args[0]));
    if (n < 0) return SHEET_ERRORS.VALUE;
    if (n > 170) return SHEET_ERRORS.VALUE; // overflow guard
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  };
  registerFunction("FACT", factFn);
  registerFunction("FACT", factFn);

  // COMBIN(n, k)
  const combinFn: SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const n = Math.floor(evalArgNum(args[0]));
    const k = Math.floor(evalArgNum(args[1]));
    if (n < 0 || k < 0 || k > n) return SHEET_ERRORS.VALUE;
    // C(n,k) = n! / (k! * (n-k)!) computed iteratively to avoid overflow
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    return Math.round(result);
  };
  registerFunction("COMBIN", combinFn);

  // GCD(number1, number2, ...)
  const gcdFn: SheetFunction = (ctx) => {
    const nums = flattenArgsNums(ctx);
    if (nums.length === 0) return SHEET_ERRORS.NA;
    return nums.reduce((a, b) => gcd2(a, b));
  };
  registerFunction("GCD", gcdFn);
  registerFunction("PGCD", gcdFn);

  // LCM(number1, number2, ...)
  const lcmFn: SheetFunction = (ctx) => {
    const nums = flattenArgsNums(ctx);
    if (nums.length === 0) return SHEET_ERRORS.NA;
    return nums.reduce((a, b) => lcm2(a, b));
  };
  registerFunction("LCM", lcmFn);
  registerFunction("PPCM", lcmFn);

  // =========================================================================
  // TEXT (new functions not in base text.ts)
  // =========================================================================

  // VALUE(text) -- parse text to number
  const valueFn: SheetFunction = ({ args, evalArg }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const text = evalArg(args[0]).trim();
    // Strip currency symbols, thousands separators
    const cleaned = text
      .replace(/[$\u20AC\u00A3]/g, "")
      .replace(/\s/g, "")
      .replace(/,/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? SHEET_ERRORS.VALUE : num;
  };
  registerFunction("VALUE", valueFn);
  registerFunction("CNUM", valueFn);

  // CLEAN(text) -- remove non-printable characters (ASCII 0-31)
  const cleanFn: SheetFunction = ({ args, evalArg }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
     
    return evalArg(args[0]).replace(/[\x00-\x1F]/g, "");
  };
  registerFunction("CLEAN", cleanFn);
  registerFunction("EPURAGE", cleanFn);

  // CHAR(number) -- return character for ASCII code
  const charFn: SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const code = Math.floor(evalArgNum(args[0]));
    if (code < 1 || code > 65535) return SHEET_ERRORS.VALUE;
    return String.fromCharCode(code);
  };
  registerFunction("CHAR", charFn);
  registerFunction("CAR", charFn);

  // CODE(text) -- return ASCII code of first character
  const codeFn: SheetFunction = ({ args, evalArg }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const text = evalArg(args[0]);
    if (text.length === 0) return SHEET_ERRORS.VALUE;
    return text.charCodeAt(0);
  };
  registerFunction("CODE", codeFn);

  // T(value) -- return text if value is text, otherwise empty string
  const tFn: SheetFunction = ({ args, evalArg }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const val = evalArg(args[0]);
    // If it's a number or error, return empty string
    if (Object.values(SHEET_ERRORS).includes(val)) return "";
    if (!isNaN(Number(val)) && val.trim() !== "") return "";
    const up = val.toUpperCase();
    if (up === "TRUE" || up === "FALSE" || up === "VRAI" || up === "FAUX")
      return "";
    return val;
  };
  registerFunction("T", tFn);

  // =========================================================================
  // STATISTICAL (new functions not in base)
  // =========================================================================

  // MODE(number1, ...)
  const modeFn: SheetFunction = (ctx) => {
    const nums = flattenArgsNums(ctx);
    if (nums.length === 0) return SHEET_ERRORS.NA;

    const freq = new Map<number, number>();
    for (const n of nums) {
      freq.set(n, (freq.get(n) || 0) + 1);
    }

    let maxCount = 0;
    let modeVal = nums[0];
    freq.forEach((count, val) => {
      if (count > maxCount) {
        maxCount = count;
        modeVal = val;
      }
    });
    if (maxCount <= 1) return SHEET_ERRORS.NA; // No repeated value
    return modeVal;
  };
  registerFunction("MODE", modeFn);
  registerFunction("MODE.SNGL", modeFn);

  // VAR(number1, ...) -- sample variance
  const varFn: SheetFunction = (ctx) => {
    const nums = flattenArgsNums(ctx);
    if (nums.length < 2) return SHEET_ERRORS.DIV_ZERO;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const sumSq = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    return sumSq / (nums.length - 1);
  };
  registerFunction("VAR", varFn);
  registerFunction("VAR.S", varFn);

  // PERCENTILE(array, k) -- k-th percentile (0 <= k <= 1)
  const percentileFn: SheetFunction = (ctx) => {
    const { args, evalArgNum } = ctx;
    if (args.length < 2) return SHEET_ERRORS.NA;
    const k = evalArgNum(args[args.length - 1]);
    if (k < 0 || k > 1) return SHEET_ERRORS.VALUE;

    const nums = flattenArgsNums({
      ...ctx,
      args: args.slice(0, args.length - 1),
    }).sort((a, b) => a - b);
    if (nums.length === 0) return SHEET_ERRORS.NA;

    const index = k * (nums.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return nums[lower];
    const frac = index - lower;
    return nums[lower] + frac * (nums[upper] - nums[lower]);
  };
  registerFunction("PERCENTILE", percentileFn);
  registerFunction("CENTILE", percentileFn);

  // QUARTILE(array, quart) -- quart: 0=min, 1=Q1, 2=median, 3=Q3, 4=max
  const quartileFn: SheetFunction = (ctx) => {
    const { args, evalArgNum } = ctx;
    if (args.length < 2) return SHEET_ERRORS.NA;
    const quart = Math.floor(evalArgNum(args[args.length - 1]));
    if (quart < 0 || quart > 4) return SHEET_ERRORS.VALUE;

    const nums = flattenArgsNums({
      ...ctx,
      args: args.slice(0, args.length - 1),
    }).sort((a, b) => a - b);
    if (nums.length === 0) return SHEET_ERRORS.NA;

    const k = quart / 4;
    const index = k * (nums.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return nums[lower];
    const frac = index - lower;
    return nums[lower] + frac * (nums[upper] - nums[lower]);
  };
  registerFunction("QUARTILE", quartileFn);

  // =========================================================================
  // LOGICAL (new functions not in base)
  // =========================================================================

  // CHOOSE(index_num, value1, ...)
  const chooseFn: SheetFunction = ({ args, evalArg, evalArgNum }) => {
    if (args.length < 2) return SHEET_ERRORS.NA;
    const idx = Math.floor(evalArgNum(args[0]));
    if (idx < 1 || idx >= args.length) return SHEET_ERRORS.VALUE;
    return evalArg(args[idx]);
  };
  registerFunction("CHOOSE", chooseFn);
  registerFunction("CHOISIR", chooseFn);

  // =========================================================================
  // INFORMATION (new functions not in base)
  // =========================================================================

  // TYPE(value) -- 1=number, 2=text, 4=logical, 16=error, 64=array
  const typeFn: SheetFunction = ({ args, evalArg }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const val = evalArg(args[0]);
    if (Object.values(SHEET_ERRORS).includes(val)) return 16;
    const up = val.toUpperCase();
    if (up === "TRUE" || up === "FALSE" || up === "VRAI" || up === "FAUX")
      return 4;
    if (!isNaN(Number(val)) && val.trim() !== "") return 1;
    return 2;
  };
  registerFunction("TYPE", typeFn);
}
