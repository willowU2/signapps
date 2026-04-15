import { SHEET_ERRORS } from "../formula";

export type CellValueGetter = (r: number, c: number, sheet?: string) => string;

export interface FunctionContext {
  args: string[];
  evalArg: (a: string) => string;
  evalArgNum: (a: string) => number;
  resolveRange: (rangeStr: string) => number[];
  resolveRangeStrings: (rangeStr: string) => string[];
  getData: CellValueGetter;
  visited: Set<string>;
  currentCell?: { r: number; c: number; sheet?: string };
}

export type SheetFunction = (ctx: FunctionContext) => string | number;

export const functionRegistry: Record<string, SheetFunction> = {};

export function registerFunction(name: string, fn: SheetFunction) {
  functionRegistry[name.toUpperCase()] = fn;
}

export function getRegisteredFunctionNames(): string[] {
  return Object.keys(functionRegistry);
}

export function executeFunctionOp(name: string, ctx: FunctionContext): string {
  const fn = functionRegistry[name.toUpperCase()];
  if (!fn) return SHEET_ERRORS.NAME;
  try {
    const result = fn(ctx);
    if (typeof result === "number") {
      return isNaN(result) ? SHEET_ERRORS.VALUE : result.toString();
    }
    return result;
  } catch {
    return SHEET_ERRORS.ERROR;
  }
}
