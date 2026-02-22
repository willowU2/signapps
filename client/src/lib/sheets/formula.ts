// Advanced formula evaluation engine for Spreadsheets
// Supports math, cell references, ranges, and 30+ standard functions

type CellValueGetter = (r: number, c: number, sheet?: string) => string;

export const SHEET_ERRORS = {
    REF: '#REF!',
    NAME: '#NAME?',
    DIV_ZERO: '#DIV/0!',
    VALUE: '#VALUE!',
    ERROR: '#ERROR!',
    CYCLE: '#CYCLE!',
    NA: '#N/A'
};

const isError = (v: string) => Object.values(SHEET_ERRORS).includes(v)

interface CellRef {
    row: number;
    col: number;
}

export function evaluateFormula(
    formula: string,
    getData: CellValueGetter,
    currentCell?: { r: number, c: number },
    visited: Set<string> = new Set()
): string {
    if (!formula) return "";
    if (!formula.toString().startsWith('=')) {
        const num = Number(formula);
        return isNaN(num) ? formula : num.toString();
    }

    const cellId = currentCell ? `${currentCell.r},${currentCell.c}` : 'unknown';
    if (visited.has(cellId)) return SHEET_ERRORS.CYCLE;

    const newVisited = new Set(visited);
    if (currentCell) newVisited.add(cellId);

    try {
        let expression = formula.substring(1).trim();
        // Keep original case for string functions, but uppercase function names
        const upperExpr = expression.toUpperCase();

        // Process functions (handles nesting via recursive calls)
        const result = processExpression(upperExpr, expression, getData, newVisited);
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
    let temp, letter = '';
    while (index >= 0) {
        temp = index % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = (index - temp - 1) / 26;
    }
    return letter;
}

function parseCellRef(ref: string): CellRef | null {
    const clean = ref.replace(/\$/g, '');
    const match = clean.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    return { col: colToIndex(match[1]), row: parseInt(match[2]) - 1 };
}

function extractSheetPrefix(ref: string): { sheet?: string, rest: string } {
    const m = ref.match(/^(?:'([^']+)'|([A-Z][A-Z0-9_]*))!(.+)$/i);
    if (m) return { sheet: m[1] || m[2], rest: m[3] };
    return { rest: ref };
}

function resolveRange(rangeStr: string, getData: CellValueGetter, visited: Set<string>): number[] {
    const { sheet, rest } = extractSheetPrefix(rangeStr);
    const parts = rest.replace(/\$/g, '').split(':');
    if (parts.length !== 2) return [];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) return [];

    const minRow = Math.min(start.row, end.row), maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col), maxCol = Math.max(start.col, end.col);
    const values: number[] = [];

    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const rawVal = getData(r, c, sheet);
            if (rawVal) {
                const evaluated = rawVal.startsWith('=')
                    ? evaluateFormula(rawVal, getData, { r, c }, visited)
                    : rawVal;
                const num = Number(evaluated);
                if (!isNaN(num)) values.push(num);
            }
        }
    }
    return values;
}

function resolveRangeStrings(rangeStr: string, getData: CellValueGetter, visited: Set<string>): string[] {
    const { sheet, rest } = extractSheetPrefix(rangeStr);
    const parts = rest.replace(/\$/g, '').split(':');
    if (parts.length !== 2) return [];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) return [];

    const minRow = Math.min(start.row, end.row), maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col), maxCol = Math.max(start.col, end.col);
    const values: string[] = [];

    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const rawVal = getData(r, c, sheet) || '';
            const evaluated = rawVal.startsWith('=')
                ? evaluateFormula(rawVal, getData, { r, c }, visited)
                : rawVal;
            values.push(evaluated);
        }
    }
    return values;
}

function getCellValue(ref: string, getData: CellValueGetter, visited: Set<string>): string {
    const { sheet, rest } = extractSheetPrefix(ref);
    const parsed = parseCellRef(rest);
    if (!parsed) return ref;
    const rawVal = getData(parsed.row, parsed.col, sheet) || '';
    return rawVal.startsWith('=')
        ? evaluateFormula(rawVal, getData, { r: parsed.row, c: parsed.col }, visited)
        : rawVal;
}

