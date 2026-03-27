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

    // TEXT(value, format_text) — format a number or date as text
    const textFn: import('./registry').SheetFunction = ({ args, evalArg }) => {
        if (args.length !== 2) return SHEET_ERRORS.NA;
        const value = evalArg(args[0]);
        const format = evalArg(args[1]);
        const formatLower = format.toLowerCase();

        // Date formats — try to parse value as a date (Excel serial number or date string)
        const tryParseDate = (): Date | null => {
            const num = Number(value);
            if (!isNaN(num) && num > 0) {
                // Excel serial date: days since 1899-12-30
                const d = new Date(1899, 11, 30);
                d.setDate(d.getDate() + Math.floor(num));
                // Preserve fractional day as time
                const frac = num - Math.floor(num);
                if (frac > 0) {
                    d.setHours(Math.floor(frac * 24));
                    d.setMinutes(Math.floor((frac * 24 * 60) % 60));
                    d.setSeconds(Math.floor((frac * 24 * 3600) % 60));
                }
                return d;
            }
            // Parse date strings in local timezone (not UTC)
            // "2020-09-01" → new Date("2020-09-01T00:00:00") to avoid UTC midnight shift
            const str = String(value).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                const d = new Date(str + 'T00:00:00');
                return isNaN(d.getTime()) ? null : d;
            }
            // "01/09/2020" (DD/MM/YYYY) or "09/01/2020" (MM/DD/YYYY) — try DD/MM/YYYY first (French locale)
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
                const [a, b, y] = str.split('/').map(Number);
                // Try DD/MM/YYYY first (European)
                if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
                    const d = new Date(y, b - 1, a);
                    if (!isNaN(d.getTime())) return d;
                }
                // Fallback to MM/DD/YYYY
                if (b >= 1 && b <= 31 && a >= 1 && a <= 12) {
                    const d = new Date(y, a - 1, b);
                    if (!isNaN(d.getTime())) return d;
                }
            }
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : d;
        };

        // Check for date-related format tokens
        if (formatLower.includes('d') || formatLower.includes('m') || formatLower.includes('y') || formatLower.includes('j') || formatLower.includes('a')) {
            const d = tryParseDate();
            if (d) {
                // Full weekday name: DDDD / dddd
                if (/dddd/i.test(format)) {
                    return d.toLocaleDateString('fr-FR', { weekday: 'long' });
                }
                // Short weekday name: DDD / ddd
                if (/ddd/i.test(format)) {
                    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
                }
                // Full month name: MMMM / mmmm
                if (/mmmm/i.test(format)) {
                    return d.toLocaleDateString('fr-FR', { month: 'long' });
                }
                // Short month name: MMM / mmm
                if (/mmm/i.test(format)) {
                    return d.toLocaleDateString('fr-FR', { month: 'short' });
                }
                // dd/mm/yyyy or DD/MM/YYYY or jj/mm/aaaa
                if (/dd\/mm\/yyyy|jj\/mm\/aaaa/i.test(format)) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                }
                // mm/dd/yyyy
                if (/mm\/dd\/yyyy/i.test(format)) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
                }
                // yyyy-mm-dd
                if (/yyyy-mm-dd|aaaa-mm-jj/i.test(format)) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                }
                // dd/mm/yy
                if (/dd\/mm\/yy|jj\/mm\/aa/i.test(format)) {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
                }
                // Generic date format with d, m, y tokens
                let result = format;
                const pad = (n: number) => String(n).padStart(2, '0');
                result = result.replace(/yyyy|aaaa/gi, String(d.getFullYear()));
                result = result.replace(/yy|aa/gi, String(d.getFullYear()).slice(-2));
                result = result.replace(/dd|jj/gi, pad(d.getDate()));
                result = result.replace(/\bd\b|\bj\b/gi, String(d.getDate()));
                result = result.replace(/mm/gi, pad(d.getMonth() + 1));
                result = result.replace(/\bm\b/gi, String(d.getMonth() + 1));
                return result;
            }
        }

        // Time formats
        if (formatLower.includes('h') || formatLower.includes(':')) {
            const d = tryParseDate();
            if (d) {
                const pad = (n: number) => String(n).padStart(2, '0');
                let result = format;
                result = result.replace(/hh/gi, pad(d.getHours()));
                result = result.replace(/\bh\b/gi, String(d.getHours()));
                result = result.replace(/mm/gi, pad(d.getMinutes()));
                result = result.replace(/ss/gi, pad(d.getSeconds()));
                return result;
            }
        }

        // Number formats: #, 0, %, etc.
        const num = Number(value);
        if (!isNaN(num)) {
            // Percentage format
            if (format.includes('%')) {
                const pctFormat = format.replace('%', '');
                const decimals = (pctFormat.match(/0/g) || []).length;
                return (num * 100).toFixed(Math.max(0, decimals > 0 ? decimals - 1 : 0)) + '%';
            }
            // Number format with decimals: e.g. "0.00", "#,##0.00", "0"
            if (format.includes('#') || format.includes('0')) {
                const hasThousands = format.includes(',') || format.includes(' ');
                const decimalPart = format.split('.')[1] || '';
                const decimals = (decimalPart.match(/[0#]/g) || []).length;
                let formatted = num.toFixed(decimals);
                if (hasThousands) {
                    const parts = formatted.split('.');
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                    formatted = parts.join('.');
                }
                return formatted;
            }
            return String(num);
        }

        return String(value);
    };
    registerFunction("TEXT", textFn);
    registerFunction("TEXTE", textFn);
}
