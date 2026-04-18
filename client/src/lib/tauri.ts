/**
 * Tauri detection + lazy-import helpers.
 *
 * When the app runs in a browser tab (no Tauri context), the IPC /
 * invoke modules are never loaded — they would otherwise add ~80-120 kB
 * gzipped to the main bundle for every browser user, even though they
 * can only do anything useful inside the Tauri shell.
 *
 * # Examples
 *
 * ```ts
 * import { tauriCore, isTauri } from "@/lib/tauri";
 *
 * if (isTauri()) {
 *   const core = await tauriCore();
 *   await core?.invoke("my_rust_command", { payload });
 * }
 * ```
 *
 * # Errors
 *
 * Never throws — returns `null` for the lazy getters when the page is
 * not running inside a Tauri shell.
 */

/**
 * Returns `true` iff the current page runs inside a Tauri shell
 * (webview2 on Windows, WKWebView on macOS, etc.).  Safe to call from
 * SSR — returns `false` when `window` is undefined.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * Lazy-imports `@tauri-apps/api/core` only when running inside a Tauri
 * shell.  Returns `null` in a regular browser tab so the dynamic import
 * is dead-code-eliminated by the bundler for the browser entry point.
 */
export async function tauriCore(): Promise<
  typeof import("@tauri-apps/api/core") | null
> {
  if (!isTauri()) return null;
  return import("@tauri-apps/api/core");
}

/**
 * Lazy-imports `@tauri-apps/plugin-shell` only when running inside a
 * Tauri shell.  Returns `null` in a regular browser tab.
 */
export async function tauriShell(): Promise<
  typeof import("@tauri-apps/plugin-shell") | null
> {
  if (!isTauri()) return null;
  return import("@tauri-apps/plugin-shell");
}