function getCellNumericValue(ref: string, getData: CellValueGetter, visited: Set<string>): number {
    const val = getCellValue(ref, getData, visited);
    const num = Number(val);
    return isNaN(num) ? 0 : num;
}

// Parse function arguments respecting nested parentheses and quoted strings
function splitFunctionArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0, current = '', inString = false, stringChar = '';

    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i];
        if (inString) {
            current += ch;
            if (ch === stringChar) inString = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; current += ch; continue; }
        if (ch === '(') { depth++; current += ch; continue; }
        if (ch === ')') { depth--; current += ch; continue; }
        if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
        current += ch;
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

// Find matching closing paren
function findClosingParen(expr: string, start: number): number {
    let depth = 1;
    for (let i = start; i < expr.length; i++) {
        if (expr[i] === '(') depth++;
        if (expr[i] === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
}

function processExpression(upperExpr: string, originalExpr: string, getData: CellValueGetter, visited: Set<string>): string {
    // Match function calls from innermost out
    const fnRegex = /\b(SUM|AVERAGE|AVG|COUNT|COUNTA|MAX|MIN|IF|IFERROR|VLOOKUP|HLOOKUP|CONCATENATE|CONCAT|ROUND|ROUNDUP|ROUNDDOWN|ABS|CEILING|FLOOR|SQRT|POWER|MOD|LEN|UPPER|LOWER|TRIM|LEFT|RIGHT|MID|SUBSTITUTE|FIND|SEARCH|TEXT|VALUE|TODAY|NOW|DATE|YEAR|MONTH|DAY|COUNTIF|COUNTIFS|SUMIF|SUMIFS|AVERAGEIF|AND|OR|NOT|EXACT|PROPER|REPT|INDEX|MATCH|CHOOSE|LARGE|SMALL|RANK|MEDIAN|STDEV|INT|SIGN|LOG|LOG10|LN|EXP|PI|RAND|RANDBETWEEN|SPARKLINE)\(/;

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
            if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'")))
                return a.slice(1, -1);
            const { rest } = extractSheetPrefix(a);
            if (rest.includes(':')) return a;
            const cellRef = parseCellRef(rest);
            if (cellRef) return getCellValue(a, getData, visited);
            return a;
        };

        const evalArgNum = (a: string): number => {
            const v = evalArg(a);
            const n = Number(v);
            return isNaN(n) ? 0 : n;
        };

        let result: string;
        try {
            result = executeFunction(fnName, args, evalArg, evalArgNum, getData, visited);
        } catch {
            result = SHEET_ERRORS.ERROR;
        }

        expr = expr.substring(0, match.index) + result + expr.substring(argsEnd + 1);
    }

    // Process remaining cell references (handles $A$1, Sheet!Ref)
    expr = expr.replace(/(?:(?:'[^']+'|[A-Z][A-Z0-9_]*)!)?\$?([A-Z]+)\$?(\d+)/g, (fullMatch) => {
        const { sheet, rest } = extractSheetPrefix(fullMatch);
        const ref = parseCellRef(rest);
        if (!ref) return fullMatch;
        const rawVal = getData(ref.row, ref.col, sheet) || '';
        const val = rawVal.startsWith('=') ? evaluateFormula(rawVal, getData, { r: ref.row, c: ref.col }, visited) : rawVal;
        if (isError(val)) return val;
        const num = Number(val);
        return isNaN(num) ? '0' : num.toString();
    });

    if (isError(expr)) return expr;

    // Evaluate remaining math
    return evaluateMath(expr);
}

function executeFunction(
    fnName: string, args: string[],
    evalArg: (a: string) => string,
    evalArgNum: (a: string) => number,
    getData: CellValueGetter, visited: Set<string>
): string {
    switch (fnName) {
        case 'SUM': {
            let total = 0;
            for (const a of args) {
                if (a.includes(':')) total += resolveRange(a, getData, visited).reduce((s, v) => s + v, 0);
                else total += evalArgNum(a);
            }
            return total.toString();
        }
        case 'AVERAGE': case 'AVG': {
            const vals: number[] = [];
            for (const a of args) {
                if (a.includes(':')) vals.push(...resolveRange(a, getData, visited));
                else vals.push(evalArgNum(a));
            }
            return vals.length === 0 ? SHEET_ERRORS.DIV_ZERO : (vals.reduce((s, v) => s + v, 0) / vals.length).toString();
        }
        case 'COUNT': {
            let count = 0;
            for (const a of args) {
                if (a.includes(':')) count += resolveRange(a, getData, visited).length;
                else { const n = Number(evalArg(a)); if (!isNaN(n)) count++; }
            }
            return count.toString();
        }
        case 'COUNTA': {
            let count = 0;
            for (const a of args) {
                if (a.includes(':')) count += resolveRangeStrings(a, getData, visited).filter(v => v.trim() !== '').length;
                else { if (evalArg(a).trim() !== '') count++; }
            }
            return count.toString();
        }
        case 'MAX': {
            const vals: number[] = [];
            for (const a of args) {
                if (a.includes(':')) vals.push(...resolveRange(a, getData, visited));
                else vals.push(evalArgNum(a));
            }
            return vals.length === 0 ? '0' : Math.max(...vals).toString();
        }
        case 'MIN': {
            const vals: number[] = [];
            for (const a of args) {
                if (a.includes(':')) vals.push(...resolveRange(a, getData, visited));
                else vals.push(evalArgNum(a));
            }
            return vals.length === 0 ? '0' : Math.min(...vals).toString();
        }
        case 'MEDIAN': {
            const vals: number[] = [];
            for (const a of args) {
                if (a.includes(':')) vals.push(...resolveRange(a, getData, visited));
                else vals.push(evalArgNum(a));
            }
            if (vals.length === 0) return SHEET_ERRORS.NA;
            vals.sort((a, b) => a - b);
            const mid = Math.floor(vals.length / 2);
            return vals.length % 2 !== 0 ? vals[mid].toString() : ((vals[mid - 1] + vals[mid]) / 2).toString();
        }
        case 'STDEV': {
            const vals: number[] = [];
            for (const a of args) {
                if (a.includes(':')) vals.push(...resolveRange(a, getData, visited));
                else vals.push(evalArgNum(a));
            }
            if (vals.length < 2) return SHEET_ERRORS.DIV_ZERO;
            const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
            const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
            return Math.sqrt(variance).toString();
        }
        case 'IF': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const condStr = evalArg(args[0]);
            // Evaluate comparison operators
            let cond = false;
            const compMatch = condStr.match(/^(.+?)(>=|<=|<>|!=|>|<|=)(.+)$/);
            if (compMatch) {
                const left = Number(compMatch[1]), right = Number(compMatch[3]);
                const op = compMatch[2];
                if (!isNaN(left) && !isNaN(right)) {
                    if (op === '>') cond = left > right;
                    else if (op === '<') cond = left < right;
                    else if (op === '>=' ) cond = left >= right;
                    else if (op === '<=') cond = left <= right;
                    else if (op === '=' || op === '==') cond = left === right;
                    else if (op === '<>' || op === '!=') cond = left !== right;
                } else {
                    // String comparison
                    if (op === '=' || op === '==') cond = compMatch[1].trim() === compMatch[3].trim();
                    else if (op === '<>' || op === '!=') cond = compMatch[1].trim() !== compMatch[3].trim();
                }
            } else {
                const n = Number(condStr);
                cond = !isNaN(n) ? n !== 0 : condStr.toUpperCase() === 'TRUE';
            }
            const trueVal = evalArg(args[1]);
            const falseVal = args.length >= 3 ? evalArg(args[2]) : '0';
            return cond ? trueVal : falseVal;
        }
        case 'IFERROR': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const val = evalArg(args[0]);
            return isError(val) ? evalArg(args[1]) : val;
        }
        case 'AND': {
            for (const a of args) {
                const v = evalArgNum(a);
                if (v === 0) return 'FALSE';
            }
            return 'TRUE';
        }
        case 'OR': {
            for (const a of args) {
                const v = evalArgNum(a);
                if (v !== 0) return 'TRUE';
            }
            return 'FALSE';
        }
        case 'NOT': {
            const v = evalArgNum(args[0]);
            return v === 0 ? 'TRUE' : 'FALSE';
        }
        case 'VLOOKUP': {
            if (args.length < 3) return SHEET_ERRORS.ERROR;
            const lookupVal = evalArg(args[0]);
            const rangeStr = args[1].trim();
            const colIdx = evalArgNum(args[2]);
            const approx = args.length >= 4 ? evalArg(args[3]).toUpperCase() !== 'FALSE' && evalArg(args[3]) !== '0' : true;

            const rangeParts = rangeStr.split(':');
            if (rangeParts.length !== 2) return SHEET_ERRORS.ERROR;
            const start = parseCellRef(rangeParts[0]);
            const end = parseCellRef(rangeParts[1]);
            if (!start || !end) return SHEET_ERRORS.ERROR;

            const lookupNum = Number(lookupVal);
            let bestRow = -1;

            for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
                const cellVal = getData(r, Math.min(start.col, end.col));
                const evaluated = cellVal?.startsWith('=') ? evaluateFormula(cellVal, getData, { r, c: Math.min(start.col, end.col) }, visited) : (cellVal || '');

                if (evaluated === lookupVal || evaluated.toUpperCase() === lookupVal.toUpperCase()) {
                    bestRow = r;
                    break;
                }
                if (approx && !isNaN(lookupNum) && !isNaN(Number(evaluated)) && Number(evaluated) <= lookupNum) {
                    bestRow = r;
                }
            }
            if (bestRow === -1) return SHEET_ERRORS.NA;

            const resultCol = Math.min(start.col, end.col) + colIdx - 1;
            if (resultCol > Math.max(start.col, end.col)) return SHEET_ERRORS.REF;
            const resultVal = getData(bestRow, resultCol) || '';
            return resultVal.startsWith('=') ? evaluateFormula(resultVal, getData, { r: bestRow, c: resultCol }, visited) : resultVal;
        }
        case 'HLOOKUP': {
            if (args.length < 3) return SHEET_ERRORS.ERROR;
            const lookupVal = evalArg(args[0]);
            const rangeStr = args[1].trim();
            const rowIdx = evalArgNum(args[2]);

            const rangeParts = rangeStr.split(':');
            if (rangeParts.length !== 2) return SHEET_ERRORS.ERROR;
            const start = parseCellRef(rangeParts[0]);
            const end = parseCellRef(rangeParts[1]);
            if (!start || !end) return SHEET_ERRORS.ERROR;

            let bestCol = -1;
            const firstRow = Math.min(start.row, end.row);
            for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
                const cellVal = getData(firstRow, c) || '';
                const evaluated = cellVal.startsWith('=') ? evaluateFormula(cellVal, getData, { r: firstRow, c }, visited) : cellVal;
                if (evaluated === lookupVal || evaluated.toUpperCase() === lookupVal.toUpperCase()) {
                    bestCol = c; break;
                }
            }
            if (bestCol === -1) return SHEET_ERRORS.NA;

            const resultRow = firstRow + rowIdx - 1;
            if (resultRow > Math.max(start.row, end.row)) return SHEET_ERRORS.REF;
            const resultVal = getData(resultRow, bestCol) || '';
            return resultVal.startsWith('=') ? evaluateFormula(resultVal, getData, { r: resultRow, c: bestCol }, visited) : resultVal;
        }
        case 'INDEX': {
            if (args.length < 3) return SHEET_ERRORS.ERROR;
            const rangeStr = args[0].trim();
            const rowNum = evalArgNum(args[1]);
            const colNum = evalArgNum(args[2]);

            const rangeParts = rangeStr.split(':');
            if (rangeParts.length !== 2) return SHEET_ERRORS.ERROR;
            const start = parseCellRef(rangeParts[0]);
            const end = parseCellRef(rangeParts[1]);
            if (!start || !end) return SHEET_ERRORS.ERROR;

            const r = Math.min(start.row, end.row) + rowNum - 1;
            const c = Math.min(start.col, end.col) + colNum - 1;
            if (r > Math.max(start.row, end.row) || c > Math.max(start.col, end.col)) return SHEET_ERRORS.REF;

            const val = getData(r, c) || '';
            return val.startsWith('=') ? evaluateFormula(val, getData, { r, c }, visited) : val;
        }
        case 'MATCH': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const lookupVal = evalArg(args[0]);
            const rangeStr = args[1].trim();

            const rangeParts = rangeStr.split(':');
            if (rangeParts.length !== 2) return SHEET_ERRORS.ERROR;
            const start = parseCellRef(rangeParts[0]);
            const end = parseCellRef(rangeParts[1]);
            if (!start || !end) return SHEET_ERRORS.ERROR;

            const isRow = start.row === end.row;
            const min = isRow ? Math.min(start.col, end.col) : Math.min(start.row, end.row);
            const max = isRow ? Math.max(start.col, end.col) : Math.max(start.row, end.row);

            for (let i = min; i <= max; i++) {
                const r = isRow ? start.row : i;
                const c = isRow ? i : start.col;
                const val = getData(r, c) || '';
                const evaluated = val.startsWith('=') ? evaluateFormula(val, getData, { r, c }, visited) : val;
                if (evaluated === lookupVal || evaluated.toUpperCase() === lookupVal.toUpperCase()) {
                    return (i - min + 1).toString();
                }
            }
            return SHEET_ERRORS.NA;
        }
        case 'CHOOSE': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const idx = evalArgNum(args[0]);
            if (idx < 1 || idx >= args.length) return SHEET_ERRORS.VALUE;
            return evalArg(args[Math.floor(idx)]);
        }
        case 'CONCATENATE': case 'CONCAT': {
            return args.map(a => evalArg(a)).join('');
        }
        case 'ROUND': {
            const val = evalArgNum(args[0]);
            const places = args.length >= 2 ? evalArgNum(args[1]) : 0;
            const factor = Math.pow(10, places);
            return (Math.round(val * factor) / factor).toString();
        }
        case 'ROUNDUP': {
            const val = evalArgNum(args[0]);
            const places = args.length >= 2 ? evalArgNum(args[1]) : 0;
            const factor = Math.pow(10, places);
            return (Math.ceil(val * factor) / factor).toString();
        }
        case 'ROUNDDOWN': {
            const val = evalArgNum(args[0]);
            const places = args.length >= 2 ? evalArgNum(args[1]) : 0;
            const factor = Math.pow(10, places);
            return (Math.floor(val * factor) / factor).toString();
        }
        case 'INT': return Math.floor(evalArgNum(args[0])).toString();
        case 'ABS': return Math.abs(evalArgNum(args[0])).toString();
        case 'SIGN': return Math.sign(evalArgNum(args[0])).toString();
        case 'SQRT': {
            const val = evalArgNum(args[0]);
            return val < 0 ? SHEET_ERRORS.VALUE : Math.sqrt(val).toString();
        }
        case 'POWER': return Math.pow(evalArgNum(args[0]), evalArgNum(args[1])).toString();
        case 'MOD': {
            const d = evalArgNum(args[1]);
            return d === 0 ? SHEET_ERRORS.DIV_ZERO : (evalArgNum(args[0]) % d).toString();
        }
        case 'LOG': {
            const val = evalArgNum(args[0]);
            const base = args.length >= 2 ? evalArgNum(args[1]) : 10;
            return val <= 0 ? SHEET_ERRORS.VALUE : (Math.log(val) / Math.log(base)).toString();
        }
        case 'LOG10': {
            const val = evalArgNum(args[0]);
            return val <= 0 ? SHEET_ERRORS.VALUE : Math.log10(val).toString();
        }
        case 'LN': {
            const val = evalArgNum(args[0]);
            return val <= 0 ? SHEET_ERRORS.VALUE : Math.log(val).toString();
        }
        case 'EXP': return Math.exp(evalArgNum(args[0])).toString();
        case 'PI': return Math.PI.toString();
        case 'RAND': return Math.random().toString();
        case 'RANDBETWEEN': {
            const lo = evalArgNum(args[0]), hi = evalArgNum(args[1]);
            return (Math.floor(Math.random() * (hi - lo + 1)) + lo).toString();
        }
        case 'CEILING': {
            const val = evalArgNum(args[0]);
            const sig = args.length >= 2 ? evalArgNum(args[1]) : 1;
            return sig === 0 ? '0' : (Math.ceil(val / sig) * sig).toString();
        }
        case 'FLOOR': {
            const val = evalArgNum(args[0]);
            const sig = args.length >= 2 ? evalArgNum(args[1]) : 1;
            return sig === 0 ? '0' : (Math.floor(val / sig) * sig).toString();
        }
        case 'LEN': return evalArg(args[0]).length.toString();
        case 'UPPER': return evalArg(args[0]).toUpperCase();
        case 'LOWER': return evalArg(args[0]).toLowerCase();
        case 'PROPER': {
            return evalArg(args[0]).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
        }
        case 'TRIM': return evalArg(args[0]).trim().replace(/\s+/g, ' ');
        case 'EXACT': return evalArg(args[0]) === evalArg(args[1]) ? 'TRUE' : 'FALSE';
        case 'LEFT': {
            const str = evalArg(args[0]);
            const n = args.length >= 2 ? evalArgNum(args[1]) : 1;
            return str.substring(0, n);
        }
        case 'RIGHT': {
            const str = evalArg(args[0]);
            const n = args.length >= 2 ? evalArgNum(args[1]) : 1;
            return str.substring(Math.max(0, str.length - n));
        }
        case 'MID': {
            const str = evalArg(args[0]);
            const start = evalArgNum(args[1]);
            const len = evalArgNum(args[2]);
            return str.substring(start - 1, start - 1 + len);
        }
        case 'SUBSTITUTE': {
            const str = evalArg(args[0]);
            const old = evalArg(args[1]);
            const rep = evalArg(args[2]);
            if (args.length >= 4) {
                const n = evalArgNum(args[3]);
                let count = 0, result = str;
                let idx = -1;
                while ((idx = result.indexOf(old, idx + 1)) !== -1) {
                    count++;
                    if (count === n) {
                        result = result.substring(0, idx) + rep + result.substring(idx + old.length);
                        break;
                    }
                }
                return result;
            }
            return str.split(old).join(rep);
        }
        case 'FIND': case 'SEARCH': {
            const needle = evalArg(args[0]);
            const haystack = evalArg(args[1]);
            const startPos = args.length >= 3 ? evalArgNum(args[2]) - 1 : 0;
            const idx = fnName === 'FIND'
                ? haystack.indexOf(needle, startPos)
                : haystack.toLowerCase().indexOf(needle.toLowerCase(), startPos);
            return idx === -1 ? SHEET_ERRORS.VALUE : (idx + 1).toString();
        }
        case 'REPT': {
            const str = evalArg(args[0]);
            const n = evalArgNum(args[1]);
            return str.repeat(Math.max(0, Math.floor(n)));
        }
        case 'TEXT': {
            const val = evalArgNum(args[0]);
            const fmt = evalArg(args[1]);
            if (fmt === '0') return Math.round(val).toString();
            if (fmt === '0.00') return val.toFixed(2);
            if (fmt === '0.0') return val.toFixed(1);
            if (fmt === '#,##0') return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
            if (fmt === '#,##0.00') return val.toLocaleString('en-US', { minimumFractionDigits: 2 });
            if (fmt === '0%') return (val * 100).toFixed(0) + '%';
            if (fmt === '0.00%') return (val * 100).toFixed(2) + '%';
            return val.toString();
        }
        case 'VALUE': {
            const n = Number(evalArg(args[0]).replace(/[,$%]/g, ''));
            return isNaN(n) ? SHEET_ERRORS.VALUE : n.toString();
        }
        case 'TODAY': {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        case 'NOW': {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        case 'DATE': {
            const y = evalArgNum(args[0]), m = evalArgNum(args[1]), d = evalArgNum(args[2]);
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
        case 'YEAR': { const d = new Date(evalArg(args[0])); return isNaN(d.getTime()) ? SHEET_ERRORS.VALUE : d.getFullYear().toString(); }
        case 'MONTH': { const d = new Date(evalArg(args[0])); return isNaN(d.getTime()) ? SHEET_ERRORS.VALUE : (d.getMonth() + 1).toString(); }
        case 'DAY': { const d = new Date(evalArg(args[0])); return isNaN(d.getTime()) ? SHEET_ERRORS.VALUE : d.getDate().toString(); }
        case 'COUNTIF': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const rangeStr = args[0].trim();
            const criteria = evalArg(args[1]);
            const values = resolveRangeStrings(rangeStr, getData, visited);
            return countWithCriteria(values, criteria).toString();
        }
        case 'COUNTIFS': {
            if (args.length < 2 || args.length % 2 !== 0) return SHEET_ERRORS.ERROR;
            // Get first range to determine size
            const firstRange = args[0].trim();
            const rangeParts = firstRange.split(':');
            if (rangeParts.length !== 2) return SHEET_ERRORS.ERROR;
            const start = parseCellRef(rangeParts[0]);
            const end = parseCellRef(rangeParts[1]);
            if (!start || !end) return SHEET_ERRORS.ERROR;

            const rows = Math.abs(end.row - start.row) + 1;
            const cols = Math.abs(end.col - start.col) + 1;
            const totalCells = rows * cols;

            // Check each pair
            const passing = new Array(totalCells).fill(true);
            for (let p = 0; p < args.length; p += 2) {
                const rangeVals = resolveRangeStrings(args[p].trim(), getData, visited);
                const criteria = evalArg(args[p + 1]);
                for (let i = 0; i < rangeVals.length; i++) {
                    if (passing[i] && !matchesCriteria(rangeVals[i], criteria)) passing[i] = false;
                }
            }
            return passing.filter(Boolean).length.toString();
        }
        case 'SUMIF': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const rangeStr = args[0].trim();
            const criteria = evalArg(args[1]);
            const sumRangeStr = args.length >= 3 ? args[2].trim() : rangeStr;
            const rangeVals = resolveRangeStrings(rangeStr, getData, visited);
            const sumVals = resolveRange(sumRangeStr, getData, visited);
            let total = 0;
            for (let i = 0; i < rangeVals.length; i++) {
                if (matchesCriteria(rangeVals[i], criteria)) total += (sumVals[i] || 0);
            }
            return total.toString();
        }
        case 'SUMIFS': {
            if (args.length < 3 || (args.length - 1) % 2 !== 0) return SHEET_ERRORS.ERROR;
            const sumVals = resolveRange(args[0].trim(), getData, visited);
            const passing = new Array(sumVals.length).fill(true);
            for (let p = 1; p < args.length; p += 2) {
                const rangeVals = resolveRangeStrings(args[p].trim(), getData, visited);
                const criteria = evalArg(args[p + 1]);
                for (let i = 0; i < rangeVals.length; i++) {
                    if (passing[i] && !matchesCriteria(rangeVals[i], criteria)) passing[i] = false;
                }
            }
            let total = 0;
            for (let i = 0; i < sumVals.length; i++) {
                if (passing[i]) total += sumVals[i];
            }
            return total.toString();
        }
        case 'AVERAGEIF': {
            if (args.length < 2) return SHEET_ERRORS.ERROR;
            const rangeStr = args[0].trim();
            const criteria = evalArg(args[1]);
            const sumRangeStr = args.length >= 3 ? args[2].trim() : rangeStr;
            const rangeVals = resolveRangeStrings(rangeStr, getData, visited);
            const sumVals = resolveRange(sumRangeStr, getData, visited);
            let total = 0, count = 0;
            for (let i = 0; i < rangeVals.length; i++) {
                if (matchesCriteria(rangeVals[i], criteria)) { total += (sumVals[i] || 0); count++; }
            }
            return count === 0 ? SHEET_ERRORS.DIV_ZERO : (total / count).toString();
        }
        case 'LARGE': {
            const vals = resolveRange(args[0].trim(), getData, visited).sort((a, b) => b - a);
            const k = evalArgNum(args[1]);
            return k < 1 || k > vals.length ? SHEET_ERRORS.NA : vals[Math.floor(k) - 1].toString();
        }
        case 'SMALL': {
            const vals = resolveRange(args[0].trim(), getData, visited).sort((a, b) => a - b);
            const k = evalArgNum(args[1]);
            return k < 1 || k > vals.length ? SHEET_ERRORS.NA : vals[Math.floor(k) - 1].toString();
        }
        case 'RANK': {
            const val = evalArgNum(args[0]);
            const vals = resolveRange(args[1].trim(), getData, visited);
            const order = args.length >= 3 ? evalArgNum(args[2]) : 0;
            const sorted = order === 0 ? vals.sort((a, b) => b - a) : vals.sort((a, b) => a - b);
            const idx = sorted.indexOf(val);
            return idx === -1 ? SHEET_ERRORS.NA : (idx + 1).toString();
        }
        case 'SPARKLINE': {
            if (args.length < 1) return SHEET_ERRORS.ERROR;
            const rangeStr = args[0].trim();
            const type = args.length >= 2 ? evalArg(args[1]).toLowerCase() : 'line';
            const validTypes = ['line', 'bar', 'column'];
            const sparkType = validTypes.includes(type) ? type : 'line';
            const vals = resolveRange(rangeStr, getData, visited);
            if (vals.length === 0) return '';
            return `__SPARKLINE__:${sparkType}:${vals.join(',')}`;
        }
        default:
            return SHEET_ERRORS.NAME;
    }
}

