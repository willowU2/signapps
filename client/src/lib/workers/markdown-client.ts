"use client";

/**
 * Main-thread client for the markdown conversion worker.
 *
 * Exposes an async `htmlToMarkdown` that mirrors the original
 * `lib/markdown.ts` helper, but performs the turndown work in a
 * background Web Worker so the editor keeps typing responsive on
 * large HTML payloads.
 */

type Request = { id: string; html: string; options?: unknown };
type Response =
  | { id: string; ok: true; md: string }
  | { id: string; ok: false; error: string };

const pending = new Map<string, (res: Response) => void>();
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/markdown.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener("message", (ev: MessageEvent<Response>) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    });
    worker.addEventListener("error", (err) => {
      console.error("[markdown-worker] crash, respawning", err);
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
 * Convert HTML to Markdown in a Web Worker. Reject after 5s to avoid
 * hanging on a stuck worker.
 */
export async function htmlToMarkdown(
  html: string,
  options?: unknown,
): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("markdown conversion timeout (5s)"));
    }, 5_000);
    pending.set(id, (res) => {
      clearTimeout(timer);
      if (res.ok) resolve(res.md);
      else reject(new Error(res.error));
    });
    const req: Request = { id, html, options };
    getWorker().postMessage(req);
  });
}
