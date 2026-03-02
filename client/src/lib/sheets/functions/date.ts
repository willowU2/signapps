import { SHEET_ERRORS } from "../formula";
import { registerFunction, FunctionContext } from "./registry";

// Helpers
const parseDate = (val: string | number): Date => {
    if (typeof val === 'number') {
        const d = new Date(1899, 11, 30);
        d.setDate(d.getDate() + val);
        return d;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
};

const formatDate = (d: Date): string => {
    if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function registerDateFunctions() {
    registerFunction("TODAY", () => formatDate(new Date()));
    registerFunction("AUJOURDHUI", () => formatDate(new Date()));

    registerFunction("NOW", () => new Date().toLocaleString());
    registerFunction("MAINTENANT", () => new Date().toLocaleString());
    
    const dateFn: import('./registry').FunctionContext | any = ({ args, evalArgNum }: any) => {
        if (args.length !== 3) return SHEET_ERRORS.NA;
        const [y, m, d] = args.map(evalArgNum);
        return formatDate(new Date(y, m - 1, d));
    };
    registerFunction("DATE", dateFn);

    const datevalueFn: import('./registry').FunctionContext | any = ({ args, evalArg }: any) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const d = parseDate(evalArg(args[0]));
        if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
        const base = new Date(1899, 11, 30);
        return Math.floor((d.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    };
    registerFunction("DATEVALUE", datevalueFn);
    registerFunction("DATEVAL", datevalueFn);

    const eomonthFn: import('./registry').FunctionContext | any = ({ args, evalArg, evalArgNum }: any) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const start = parseDate(evalArg(args[0]));
        const months = evalArgNum(args[1]);
        if (isNaN(start.getTime())) return SHEET_ERRORS.VALUE;
        return formatDate(new Date(start.getFullYear(), start.getMonth() + months + 1, 0));
    };
    registerFunction("EOMONTH", eomonthFn);
    registerFunction("FIN.MOIS", eomonthFn);

    const edateFn: import('./registry').FunctionContext | any = ({ args, evalArg, evalArgNum }: any) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const d = parseDate(evalArg(args[0]));
        const m = evalArgNum(args[1]);
        if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
        d.setMonth(d.getMonth() + m);
        return formatDate(d);
    };
    registerFunction("EDATE", edateFn);
    registerFunction("MOIS.DECALE", edateFn);

    const yearFn: import('./registry').FunctionContext | any = ({ args, evalArg }: any) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const d = parseDate(evalArg(args[0]));
        if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
        return d.getFullYear();
    };
    registerFunction("YEAR", yearFn);
    registerFunction("ANNEE", yearFn);

    const monthFn: import('./registry').FunctionContext | any = ({ args, evalArg }: any) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const d = parseDate(evalArg(args[0]));
        if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
        return d.getMonth() + 1;
    };
    registerFunction("MONTH", monthFn);
    registerFunction("MOIS", monthFn);

    const dayFn: import('./registry').FunctionContext | any = ({ args, evalArg }: any) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const d = parseDate(evalArg(args[0]));
        if (isNaN(d.getTime())) return SHEET_ERRORS.VALUE;
        return d.getDate();
    };
    registerFunction("DAY", dayFn);
    registerFunction("JOUR", dayFn);

    const netowrkdaysFn: import('./registry').FunctionContext | any = ({ args, evalArg }: any) => {
        if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
        const start = parseDate(evalArg(args[0]));
        const end = parseDate(evalArg(args[1]));
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return SHEET_ERRORS.VALUE;

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
}