function matchesCriteria(value: string, criteria: string): boolean {
    // Handle operator criteria like ">5", "<=10", "<>abc"
    const opMatch = criteria.match(/^(>=|<=|<>|!=|>|<|=)(.+)$/);
    if (opMatch) {
        const op = opMatch[1], target = opMatch[2];
        const numVal = Number(value), numTarget = Number(target);
        if (!isNaN(numVal) && !isNaN(numTarget)) {
            if (op === '>') return numVal > numTarget;
            if (op === '<') return numVal < numTarget;
            if (op === '>=') return numVal >= numTarget;
            if (op === '<=') return numVal <= numTarget;
            if (op === '=' || op === '==') return numVal === numTarget;
            if (op === '<>' || op === '!=') return numVal !== numTarget;
        }
        if (op === '=' || op === '==') return value === target;
        if (op === '<>' || op === '!=') return value !== target;
    }
    // Wildcard matching
    if (criteria.includes('*') || criteria.includes('?')) {
        const pattern = criteria.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(value);
    }
    // Exact match (case insensitive for text, exact for numbers)
    const numVal = Number(value), numCrit = Number(criteria);
    if (!isNaN(numVal) && !isNaN(numCrit)) return numVal === numCrit;
    return value.toLowerCase() === criteria.toLowerCase();
}

function countWithCriteria(values: string[], criteria: string): number {
    return values.filter(v => matchesCriteria(v, criteria)).length;
}

function evaluateMath(expr: string): string {
    if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
        // Could be a string result from a function
        if (expr.match(/^[A-Z]/)) return expr;
        return SHEET_ERRORS.VALUE;
    }
    try {
        if (/\/0(?!\.)/.test(expr.replace(/\s/g, ''))) return SHEET_ERRORS.DIV_ZERO;
        // eslint-disable-next-line no-new-func
        const result = new Function('return ' + expr)();
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return SHEET_ERRORS.VALUE;
        return Math.round(result * 10000000000) / 10000000000 + "";
    } catch {
        return SHEET_ERRORS.ERROR;
    }
}
