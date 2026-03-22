declare global {
  interface Window {
    __signAppsAddConflict?: (conflict: unknown) => void;
  }
  var scheduler: { yield: () => Promise<void> } | undefined;
}
export {};
