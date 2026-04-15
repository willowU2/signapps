/**
 * OfflineSyncQueue — V2-13: Push Notifications & Offline Sync foundation
 *
 * Generic queue for replaying HTTP mutations that were attempted while the
 * user was offline. Uses localStorage so the queue survives page reloads.
 * Automatically drains the queue when the browser comes back online.
 */

const STORAGE_KEY = "signapps_offline_queue";

export interface QueuedAction {
  /** Unique identifier for deduplication */
  id: string;
  /** ISO timestamp when the action was queued */
  queuedAt: string;
  /** Fetch-compatible URL (may be relative) */
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialisable request body */
  body?: unknown;
  /** Extra headers to forward (e.g. Content-Type, X-Workspace-ID) */
  headers?: Record<string, string>;
}

export class OfflineSyncQueue {
  private static instance: OfflineSyncQueue | null = null;

  /** Singleton — shares the queue across the whole app */
  static getInstance(): OfflineSyncQueue {
    if (!OfflineSyncQueue.instance) {
      OfflineSyncQueue.instance = new OfflineSyncQueue();
    }
    return OfflineSyncQueue.instance;
  }

  private constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.processQueue().catch((err) => {
          console.warn("[OfflineSyncQueue] Auto-process failed:", err);
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  private load(): QueuedAction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    } catch {
      return [];
    }
  }

  private save(queue: QueuedAction[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn("[OfflineSyncQueue] localStorage write failed:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Append a mutation to the persistent queue.
   * An `id` is auto-generated when not provided.
   */
  addToQueue(
    action: Omit<QueuedAction, "id" | "queuedAt"> & { id?: string },
  ): void {
    const queue = this.load();
    const entry: QueuedAction = {
      id: action.id ?? crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
      url: action.url,
      method: action.method,
      body: action.body,
      headers: action.headers,
    };
    queue.push(entry);
    this.save(queue);
  }

  /**
   * Replay all queued mutations in insertion order.
   * Successfully replayed actions are removed; failed ones stay for the next
   * attempt. Runs even if navigator.onLine is false (caller's responsibility).
   */
  async processQueue(): Promise<void> {
    const queue = this.load();
    if (queue.length === 0) return;

    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...action.headers,
          },
          body:
            action.body !== undefined ? JSON.stringify(action.body) : undefined,
        });

        if (!response.ok) {
          console.warn(
            `[OfflineSyncQueue] Replay failed for ${action.method} ${action.url}: HTTP ${response.status}`,
          );
          remaining.push(action);
        }
      } catch (err) {
        // Network still unavailable or transient error — keep in queue
        console.warn("[OfflineSyncQueue] Replay error, retaining action:", err);
        remaining.push(action);
      }
    }

    this.save(remaining);
  }

  /** Number of mutations currently waiting in the queue. */
  getQueueSize(): number {
    return this.load().length;
  }

  /** Remove all queued actions (e.g. on logout). */
  clearQueue(): void {
    this.save([]);
  }
}

/** Convenience singleton export */
export const offlineSyncQueue = OfflineSyncQueue.getInstance();
