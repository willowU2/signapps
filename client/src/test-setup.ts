/**
 * Vitest global setup — Phase F2.
 *
 * Extends Vitest's `expect` with @testing-library/jest-dom matchers
 * (toBeInTheDocument, toHaveClass, etc.).
 *
 * Also installs a minimal localStorage polyfill so zustand's `persist`
 * middleware can initialize stores in tests — happy-dom provides
 * Window.localStorage but some zustand init paths receive a stripped
 * handle where setItem is missing.
 */
import "@testing-library/jest-dom/vitest";

if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.setItem !== "function"
) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
