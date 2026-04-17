import { create } from "zustand";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface NexusEntity {
  id: string;
  name: string;
  semantic_distance?: number;
}

interface NexusState {
  entities: NexusEntity[];
  provider: WebsocketProvider | null;
  connect: (tenantId: string) => void;
  disconnect: () => void;
  addEntity: (name: string) => void;
}

// Yjs Doc holds the shared state
const ydoc = new Y.Doc();
const yentities = ydoc.getArray<NexusEntity>("entities");

export const useNexusStore = create<NexusState>((set, get) => ({
  entities: [],
  provider: null,

  connect: (tenantId: string) => {
    if (get().provider) return;

    // In a real scenario, port would map to signapps-nexus (3021)
    const wsUrl = `ws://localhost:3021/api/v1/nexus/sync?tenant=${tenantId}`;
    const provider = new WebsocketProvider(wsUrl, "nexus-room", ydoc);

    provider.on("status", (event: { status: string }) => {
      // eslint-disable-next-line no-console -- WS status is a diagnostic
      console.log("Nexus WS status:", event.status);
    });

    // Sync Yjs array changes to Zustand state
    yentities.observe(() => {
      set({ entities: yentities.toArray() });
    });

    set({ provider });
  },

  disconnect: () => {
    const { provider } = get();
    if (provider) {
      provider.disconnect();
      set({ provider: null });
    }
  },

  addEntity: (name: string) => {
    const newEntity: NexusEntity = {
      id: crypto.randomUUID(),
      name,
      semantic_distance: Math.random(), // Mock semantic distance
    };
    yentities.push([newEntity]);
  },
}));
