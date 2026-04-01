import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { COLLAB_ENABLED, COLLAB_WS_URL } from "@/lib/api/core";

export function useSlideObjects(docId: string, slideId: string) {
  const [objects, setObjects] = useState<Record<string, any>>({});

  useEffect(() => {
    // Minimal connection logic, reusing the same Y.Doc instance natively
    // wouldn't easily be done here without Context, so we re-connect or
    // expect the browser to multiplex WebSocket connections to the same room.
    // For performance in a real app, a Y.Doc Provider Context should wrap the whole app.

    const doc = new Y.Doc();
    // RT1: Connect Slides objects to signapps-collab (port 3013)
    const collabServerEnabled = COLLAB_ENABLED;
    const baseWsUrl = COLLAB_WS_URL;
    const wsUrl = `${baseWsUrl}/api/v1/collab/ws/${docId}`;
    const provider = new WebsocketProvider(wsUrl, docId, doc, {
      connect: false,
    });

    // Only attempt to connect if collaboration server is explicitly enabled
    if (collabServerEnabled) {
      provider.connect();
    }

    const slideObjectsMap = doc.getMap<string>(`objects-${slideId}`);

    const updateObjectsHandler = () => {
      const newObj: Record<string, any> = {};
      slideObjectsMap.forEach((json, key) => {
        try {
          newObj[key] = JSON.parse(json);
        } catch (e) {
          // silently ignore parse errors
        }
      });
      setObjects(newObj);
    };

    slideObjectsMap.observe(updateObjectsHandler);

    // Wait for sync to complete before first paint if possible
    provider.on("sync", (isSynced: boolean) => {
      if (isSynced) updateObjectsHandler();
    });

    return () => {
      slideObjectsMap.unobserve(updateObjectsHandler);
      provider.destroy();
      doc.destroy();
    };
  }, [docId, slideId]);

  return objects;
}
