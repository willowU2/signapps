import { SHEET_ERRORS } from "../formula";
import { registerFunction } from "./registry";

import { FunctionContext } from "./registry";

const extractArgsNums = (ctx: FunctionContext) => {
  const { args, evalArgNum, resolveRange } = ctx;
  const nums: number[] = [];
  for (const a of args) {
    if (a.includes(":")) {
      nums.push(...resolveRange(a));
    } else {
      nums.push(evalArgNum(a));
    }
  }
  return nums;
};

export function matchesCriteria(value: string, criteria: string): boolean {
  const opMatch = criteria.match(/^(>=|<=|<>|!=|>|<|=)(.+)$/);
  if (opMatch) {
    const op = opMatch[1],
      target = opMatch[2];
    const numVal = Number(value),
      numTarget = Number(target);
    if (!isNaN(numVal) && !isNaN(numTarget)) {
      if (op === ">") return numVal > numTarget;
      if (op === "<") return numVal < numTarget;
      if (op === ">=") return numVal >= numTarget;
      if (op === "<=") return numVal <= numTarget;
      if (op === "=" || op === "==") return numVal === numTarget;
      if (op === "<>" || op === "!=") return numVal !== numTarget;
    }
    if (op === "=" || op === "==") return value === target;
    if (op === "<>" || op === "!=") return value !== target;
  }
  if (criteria.includes("*") || criteria.includes("?")) {
    const pattern = criteria.replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${pattern}$`, "i").test(value);
  }
  const numVal = Number(value),
    numCrit = Number(criteria);
  if (!isNaN(numVal) && !isNaN(numCrit)) return numVal === numCrit;
  return value.toLowerCase() === criteria.toLowerCase();
}

export function registerMathFunctions() {
  const sumFn: import("./registry").SheetFunction = (ctx) => {
    let sum = 0;
    for (const a of extractArgsNums(ctx)) sum += a;
    return sum;
  };
  registerFunction("SUM", sumFn);
  registerFunction("SOMME", sumFn);

  const avgFn: import("./registry").SheetFunction = (ctx) => {
    const nums = extractArgsNums(ctx);
    if (nums.length === 0) return SHEET_ERRORS.DIV_ZERO;
    let sum = 0;
    for (const a of nums) {
      sum += a;
    }
    return sum / nums.length;
  };
  registerFunction("AVERAGE", avgFn);
  registerFunction("AVG", avgFn);
  registerFunction("MOYENNE", avgFn);

  const maxFn: import("./registry").SheetFunction = (ctx) => {
    const nums = extractArgsNums(ctx);
    return nums.length === 0 ? 0 : Math.max(...nums);
  };
  registerFunction("MAX", maxFn);

  const minFn: import("./registry").SheetFunction = (ctx) => {
    const nums = extractArgsNums(ctx);
    return nums.length === 0 ? 0 : Math.min(...nums);
  };
  registerFunction("MIN", minFn);

  const roundFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const factor = Math.pow(10, args.length === 2 ? evalArgNum(args[1]) : 0);
    return Math.round(evalArgNum(args[0]) * factor) / factor;
  };
  registerFunction("ROUND", roundFn);
  registerFunction("ARRONDI", roundFn);

  const roundUpFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const factor = Math.pow(10, args.length === 2 ? evalArgNum(args[1]) : 0);
    return Math.ceil(evalArgNum(args[0]) * factor) / factor;
  };
  registerFunction("ROUNDUP", roundUpFn);
  registerFunction("ARRONDI.SUP", roundUpFn);

  const roundDownFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const factor = Math.pow(10, args.length === 2 ? evalArgNum(args[1]) : 0);
    return Math.floor(evalArgNum(args[0]) * factor) / factor;
  };
  registerFunction("ROUNDDOWN", roundDownFn);
  registerFunction("ARRONDI.INF", roundDownFn);

  const absFn: import("./registry").SheetFunction = ({ args, evalArgNum }) =>
    args.length !== 1 ? SHEET_ERRORS.NA : Math.abs(evalArgNum(args[0]));
  registerFunction("ABS", absFn);

  const ceilingFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const sig = evalArgNum(args[1]);
    return sig === 0 ? 0 : Math.ceil(evalArgNum(args[0]) / sig) * sig;
  };
  registerFunction("CEILING", ceilingFn);
  registerFunction("PLAFOND", ceilingFn);

  const floorFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const sig = evalArgNum(args[1]);
    return sig === 0
      ? SHEET_ERRORS.DIV_ZERO
      : Math.floor(evalArgNum(args[0]) / sig) * sig;
  };
  registerFunction("FLOOR", floorFn);
  registerFunction("PLANCHER", floorFn);

  const sqrtFn: import("./registry").SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const num = evalArgNum(args[0]);
    return num < 0 ? SHEET_ERRORS.VALUE : Math.sqrt(num);
  };
  registerFunction("SQRT", sqrtFn);
  registerFunction("RACINE", sqrtFn);

  const powerFn: import("./registry").SheetFunction = ({ args, evalArgNum }) =>
    args.length !== 2
      ? SHEET_ERRORS.NA
      : Math.pow(evalArgNum(args[0]), evalArgNum(args[1]));
  registerFunction("POWER", powerFn);
  registerFunction("PUISSANCE", powerFn);

  const modFn: import("./registry").SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const d = evalArgNum(args[1]);
    return d === 0 ? SHEET_ERRORS.DIV_ZERO : evalArgNum(args[0]) % d;
  };
  registerFunction("MOD", modFn);

  const logFn: import("./registry").SheetFunction = ({ args, evalArgNum }) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const num = evalArgNum(args[0]),
      base = args.length === 2 ? evalArgNum(args[1]) : 10;
    return num <= 0 || base <= 0 || base === 1
      ? SHEET_ERRORS.VALUE
      : Math.log(num) / Math.log(base);
  };
  registerFunction("LOG", logFn);

  const log10Fn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const num = evalArgNum(args[0]);
    return num <= 0 ? SHEET_ERRORS.VALUE : Math.log10(num);
  };
  registerFunction("LOG10", log10Fn);

  const lnFn: import("./registry").SheetFunction = ({ args, evalArgNum }) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const num = evalArgNum(args[0]);
    return num <= 0 ? SHEET_ERRORS.VALUE : Math.log(num);
  };
  registerFunction("LN", lnFn);

  const expFn: import("./registry").SheetFunction = ({ args, evalArgNum }) =>
    args.length !== 1 ? SHEET_ERRORS.NA : Math.exp(evalArgNum(args[0]));
  registerFunction("EXP", expFn);

  const piFn: import("./registry").SheetFunction = ({ args }) =>
    args.length !== 0 ? SHEET_ERRORS.NA : Math.PI;
  registerFunction("PI", piFn);

  const randFn: import("./registry").SheetFunction = ({ args }) =>
    args.length !== 0 ? SHEET_ERRORS.NA : Math.random();
  registerFunction("RAND", randFn);
  registerFunction("ALEA", randFn);

  const randBetweenFn: import("./registry").SheetFunction = ({
    args,
    evalArgNum,
  }) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const min = Math.ceil(evalArgNum(args[0])),
      max = Math.floor(evalArgNum(args[1]));
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  registerFunction("RANDBETWEEN", randBetweenFn);
  registerFunction("ALEA.ENTRE.BORNES", randBetweenFn);

  const medianFn: import("./registry").SheetFunction = (ctx) => {
    const nums = extractArgsNums(ctx).sort((a, b) => a - b);
    if (nums.length === 0) return SHEET_ERRORS.NA;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  };
  registerFunction("MEDIAN", medianFn);
  registerFunction("MEDIANE", medianFn);

  const stdevFn: import("./registry").SheetFunction = (ctx) => {
    const nums = extractArgsNums(ctx);
    if (nums.length < 2) return SHEET_ERRORS.DIV_ZERO;
    const mean = nums.reduce((a, b) => a + b) / nums.length;
    return Math.sqrt(
      nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nums.length - 1),
    );
  };
  registerFunction("STDEV", stdevFn);
  registerFunction("ECARTYPE", stdevFn);

  const intFn: import("./registry").SheetFunction = ({ args, evalArgNum }) =>
    args.length !== 1 ? SHEET_ERRORS.NA : Math.floor(evalArgNum(args[0]));
  registerFunction("INT", intFn);
  registerFunction("ENT", intFn);

  const signFn: import("./registry").SheetFunction = ({ args, evalArgNum }) =>
    args.length !== 1 ? SHEET_ERRORS.NA : Math.sign(evalArgNum(args[0]));
  registerFunction("SIGN", signFn);
  registerFunction("SIGNE", signFn);

  const countFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
  }) => {
    let count = 0;
    const expanded = [];
    for (const a of args) {
      if (a.includes(":")) expanded.push(...resolveRangeStrings(a));
      else expanded.push(evalArg(a));
    }
    for (const val of expanded) {
      const n = Number(val);
      if (!isNaN(n) && val.trim() !== "") count++;
    }
    return count;
  };
  registerFunction("COUNT", countFn);
  registerFunction("NB", countFn);

  const countaFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
  }) => {
    let count = 0;
    const expanded = [];
    for (const a of args) {
      if (a.includes(":")) expanded.push(...resolveRangeStrings(a));
      else expanded.push(evalArg(a));
    }
    for (const val of expanded) {
      if (val.trim() !== "") count++;
    }
    return count;
  };
  registerFunction("COUNTA", countaFn);
  registerFunction("NBVAL", countaFn);

  const countifFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
    resolveRangeStrings,
  }) => {
    if (args.length < 2) return SHEET_ERRORS.NA;
    const criteria = evalArg(args[args.length - 1]);
    let count = 0;
    for (let i = 0; i < args.length - 1; i++) {
      const a = args[i];
      const expanded = a.includes(":") ? resolveRangeStrings(a) : [evalArg(a)];
      for (const val of expanded) {
        if (matchesCriteria(val, criteria)) count++;
      }
    }
    return count;
  };
  registerFunction("COUNTIF", countifFn);
  registerFunction("NB.SI", countifFn);

  const largeFn: import("./registry").SheetFunction = (ctx) => {
    const { args, evalArgNum } = ctx;
    if (args.length < 2) return SHEET_ERRORS.NA;
    const k = evalArgNum(args[args.length - 1]);
    const vals = extractArgsNums({
      ...ctx,
      args: args.slice(0, args.length - 1),
    }).sort((a, b) => b - a);
    return k < 1 || k > vals.length ? SHEET_ERRORS.NA : vals[Math.floor(k) - 1];
  };
  registerFunction("LARGE", largeFn);
  registerFunction("GRANDE.VALEUR", largeFn);

  const smallFn: import("./registry").SheetFunction = (ctx) => {
    const { args, evalArgNum } = ctx;
    if (args.length < 2) return SHEET_ERRORS.NA;
    const k = evalArgNum(args[args.length - 1]);
    const vals = extractArgsNums({
      ...ctx,
      args: args.slice(0, args.length - 1),
    }).sort((a, b) => a - b);
    return k < 1 || k > vals.length ? SHEET_ERRORS.NA : vals[Math.floor(k) - 1];
  };
  registerFunction("SMALL", smallFn);
  registerFunction("PETITE.VALEUR", smallFn);

  const rankFn: import("./registry").SheetFunction = (ctx) => {
    const { args, evalArgNum } = ctx;
    if (args.length < 2) return SHEET_ERRORS.NA;
    const val = evalArgNum(args[0]);
    let order = 0,
      rangeVals: number[] = [];
    if (args.length >= 3 && !isNaN(evalArgNum(args[args.length - 1]))) {
      order = evalArgNum(args[args.length - 1]);
      rangeVals = extractArgsNums({
        ...ctx,
        args: args.slice(1, args.length - 1),
      });
    } else {
      rangeVals = extractArgsNums({ ...ctx, args: args.slice(1) });
    }
    const sorted =
      order === 0
        ? rangeVals.sort((a, b) => b - a)
        : rangeVals.sort((a, b) => a - b);
    const idx = sorted.indexOf(val);
    return idx === -1 ? SHEET_ERRORS.NA : idx + 1;
  };
  registerFunction("RANK", rankFn);
  registerFunction("RANG", rankFn);

  const sparklineFn: import("./registry").SheetFunction = (ctx) => {
    const { args, evalArgNum, evalArg } = ctx;
    if (args.length < 1) return SHEET_ERRORS.NA;
    let type = "line";
    let valsArr = args;
    const last = evalArg(args[args.length - 1]).toLowerCase();
    if (["line", "bar", "column"].includes(last)) {
      type = last;
      valsArr = args.slice(0, args.length - 1);
    }
    const vals = extractArgsNums({ ...ctx, args: valsArr });
    return vals.length === 0 ? "" : `__SPARKLINE__:${type}:${vals.join(",")}`;
  };
  registerFunction("SPARKLINE", sparklineFn);
}
