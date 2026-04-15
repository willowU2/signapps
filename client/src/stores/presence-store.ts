import { create } from "zustand";

export interface UserPresence {
  userId: string;
  username: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    anchor?: number;
    head?: number;
  };
  lastActive: number;
  isOnline: boolean;
}

interface PresenceState {
  // Current user info
  currentUserId: string | null;
  currentUsername: string | null;
  currentColor: string;

  // All users in the document
  users: Map<string, UserPresence>;

  // Connection state
  isConnecté: boolean;
  isSynced: boolean;
  connectionStatus:
    | "connecting"
    | "connected"
    | "disconnected"
    | "reconnecting";

  // Offline queue
  pendingChanges: number;
}

interface PresenceActions {
  // User management
  setCurrentUser: (userId: string, username: string) => void;
  setCurrentColor: (color: string) => void;

  // Presence updates
  updateUserPresence: (userId: string, presence: Partial<UserPresence>) => void;
  removeUser: (userId: string) => void;
  clearInactiveUsers: (timeoutMs: number) => void;

  // Connection state
  setConnecté: (isConnecté: boolean) => void;
  setSynced: (isSynced: boolean) => void;
  setConnectionStatus: (status: PresenceState["connectionStatus"]) => void;

  // Offline queue
  incrementPendingChanges: () => void;
  clearPendingChanges: () => void;

  // Helpers
  getOnlineUsers: () => UserPresence[];
  getUserColor: (userId: string) => string;
}

// Generate a random color for a user
function generateUserColor(): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEAA7", // Yellow
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#F7DC6F", // Gold
    "#BB8FCE", // Purple
    "#85C1E9", // Light Blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export const usePresenceStore = create<PresenceState & PresenceActions>(
  (set, get) => ({
    // Initial state
    currentUserId: null,
    currentUsername: null,
    currentColor: generateUserColor(),
    users: new Map(),
    isConnecté: false,
    isSynced: false,
    connectionStatus: "disconnected",
    pendingChanges: 0,

    // User management
    setCurrentUser: (userId, username) => {
      set({ currentUserId: userId, currentUsername: username });
    },

    setCurrentColor: (color) => {
      set({ currentColor: color });
    },

    // Presence updates
    updateUserPresence: (userId, presence) => {
      const users = new Map(get().users);
      const existing = users.get(userId) || {
        userId,
        username: presence.username || "Anonymous",
        color: presence.color || generateUserColor(),
        lastActive: Date.now(),
        isOnline: true,
      };
      users.set(userId, {
        ...existing,
        ...presence,
        lastActive: Date.now(),
      });
      set({ users });
    },

    removeUser: (userId) => {
      const users = new Map(get().users);
      users.delete(userId);
      set({ users });
    },

    clearInactiveUsers: (timeoutMs) => {
      const users = new Map(get().users);
      const now = Date.now();
      let changed = false;

      users.forEach((user, id) => {
        if (now - user.lastActive > timeoutMs) {
          users.delete(id);
          changed = true;
        }
      });

      if (changed) {
        set({ users });
      }
    },

    // Connection state
    setConnecté: (isConnecté) => {
      set({
        isConnecté,
        connectionStatus: isConnecté ? "connected" : "disconnected",
      });
    },

    setSynced: (isSynced) => {
      set({ isSynced });
    },

    setConnectionStatus: (status) => {
      set({
        connectionStatus: status,
        isConnecté: status === "connected",
      });
    },

    // Offline queue
    incrementPendingChanges: () => {
      set((state) => ({ pendingChanges: state.pendingChanges + 1 }));
    },

    clearPendingChanges: () => {
      set({ pendingChanges: 0 });
    },

    // Helpers
    getOnlineUsers: () => {
      return Array.from(get().users.values()).filter((u) => u.isOnline);
    },

    getUserColor: (userId) => {
      const user = get().users.get(userId);
      return user?.color || generateUserColor();
    },
  }),
);
