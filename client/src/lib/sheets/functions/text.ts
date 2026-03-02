import { SHEET_ERRORS } from "../formula";
import { registerFunction } from "./registry";

export function registerTextFunctions() {
    const upperFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]).toUpperCase();
    };
    registerFunction("UPPER", upperFn);
    registerFunction("MAJUSCULE", upperFn);

    const lowerFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]).toLowerCase();
    };
    registerFunction("LOWER", lowerFn);
    registerFunction("MINUSCULE", lowerFn);

    const properFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]).replace(/\b\w/g, c => c.toUpperCase());
    };
    registerFunction("PROPER", properFn);
    registerFunction("NOMPROPRE", properFn);

    const trimFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]).replace(/\s+/g, ' ').trim();
    };
    registerFunction("TRIM", trimFn);
    registerFunction("SUPPRESPACE", trimFn);

    const lenFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 1) return SHEET_ERRORS.NA;
        return evalArg(args[0]).length;
    };
    registerFunction("LEN", lenFn);
    registerFunction("NBCAR", lenFn);

    const leftFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
        const str = evalArg(args[0]);
        const n = args.length === 2 ? evalArgNum(args[1]) : 1;
        return str.substring(0, n);
    };
    registerFunction("LEFT", leftFn);
    registerFunction("GAUCHE", leftFn);

    const rightFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 1 || args.length > 2) return SHEET_ERRORS.NA;
        const str = evalArg(args[0]);
        const n = args.length === 2 ? evalArgNum(args[1]) : 1;
        return str.substring(str.length - n);
    };
    registerFunction("RIGHT", rightFn);
    registerFunction("DROITE", rightFn);

    const midFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length !== 3) return SHEET_ERRORS.NA;
        const str = evalArg(args[0]);
        const start = evalArgNum(args[1]) - 1; // 1-indexed in sheets
        const len = evalArgNum(args[2]);
        if (start < 0) return SHEET_ERRORS.VALUE;
        return str.substring(start, start + len);
    };
    registerFunction("MID", midFn);
    registerFunction("STXT", midFn);

    const concatenateFn: import('./registry').SheetFunction = ({ args, evalArg, resolveRangeStrings }) => {
        const expanded: string[] = [];
        for (const a of args) {
            if (a.includes(':')) expanded.push(...resolveRangeStrings(a));
            else expanded.push(evalArg(a));
        }
        return expanded.join('');
    };
    registerFunction("CONCATENATE", concatenateFn);
    registerFunction("CONCATENER", concatenateFn);

    const concatFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        return evalArg(args[0]) + evalArg(args[1]);
    };
    registerFunction("CONCAT", concatFn);

    const textJoinFn: import('./registry').SheetFunction = ({ args, evalArg, resolveRangeStrings }) => {
        if (args.length < 3) return SHEET_ERRORS.NA;
        const delimiter = evalArg(args[0]);
        const ignoreText = evalArg(args[1]).toUpperCase();
        const ignoreEmpty = ignoreText === 'TRUE' || ignoreText === 'VRAI';
        
        const expanded: string[] = [];
        for (const a of args.slice(2)) {
            if (a.includes(':')) expanded.push(...resolveRangeStrings(a));
            else expanded.push(evalArg(a));
        }
        return expanded.filter(v => !ignoreEmpty || v !== '').join(delimiter);
    };
    registerFunction("TEXTJOIN", textJoinFn);
    registerFunction("JOINDRE.TEXTE", textJoinFn);

    const substituteFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 3 || args.length > 4) return SHEET_ERRORS.NA;
        const text = evalArg(args[0]);
        const searchFor = evalArg(args[1]);
        const replaceWith = evalArg(args[2]);
        if (args.length === 4) {
            const occurrence = evalArgNum(args[3]);
            let count = 0;
            return text.replace(new RegExp(searchFor.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), (match) => {
                count++;
                return count === occurrence ? replaceWith : match;
            });
        }
        return text.split(searchFor).join(replaceWith);
    };
    registerFunction("SUBSTITUTE", substituteFn);
    registerFunction("SUBSTITUE", substituteFn);

    const findFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
        const searchFor = evalArg(args[0]);
        const textToSearch = evalArg(args[1]);
        const start = args.length === 3 ? evalArgNum(args[2]) - 1 : 0;
        const idx = textToSearch.indexOf(searchFor, start);
        return idx === -1 ? SHEET_ERRORS.VALUE : idx + 1;
    };
    registerFunction("FIND", findFn);
    registerFunction("TROUVE", findFn);

    const searchFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length < 2 || args.length > 3) return SHEET_ERRORS.NA;
        const searchFor = evalArg(args[0]).toLowerCase().replace(/\?/g, '.').replace(/\*/g, '.*');
        const textToSearch = evalArg(args[1]).toLowerCase();
        const start = args.length === 3 ? evalArgNum(args[2]) - 1 : 0;
        const sub = textToSearch.substring(start);
        const match = sub.match(new RegExp(searchFor));
        return match && match.index !== undefined ? match.index + start + 1 : SHEET_ERRORS.VALUE;
    };
    registerFunction("SEARCH", searchFn);
    registerFunction("CHERCHE", searchFn);

    const reptFn: import('./registry').SheetFunction = ({ args, evalArg, evalArgNum }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const text = evalArg(args[0]);
        const reps = Math.floor(evalArgNum(args[1]));
        if (reps < 0) return SHEET_ERRORS.VALUE;
        return text.repeat(reps);
    };
    registerFunction("REPT", reptFn);

    const exactFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        return evalArg(args[0]) === evalArg(args[1]) ? "TRUE" : "FALSE";
    };
    registerFunction("EXACT", exactFn);

    // Simple REGEX functions
    const regexExtractFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const text = evalArg(args[0]);
        const regStr = evalArg(args[1]);
        try {
            const match = text.match(new RegExp(regStr));
            if (!match) return SHEET_ERRORS.NA;
            return match[1] !== undefined ? match[1] : match[0];
        } catch {
            return SHEET_ERRORS.ERROR;
        }
    };
    registerFunction("REGEXEXTRACT", regexExtractFn);

    const regexMatchFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const text = evalArg(args[0]);
        const regStr = evalArg(args[1]);
        try {
            return new RegExp(regStr).test(text) ? "TRUE" : "FALSE";
        } catch {
            return SHEET_ERRORS.ERROR;
        }
    };
    registerFunction("REGEXMATCH", regexMatchFn);

    const regexReplaceFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 3) return SHEET_ERRORS.NA;
        const text = evalArg(args[0]);
        const regStr = evalArg(args[1]);
        const replacement = evalArg(args[2]);
        try {
            return text.replace(new RegExp(regStr, 'g'), replacement);
        } catch {
            return SHEET_ERRORS.ERROR;
        }
    };
    registerFunction("REGEXREPLACE", regexReplaceFn);
}
