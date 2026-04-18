"use client";

/**
 * Main-thread client for the formula math worker.
 *
 * The worker handles the final arithmetic evaluation in a sandboxed
 * context using a pure recursive-descent parser (no dynamic code exec).
 * Main-thread callers can use this for background recalc; the sync
 * `evaluateFormula` path in `lib/sheets/formula.ts` still works without
 * the worker thanks to an identical pure parser, so moving callers to
 * async is optional future work.
 */

type EvalRequest = {
  id: string;
  expr: string;
  context: Record<string, unknown>;
};
type EvalResponse =
  | { id: string; ok: true; value: unknown }
  | { id: string; ok: false; error: string };

const pending = new Map<string, (res: EvalResponse) => void>();
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/formula.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener("message", (ev: MessageEvent<EvalResponse>) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    });
    worker.addEventListener("error", (err) => {
      console.error("[formula-worker] crash, respawning", err);
      worker?.terminate();
      worker = null;
      for (const [, cb] of pending) {
        cb({ id: "", ok: false, error: "worker crashed" });
      }
      pending.clear();
    });
  }
  return worker;
}

/**
 * Evaluate a sanitized math expression off the main thread.
 *
 * The worker applies the same sanitization and length guards as the
 * sync main-thread fallback, so callers do not need to pre-validate.
 * Rejects after 5s to avoid hanging on a stuck worker.
 */
export async function evaluateFormula(
  expr: string,
  context: Record<string, unknown> = {},
): Promise<unknown> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(`formula evaluation timeout (5s): ${expr.slice(0, 80)}`),
      );
    }, 5_000);
    pending.set(id, (res) => {
      clearTimeout(timer);
      if (res.ok) resolve(res.value);
      else reject(new Error(res.error));
    });
    const req: EvalRequest = { id, expr, context };
    getWorker().postMessage(req);
  });
}
