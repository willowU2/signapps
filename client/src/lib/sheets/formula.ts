
export function evaluateFormula(formula: string, getData: (r: number, c: number) => string): string {
    if (!formula.startsWith('=')) return formula

    const expression = formula.substring(1).toUpperCase()

    // 1. Resolve Cell References (A1, B2) -> Values
    // Regex for [A-Z]+[0-9]+
    const resolved = expression.replace(/([A-Z]+)([0-9]+)/g, (match, colStr, rowStr) => {
        const c = colToIndex(colStr)
        const r = parseInt(rowStr) - 1
        return getData(r, c) || "0"
    })

    // 2. Evaluate math
    // VERY BASIC evaluation using Function constructor (eval alternative)
    // In production, use a proper expression parser library like 'mathjs' or 'hyperformula'
    try {
        // Sanitize: allow only digits, operators, parens, and decimal points
        if (!/^[0-9+\-*/().\s]*$/.test(resolved)) {
            return "#ERR"
        }
        // eslint-disable-next-line no-new-func
        return new Function('return ' + resolved)()
    } catch (e) {
        return "#ERROR"
    }
}

function colToIndex(colStr: string): number {
    let index = 0
    for (let i = 0; i < colStr.length; i++) {
        index = index * 26 + colStr.charCodeAt(i) - 64
    }
    return index - 1
}
