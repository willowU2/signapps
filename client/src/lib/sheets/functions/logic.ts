import { SHEET_ERRORS } from "../formula";
import { registerFunction } from "./registry";

export function registerLogicFunctions() {
    const isTrueStr = (s: string) => {
        const up = s.toUpperCase();
        return up === 'TRUE' || up === 'VRAI';
    };

    const isFalseStr = (s: string) => {
        const up = s.toUpperCase();
        return up === 'FALSE' || up === 'FAUX';
    };

    const ifFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
        const condition = isTrueStr(evalArg(args[0])) || evalArgNum(args[0]) !== 0;
        if (condition) return evalArg(args[1]);
        return args.length === 3 ? evalArg(args[2]) : "FALSE";
    };
    registerFunction("IF", ifFn);
    registerFunction("SI", ifFn);

    const ifsFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 2 || args.length % 2 !== 0) return SHEET_ERRORS.NA;
        for (let i = 0; i < args.length; i += 2) {
            const conditionText = evalArg(args[i]);
            const condition = isTrueStr(conditionText) || evalArgNum(args[i]) !== 0;
            if (condition) return evalArg(args[i + 1]);
        }
        return SHEET_ERRORS.NA;
    };
    registerFunction("IFS", ifsFn);
    registerFunction("SI.CONDITIONS", ifsFn);

    const switchFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length < 3) return SHEET_ERRORS.NA;
        const expr = evalArg(args[0]);
        for (let i = 1; i < args.length - 1; i += 2) {
            if (evalArg(args[i]) === expr) return evalArg(args[i + 1]);
        }
        if (args.length % 2 === 0) return evalArg(args[args.length - 1]);
        return SHEET_ERRORS.NA;
    };
    registerFunction("SWITCH", switchFn);
    registerFunction("SI.MULTIPLE", switchFn);

    const andFn: import('./registry').SheetFunction = ({ args, evalArg, resolveRangeStrings }) => {
        if (args.length === 0) return SHEET_ERRORS.NA;
        const expanded = [];
        for (const a of args) {
             if (a.includes(':')) expanded.push(...resolveRangeStrings(a));
             else expanded.push(evalArg(a));
        }
        for (const val of expanded) {
            if (!isTrueStr(val) && Number(val) === 0) return "FALSE";
        }
        return "TRUE";
    };
    registerFunction("AND", andFn);
    registerFunction("ET", andFn);

    const orFn: import('./registry').SheetFunction = ({ args, evalArg, resolveRangeStrings }) => {
        if (args.length === 0) return SHEET_ERRORS.NA;
        const expanded = [];
        for (const a of args) {
             if (a.includes(':')) expanded.push(...resolveRangeStrings(a));
             else expanded.push(evalArg(a));
        }
        for (const val of expanded) {
            if (isTrueStr(val) || Number(val) !== 0) return "TRUE";
        }
        return "FALSE";
    };
    registerFunction("OR", orFn);
    registerFunction("OU", orFn);

    const notFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        const isTrue = isTrueStr(val) || evalArgNum(args[0]) !== 0;
        return isTrue ? "FALSE" : "TRUE";
    };
    registerFunction("NOT", notFn);
    registerFunction("NON", notFn);

    const ifErrorFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        if (Object.values(SHEET_ERRORS).includes(val)) {
            return args.length === 2 ? evalArg(args[1]) : "";
        }
        return val;
    };
    registerFunction("IFERROR", ifErrorFn);
    registerFunction("SIERREUR", ifErrorFn);

    const ifNaFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        if (val === SHEET_ERRORS.NA) return evalArg(args[1]);
        return val;
    };
    registerFunction("IFNA", ifNaFn);
    registerFunction("SI.ND", ifNaFn);

    const isBlankFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]) === "" ? "TRUE" : "FALSE";
    };
    registerFunction("ISBLANK", isBlankFn);
    registerFunction("ESTVIDE", isBlankFn);

    const isErrorFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return Object.values(SHEET_ERRORS).includes(evalArg(args[0])) ? "TRUE" : "FALSE";
    };
    registerFunction("ISERROR", isErrorFn);
    registerFunction("ESTERREUR", isErrorFn);

    const isErrFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        return Object.values(SHEET_ERRORS).includes(val) && val !== SHEET_ERRORS.NA ? "TRUE" : "FALSE";
    };
    registerFunction("ISERR", isErrFn);
    registerFunction("ESTERR", isErrFn);

    const isNaFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]) === SHEET_ERRORS.NA ? "TRUE" : "FALSE";
    };
    registerFunction("ISNA", isNaFn);
    registerFunction("ESTNA", isNaFn);

    const isTextFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        return !Object.values(SHEET_ERRORS).includes(val) && isNaN(Number(val)) ? "TRUE" : "FALSE";
    };
    registerFunction("ISTEXT", isTextFn);
    registerFunction("ESTTEXTE", isTextFn);

    const isNumberFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        if (val === '' || Object.values(SHEET_ERRORS).includes(val)) return "FALSE";
        return !isNaN(Number(val)) ? "TRUE" : "FALSE";
    };
    registerFunction("ISNUMBER", isNumberFn);
    registerFunction("ESTNUM", isNumberFn);

    // N(value) — convert value to a number. Text = 0, TRUE = 1, FALSE = 0, errors pass through
    const nFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        if (Object.values(SHEET_ERRORS).includes(val)) return val;
        const up = val.toUpperCase();
        if (up === 'TRUE' || up === 'VRAI') return 1;
        if (up === 'FALSE' || up === 'FAUX') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    };
    registerFunction("N", nFn);

    const isLogicalFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        const val = evalArg(args[0]);
        return (isTrueStr(val) || isFalseStr(val)) ? "TRUE" : "FALSE";
    };
    registerFunction("ISLOGICAL", isLogicalFn);
    registerFunction("ESTLOGIQUE", isLogicalFn);

    // --- LOOKUP & ARRAY SIMULATIONS ---
    
    const uniqueFn: import('./registry').SheetFunction = ({ args, evalArg, resolveRangeStrings }) => {
        if (args.length === 0) return SHEET_ERRORS.NA;
        const expanded = [];
        for (const a of args) {
             if (a.includes(':')) expanded.push(...resolveRangeStrings(a));
             else expanded.push(evalArg(a));
        }
        const unique = Array.from(new Set(expanded));
        return unique.length > 0 ? unique[0].toString() : SHEET_ERRORS.NA;
    };
    registerFunction("UNIQUE", uniqueFn);

    const filterFn: import('./registry').SheetFunction = () => {
        return SHEET_ERRORS.NA; 
    };
    registerFunction("FILTER", filterFn);
    registerFunction("FILTRE", filterFn);

    const vlookupFn: import('./registry').SheetFunction = () => {
        return SHEET_ERRORS.NA;
    };
    registerFunction("VLOOKUP", vlookupFn);
    registerFunction("RECHERCHEV", vlookupFn);

    const xlookupFn: import('./registry').SheetFunction = () => {
         return SHEET_ERRORS.NA;
    };
    registerFunction("XLOOKUP", xlookupFn);
    registerFunction("RECHERCHEX", xlookupFn);

    const indexFn: import('./registry').SheetFunction = () => {
         return SHEET_ERRORS.NA;
    };
    registerFunction("INDEX", indexFn);

    const matchFn: import('./registry').SheetFunction = () => {
         return SHEET_ERRORS.NA;
    };
    registerFunction("MATCH", matchFn);
    registerFunction("EQUIV", matchFn);
}
