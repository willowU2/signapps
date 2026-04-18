"use client";

/**
 * Filters expected library warnings out of the browser dev console.
 *
 * Some third-party libraries log noisy errors for situations that are
 * already handled gracefully on our side.  We silence exactly the
 * known-benign patterns — nothing else.  The filter is only installed
 * once per page load.
 *
 * Current filters:
 *
 * 1. `[lucide-react]: Name in Lucide DynamicIcon not found`
 *    — We pass `fallback={<Grid />}` on every call site and pre-validate
 *      the name shape with `LUCIDE_NAME_RE`.  Lucide still logs an error
 *      before invoking the fallback, which spams the console whenever
 *      the user has pinned apps with custom icon strings.
 */

const BENIGN_PATTERNS: RegExp[] = [
  /\[lucide-react\]:\s*Name in Lucide DynamicIcon not found/i,
];

let installed = false;

export function installConsoleFilter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (
      args.length > 0 &&
      typeof args[0] === "string" &&
      BENIGN_PATTERNS.some((re) => re.test(args[0] as string))
    ) {
      return;
    }
    original.apply(console, args);
  };
}
