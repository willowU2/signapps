/**
 * Type stubs for optional dependencies that are not installed in the
 * default build. These modules are imported by feature code (whiteboard,
 * virtual-background) that only runs when the package is present at
 * runtime. The stubs prevent tsc --noEmit from failing on unresolved
 * modules while keeping the import structure for when the packages ARE
 * installed in a full build.
 */

declare module "tldraw" {
  export const Tldraw: React.ComponentType<Record<string, unknown>>;

  export interface TLRecord {
    id: string;
    [key: string]: unknown;
  }

  export interface TLStoreChanges {
    added: Record<string, TLRecord>;
    updated: Record<string, [TLRecord, TLRecord]>;
    removed: Record<string, TLRecord>;
  }

  export interface TLStore {
    listen: (
      callback: (entry: { changes: TLStoreChanges; source: string }) => void,
      opts?: { source?: string; scope?: string },
    ) => () => void;
    mergeRemoteChanges: (callback: () => void) => void;
    put: (records: TLRecord[]) => void;
    remove: (ids: string[]) => void;
    clear: () => void;
    allRecords: () => TLRecord[];
    dispose: () => void;
  }

  export type TLStoreWithStatus =
    | { status: "loading" }
    | { status: "synced-remote"; store: TLStore }
    | { status: "not-synced"; store: TLStore }
    | { status: "error"; error: string };

  export function createTLStore(opts?: {
    shapeUtils?: unknown[] | (() => unknown[]);
    bindingUtils?: unknown[] | (() => unknown[]);
  }): TLStore;
  export function defaultShapeUtils(): unknown[];
  export function defaultBindingUtils(): unknown[];
}

declare module "@mediapipe/selfie_segmentation" {
  export class SelfieSegmentation {
    constructor(config?: { locateFile?: (file: string) => string });
    setOptions(options: Record<string, unknown>): void;
    onResults(
      callback: (results: { segmentationMask: CanvasImageSource }) => void,
    ): void;
    send(input: { image: HTMLVideoElement }): Promise<void>;
    close(): void;
  }
}
