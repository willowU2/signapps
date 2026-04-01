import { SHEET_ERRORS } from "../formula";
import { registerFunction, FunctionContext, SheetFunction } from "./registry";

// Helpers
const parseDate = (val: string | number): Date => {
  if (typeof val === "number") {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + val);
    return d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
};

const formatDate = (d: Date): string => {
  if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function registerDateFunctions() {
  registerFunction("TODAY", () => formatDate(new Date()));
  registerFunction("AUJOURDHUI", () => formatDate(new Date()));

  registerFunction("NOW", () => new Date().toLocaleString());
  registerFunction("MAINTENANT", () => new Date().toLocaleString());

  const dateFn: SheetFunction = ({ args, evalArgNum }: FunctionContext) => {
    if (args.length !== 3) return SHEET_ERRORS.NA;
    const [y, m, d] = args.map(evalArgNum);
    return formatDate(new Date(y, m - 1, d));
  };
  registerFunction("DATE", dateFn);

  const datevalueFn: SheetFunction = ({ args, evalArg }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    const base = new Date(1899, 11, 30);
    return Math.floor((d.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
  };
  registerFunction("DATEVALUE", datevalueFn);
  registerFunction("DATEVAL", datevalueFn);

  const eomonthFn: SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
  }: FunctionContext) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const start = parseDate(evalArg(args[0]));
    const months = evalArgNum(args[1]);
    if (isNaN(start.getTime())) return SHEET_ERRORS.VALUE;
    return formatDate(
      new Date(start.getFullYear(), start.getMonth() + months + 1, 0),
    );
  };
  registerFunction("EOMONTH", eomonthFn);
  registerFunction("FIN.MOIS", eomonthFn);

  const edateFn: SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
  }: FunctionContext) => {
    if (args.length !== 2) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    const m = evalArgNum(args[1]);
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    d.setMonth(d.getMonth() + m);
    return formatDate(d);
  };
  registerFunction("EDATE", edateFn);
  registerFunction("MOIS.DECALE", edateFn);

  const yearFn: SheetFunction = ({ args, evalArg }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getFullYear();
  };
  registerFunction("YEAR", yearFn);
  registerFunction("ANNEE", yearFn);

  const monthFn: SheetFunction = ({ args, evalArg }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getMonth() + 1;
  };
  registerFunction("MONTH", monthFn);
  registerFunction("MOIS", monthFn);

  const dayFn: SheetFunction = ({ args, evalArg }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getDate();
  };
  registerFunction("DAY", dayFn);
  registerFunction("JOUR", dayFn);

  const netowrkdaysFn: SheetFunction = ({ args, evalArg }: FunctionContext) => {
    if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
    const start = parseDate(evalArg(args[0]));
    const end = parseDate(evalArg(args[1]));
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return SHEET_ERRORS.VALUE;

    // Ignoring holidays array argument parsing for now to stay fast
    let count = 0;
    let cur = new Date(start);
    const sign = start <= end ? 1 : -1;
    while (start <= end ? cur <= end : cur >= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count += sign;
      cur.setDate(cur.getDate() + sign);
    }
    return count;
  };
  registerFunction("NETWORKDAYS", netowrkdaysFn);
  registerFunction("NB.JOURS.OUVRES", netowrkdaysFn);

  // WEEKDAY(serial_number, [return_type])
  // return_type: 1 = Sun=1..Sat=7 (default), 2 = Mon=1..Sun=7, 3 = Mon=0..Sun=6
  const weekdayFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
    evalArgNum,
  }: FunctionContext) => {
    if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    const returnType = args.length === 2 ? evalArgNum(args[1]) : 1;
    const day = d.getDay(); // 0=Sunday, 1=Monday, ... 6=Saturday
    switch (returnType) {
      case 1:
        return day + 1; // 1=Sunday..7=Saturday
      case 2:
        return day === 0 ? 7 : day; // 1=Monday..7=Sunday
      case 3:
        return day === 0 ? 6 : day - 1; // 0=Monday..6=Sunday
      case 11:
        return day === 0 ? 7 : day; // same as 2
      case 12:
        return day < 2 ? day + 6 : day - 2; // 1=Tuesday..7=Monday
      case 13:
        return day < 3 ? day + 5 : day - 3; // 1=Wednesday..7=Tuesday
      case 14:
        return day < 4 ? day + 4 : day - 4; // 1=Thursday..7=Wednesday
      case 15:
        return day < 5 ? day + 3 : day - 5; // 1=Friday..7=Thursday
      case 16:
        return day < 6 ? day + 2 : day - 6; // 1=Saturday..7=Friday
      case 17:
        return day + 1; // same as 1
      default:
        return day + 1;
    }
  };
  registerFunction("WEEKDAY", weekdayFn);
  registerFunction("JOURSEM", weekdayFn);

  // DATEDIF(start_date, end_date, unit)
  // unit: "Y" = years, "M" = months, "D" = days, "MD" = days ignoring months/years,
  //        "YM" = months ignoring years, "YD" = days ignoring years
  const datedifFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
  }: FunctionContext) => {
    if (args.length !== 3) return SHEET_ERRORS.NA;
    const start = parseDate(evalArg(args[0]));
    const end = parseDate(evalArg(args[1]));
    const unit = evalArg(args[2]).toUpperCase();
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return SHEET_ERRORS.VALUE;
    if (start > end) return SHEET_ERRORS.VALUE;

    const sy = start.getFullYear(),
      sm = start.getMonth(),
      sd = start.getDate();
    const ey = end.getFullYear(),
      em = end.getMonth(),
      ed = end.getDate();

    switch (unit) {
      case "Y": {
        let years = ey - sy;
        if (em < sm || (em === sm && ed < sd)) years--;
        return Math.max(0, years);
      }
      case "M": {
        let months = (ey - sy) * 12 + (em - sm);
        if (ed < sd) months--;
        return Math.max(0, months);
      }
      case "D": {
        return Math.floor(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      case "MD": {
        // Days ignoring months and years
        let days = ed - sd;
        if (days < 0) {
          const prevMonth = new Date(ey, em, 0); // last day of previous month
          days = prevMonth.getDate() - sd + ed;
        }
        return days;
      }
      case "YM": {
        // Months ignoring years
        let months = em - sm;
        if (ed < sd) months--;
        if (months < 0) months += 12;
        return months;
      }
      case "YD": {
        // Days ignoring years
        const startThisYear = new Date(ey, sm, sd);
        if (startThisYear > end) {
          // wrap around from previous year
          const startPrevYear = new Date(ey - 1, sm, sd);
          return Math.floor(
            (end.getTime() - startPrevYear.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
        return Math.floor(
          (end.getTime() - startThisYear.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      default:
        return SHEET_ERRORS.VALUE;
    }
  };
  registerFunction("DATEDIF", datedifFn);

  // HOUR(serial_number) — extract hour from a time/date value
  const hourFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
  }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getHours();
  };
  registerFunction("HOUR", hourFn);
  registerFunction("HEURE", hourFn);

  // MINUTE(serial_number) — extract minute from a time/date value
  const minuteFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
  }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getMinutes();
  };
  registerFunction("MINUTE", minuteFn);

  // SECOND(serial_number) — extract second from a time/date value
  const secondFn: import("./registry").SheetFunction = ({
    args,
    evalArg,
  }: FunctionContext) => {
    if (args.length !== 1) return SHEET_ERRORS.NA;
    const d = parseDate(evalArg(args[0]));
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    return d.getSeconds();
  };
  registerFunction("SECOND", secondFn);
  registerFunction("SECONDE", secondFn);
}
