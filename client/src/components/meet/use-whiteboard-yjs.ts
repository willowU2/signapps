"use client";

import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  createTLStore,
  defaultShapeUtils,
  defaultBindingUtils,
  type TLRecord,
  type TLStore,
} from "tldraw";

import { COLLAB_WS_URL } from "@/lib/api/core";

/**
 * Connection status surfaced to the UI.
 */
export type WhiteboardStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "offline";

/**
 * Bind a tldraw store to a Yjs document shared over
 * `signapps-collaboration` (port 3013). tldraw v4 does not ship a
 * yjs adapter, so we mirror records into a single `Y.Map<TLRecord>`:
 *
 *   - tldraw store → Y.Map: local changes are iterated and written.
 *   - Y.Map → tldraw store: observer replays additions / removals /
 *     field updates inside a `history.ignore`-like `mergeRemoteChanges`
 *     to avoid feedback loops.
 *
 * The binding is best-effort last-writer-wins per record — sufficient
 * for the in-call whiteboard use-case. Offline/local-only when the
 * WebSocket is not reachable.
 */
export function useYjsStoreWhiteboard(roomCode: string): {
  store: TLStore;
  status: WhiteboardStatus;
} {
  const [status, setStatus] = useState<WhiteboardStatus>("connecting");

  const { store, doc, provider } = useMemo(() => {
    const yDoc = new Y.Doc();

    // Same route pattern used by the standalone Whiteboard module
    // (see `components/whiteboard/whiteboard-page.tsx`).
    const baseWs = COLLAB_WS_URL.replace(/\/+$/, "");
    const wsUrl = `${baseWs}/api/v1/collab/ws/meet-whiteboard-${roomCode}`;

    let wsProvider: WebsocketProvider | null = null;
    try {
      wsProvider = new WebsocketProvider(
        wsUrl,
        `meet-whiteboard-${roomCode}`,
        yDoc,
        { connect: true },
      );
    } catch {
      // Falls through with a null provider — store becomes local-only.
    }

    const tlStore = createTLStore({
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
    });

    return { store: tlStore, doc: yDoc, provider: wsProvider };
  }, [roomCode]);

  // ── Yjs ↔ tldraw sync ────────────────────────────────────────────
  useEffect(() => {
    const yRecords = doc.getMap<TLRecord>("tldraw-records");

    // Initial hydrate: apply any pre-existing remote records into the
    // tldraw store. When it's empty, take the store's current records
    // and push them into Yjs so a peer joining later receives them.
    const hydrate = () => {
      if (yRecords.size === 0) {
        const snapshot = store.allRecords();
        if (snapshot.length > 0) {
          doc.transact(() => {
            for (const record of snapshot) {
              yRecords.set(record.id, record);
            }
          }, "local");
        }
      } else {
        const remoteRecords: TLRecord[] = [];
        yRecords.forEach((rec) => remoteRecords.push(rec));
        if (remoteRecords.length > 0) {
          store.mergeRemoteChanges(() => {
            store.put(remoteRecords);
          });
        }
      }
    };

    hydrate();

    // ── Local → Yjs ────────────────────────────────────────────────
    const storeListenerUnsub = store.listen(
      ({ changes, source }) => {
        if (source !== "user") return;
        doc.transact(() => {
          for (const record of Object.values(changes.added)) {
            yRecords.set(record.id, record);
          }
          for (const [, after] of Object.values(changes.updated)) {
            yRecords.set(after.id, after);
          }
          for (const record of Object.values(changes.removed)) {
            yRecords.delete(record.id);
          }
        }, "local");
      },
      { source: "user", scope: "document" },
    );

    // ── Yjs → Local ────────────────────────────────────────────────
    const yObserver = (event: Y.YMapEvent<TLRecord>, txn: Y.Transaction) => {
      // Skip our own writes (origin === "local").
      if (txn.origin === "local") return;
      const toPut: TLRecord[] = [];
      const toRemove: TLRecord["id"][] = [];
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          toRemove.push(key as TLRecord["id"]);
        } else {
          const rec = yRecords.get(key);
          if (rec) toPut.push(rec);
        }
      });
      store.mergeRemoteChanges(() => {
        if (toRemove.length > 0) store.remove(toRemove);
        if (toPut.length > 0) store.put(toPut);
      });
    };
    yRecords.observe(yObserver);

    return () => {
      storeListenerUnsub();
      yRecords.unobserve(yObserver);
    };
  }, [doc, store]);

  // ── Provider status plumbing ─────────────────────────────────────
  useEffect(() => {
    if (!provider) {
      setStatus("offline");
      return;
    }
    const onStatus = ({ status: s }: { status: string }) => {
      if (s === "connected") setStatus("connected");
      else if (s === "connecting") setStatus("connecting");
      else setStatus("disconnected");
    };
    provider.on("status", onStatus);
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      provider?.disconnect();
      provider?.destroy();
      doc.destroy();
      store.dispose();
    };
  }, [provider, doc, store]);

  return { store, status };
}
