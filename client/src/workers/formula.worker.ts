/// <reference lib="webworker" />

/**
 * Formula math evaluator worker.
 *
 * The sheets formula evaluator delegates the final arithmetic expression
 * (after cell refs and functions have been resolved to numeric literals)
 * to this worker. The worker runs a pure recursive-descent parser over
 * the sanitized expression, no dynamic code execution, so the main
 * thread CSP no longer needs `'unsafe-eval'`.
 *
 * The main thread also exposes a synchronous fallback parser with the
 * same semantics in `formula.ts::evaluateMath` so the existing sync
 * useEffect recalculation loop keeps working without an async cascade.
 * The worker remains available for future off-main-thread recalc.
 */

export {};

type EvalRequest = {
  id: string;
  expr: string;
  context: Record<string, unknown>;
};
type EvalResponse =
  | { id: string; ok: true; value: unknown }
  | { id: string; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

const SHEET_ERRORS = {
  VALUE: "#VALUE!",
  DIV_ZERO: "#DIV/0!",
  ERROR: "#ERROR!",
};

self.addEventListener("message", (ev: MessageEvent<EvalRequest>) => {
  const { id, expr } = ev.data;
  try {
    const value = evaluateMathPure(expr);
    self.postMessage({ id, ok: true, value } satisfies EvalResponse);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies EvalResponse);
  }
});

/**
 * Pure recursive-descent evaluator for the sanitized math subset
 * (digits, plus, minus, star, slash, parens, dot, whitespace).
 * Mirrors the length guard and identifier rejection rules applied on
 * the main thread. Returns a stringified number, or a `SHEET_ERRORS.*`
 * sentinel on failure.
 */
function evaluateMathPure(expr: string): string {
  // Preserve ISO date strings that happen to contain dashes.
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/.test(expr)) {
    return expr;
  }

  if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
    if (expr.match(/^[A-Z]/i)) return expr;
    return SHEET_ERRORS.VALUE;
  }

  const sanitized = expr.replace(/\s/g, "");
  if (sanitized.length === 0) return "";
  if (sanitized.length > 200) return SHEET_ERRORS.VALUE;
  if (/[a-zA-Z_$]/.test(sanitized)) return SHEET_ERRORS.VALUE;
  if (/\/0(?!\.)/.test(sanitized)) return SHEET_ERRORS.DIV_ZERO;

  try {
    const parser = new MathParser(sanitized);
    const result = parser.parse();
    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      return SHEET_ERRORS.VALUE;
    }
    return Math.round(result * 10_000_000_000) / 10_000_000_000 + "";
  } catch {
    return SHEET_ERRORS.ERROR;
  }
}

/**
 * Recursive-descent parser for the grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := '-' factor | '(' expr ')' | number
 *
 * Accepts unary minus/plus. No identifiers, no calls, no dynamic exec.
 */
class MathParser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpr();
    if (this.pos !== this.input.length)
      throw new Error("unexpected trailing input");
    return value;
  }

  private parseExpr(): number {
    let left = this.parseTerm();
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op !== "+" && op !== "-") break;
      this.pos++;
      const right = this.parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.pos < this.input.length) {
      const op = this.input[this.pos];
      if (op !== "*" && op !== "/") break;
      this.pos++;
      const right = this.parseFactor();
      if (op === "*") left = left * right;
      else {
        if (right === 0) throw new Error("division by zero");
        left = left / right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    const ch = this.input[this.pos];
    if (ch === "+") {
      this.pos++;
      return this.parseFactor();
    }
    if (ch === "-") {
      this.pos++;
      return -this.parseFactor();
    }
    if (ch === "(") {
      this.pos++;
      const value = this.parseExpr();
      if (this.input[this.pos] !== ")") throw new Error("expected ')'");
      this.pos++;
      return value;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.pos;
    let hasDigit = false;
    while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
      this.pos++;
      hasDigit = true;
    }
    if (this.pos < this.input.length && this.input[this.pos] === ".") {
      this.pos++;
      while (
        this.pos < this.input.length &&
        /[0-9]/.test(this.input[this.pos])
      ) {
        this.pos++;
        hasDigit = true;
      }
    }
    if (!hasDigit) throw new Error("expected number");
    return parseFloat(this.input.slice(start, this.pos));
  }
}
