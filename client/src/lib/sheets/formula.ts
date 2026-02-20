// Refined formula evaluation engine for Spreadsheets
// Supports basic math, cell references (A1), ranges (A1:B5), and standard functions (SUM, AVERAGE, etc.)

type CellValueGetter = (r: number, c: number) => string;

// Standard spreadsheet errors
export const SHEET_ERRORS = {
    REF: '#REF!',
    NAME: '#NAME?',
    DIV_ZERO: '#DIV/0!',
    VALUE: '#VALUE!',
    ERROR: '#ERROR!',
    CYCLE: '#CYCLE!'
};

// Represents a parsed cell reference 
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
        // If it looks like a number, return as is (trimmed), else return the string
        const num = Number(formula);
        return isNaN(num) ? formula : num.toString();
    }

    // Check for circular dependencies
    const cellId = currentCell ? `${currentCell.r},${currentCell.c}` : 'unknown';
    if (visited.has(cellId)) {
        return SHEET_ERRORS.CYCLE;
    }

    // Create a new set for this evaluation path
    const newVisited = new Set(visited);
    if (currentCell) newVisited.add(cellId);

    try {
        let expression = formula.substring(1).toUpperCase().trim();

        // 1. Process Functions
        expression = processFunctions(expression, getData, newVisited);
        if (Object.values(SHEET_ERRORS).includes(expression)) return expression;

        // 2. Process Cell References (e.g., A1, B22)
        expression = processCellReferences(expression, getData, newVisited);
        if (Object.values(SHEET_ERRORS).includes(expression)) return expression;

        // 3. Evaluate the remaining mathematical expression
        return evaluateMath(expression);

    } catch (e) {
        return SHEET_ERRORS.ERROR;
    }
}

// Convert column letter to index (A -> 0, Z -> 25)
export function colToIndex(colStr: string): number {
    let index = 0;
    for (let i = 0; i < colStr.length; i++) {
        index = index * 26 + colStr.charCodeAt(i) - 64;
    }
    return index - 1;
}

// Convert index to column letter (0 -> A, 25 -> Z)
export function indexToCol(index: number): string {
    let temp, letter = '';
    while (index >= 0) {
        temp = index % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = (index - temp - 1) / 26;
    }
    return letter;
}

// Parse "A1" into { row: 0, col: 0 }
function parseCellRef(ref: string): CellRef | null {
    const match = ref.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    return {
        col: colToIndex(match[1]),
        row: parseInt(match[2]) - 1
    };
}

// Resolve a range like "A1:B3" into an array of values
function resolveRange(rangeStr: string, getData: CellValueGetter, visited: Set<string>): number[] {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [];

    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);

    if (!start || !end) return [];

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const values: number[] = [];

    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const rawVal = getData(r, c);
            if (rawVal) {
                // If the referenced cell has a formula, evaluate it recursively
                let evaluated = rawVal;
                if (rawVal.startsWith('=')) {
                    evaluated = evaluateFormula(rawVal, getData, { r, c }, visited);
                }
                const num = Number(evaluated);
                if (!isNaN(num)) values.push(num);
            }
        }
    }

    return values;
}

// Replaces function calls like SUM(A1:B3) with their computed values
function processFunctions(expr: string, getData: CellValueGetter, visited: Set<string>): string {
    const fnRegex = /(SUM|AVERAGE|AVG|COUNT|MAX|MIN)\(([^)]+)\)/g;

    return expr.replace(fnRegex, (match, fnName, argsStr) => {
        // Split arguments by comma
        const args = argsStr.split(',').map((a: string) => a.trim());
        let values: number[] = [];

        for (const arg of args) {
            // Check if it's a range (A1:B5)
            if (arg.includes(':')) {
                values = values.concat(resolveRange(arg, getData, visited));
            }
            // Or a single cell/number
            else {
                const cellRef = parseCellRef(arg);
                if (cellRef) {
                    const rawVal = getData(cellRef.row, cellRef.col);
                    if (rawVal) {
                        let evaluated = rawVal;
                        if (rawVal.startsWith('=')) {
                            evaluated = evaluateFormula(rawVal, getData, { r: cellRef.row, c: cellRef.col }, visited);
                            if (Object.values(SHEET_ERRORS).includes(evaluated)) return evaluated; // Propagate error
                        }
                        const num = Number(evaluated);
                        if (!isNaN(num)) values.push(num);
                    }
                } else {
                    const num = Number(arg);
                    if (!isNaN(num)) values.push(num);
                }
            }
        }

        // Apply function
        switch (fnName) {
            case 'SUM':
                return values.reduce((a, b) => a + b, 0).toString();
            case 'AVERAGE':
            case 'AVG':
                if (values.length === 0) return SHEET_ERRORS.DIV_ZERO;
                return (values.reduce((a, b) => a + b, 0) / values.length).toString();
            case 'COUNT':
                return values.length.toString();
            case 'MAX':
                if (values.length === 0) return "0";
                return Math.max(...values).toString();
            case 'MIN':
                if (values.length === 0) return "0";
                return Math.min(...values).toString();
            default:
                return SHEET_ERRORS.NAME;
        }
    });
}

// Replaces bare cell references like "A1" with their evaluated values
function processCellReferences(expr: string, getData: CellValueGetter, visited: Set<string>): string {
    // Regex matches A1 but negative lookahead to prevent matching inside already replaced functions
    // (though functions are processed first so shouldn't be an issue if they return numbers)
    const cellRegex = /([A-Z]+)([0-9]+)/g;

    return expr.replace(cellRegex, (match, colStr, rowStr) => {
        const c = colToIndex(colStr);
        const r = parseInt(rowStr) - 1;
        const rawVal = getData(r, c) || "";

        let evaluated = rawVal;
        if (rawVal.startsWith('=')) {
            evaluated = evaluateFormula(rawVal, getData, { r, c }, visited);
        }

        if (Object.values(SHEET_ERRORS).includes(evaluated)) return evaluated;

        // If the cell is empty or text, treat as 0 for math, unless it's just meant as a string (handling strings in basic eval is tricky)
        const num = Number(evaluated);
        return isNaN(num) ? '0' : num.toString();
    });
}

// Safely evaluates a basic math string
function evaluateMath(expr: string): string {
    // Sanitize: allow digits, decimal points, basic operators, parens, spaces, and negative signs
    if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
        return SHEET_ERRORS.VALUE;
    }

    try {
        // Prevent division by zero
        if (expr.includes('/0') || expr.includes('/ 0')) {
            // We need slightly smarter checking because 10/0.5 is valid, but let's catch strict /0
            if (/\/0(?!\.)/.test(expr.replace(/\s/g, ''))) return SHEET_ERRORS.DIV_ZERO;
        }

        // Function constructor is safer than direct eval()
        // eslint-disable-next-line no-new-func
        const result = new Function('return ' + expr)();

        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            return SHEET_ERRORS.VALUE;
        }

        // Round to avoid floating point precision issues (e.g., 0.1 + 0.2)
        return Math.round(result * 10000000000) / 10000000000 + "";
    } catch (e) {
        return SHEET_ERRORS.ERROR;
    }
}
