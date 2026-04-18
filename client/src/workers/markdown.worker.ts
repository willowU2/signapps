/// <reference lib="webworker" />

/**
 * Markdown conversion worker.
 *
 * Offloads the turndown HTML-to-Markdown conversion off the main thread.
 * The work is purely CPU-bound (regex + DOM-ish walk) and can run in the
 * background without blocking UI rendering.
 */

import TurndownService from "turndown";

type Request = {
  id: string;
  html: string;
  options?: TurndownService.Options;
};
type Response =
  | { id: string; ok: true; md: string }
  | { id: string; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

const service = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

service.addRule("strikethrough", {
  filter: ["del", "s"] as (keyof HTMLElementTagNameMap)[],
  replacement: (content) => `~~${content}~~`,
});

service.addRule("highlight", {
  filter: "mark",
  replacement: (content) => `==${content}==`,
});

self.addEventListener("message", (ev: MessageEvent<Request>) => {
  const { id, html, options } = ev.data;
  try {
    if (options) {
      Object.assign(service.options, options);
    }
    const md = service.turndown(html);
    self.postMessage({ id, ok: true, md } satisfies Response);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies Response);
  }
});
