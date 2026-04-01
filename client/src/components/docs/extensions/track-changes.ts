import { Mark as TiptapMark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Mark as PMMark } from "@tiptap/pm/model";

export type ChangeType = "insertion" | "deletion" | "format";

export interface TrackChange {
  id: string;
  type: ChangeType;
  author: string;
  authorId: string;
  timestamp: string;
  originalContent?: string;
  newContent?: string;
  formatChanges?: Record<string, { from: unknown; to: unknown }>;
  accepted?: boolean;
  rejected?: boolean;
}

export interface TrackChangesOptions {
  HTMLAttributes: Record<string, unknown>;
  enabled: boolean;
  currentUser: {
    id: string;
    name: string;
  };
  onChangeDetected?: (change: TrackChange) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trackChanges: {
      /**
       * Enable track changes mode
       */
      enableTrackChanges: () => ReturnType;
      /**
       * Disable track changes mode
       */
      disableTrackChanges: () => ReturnType;
      /**
       * Accept a change
       */
      acceptChange: (changeId: string) => ReturnType;
      /**
       * Reject a change
       */
      rejectChange: (changeId: string) => ReturnType;
      /**
       * Accept all changes
       */
      acceptAllChanges: () => ReturnType;
      /**
       * Reject all changes
       */
      rejectAllChanges: () => ReturnType;
    };
  }
}

export const trackChangesPluginKey = new PluginKey("trackChanges");

/**
 * Insertion mark - used to mark added text
 */
export const Insertion = TiptapMark.create({
  name: "insertion",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      changeId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-change-id"),
        renderHTML: (attributes) => {
          if (!attributes.changeId) return {};
          return { "data-change-id": attributes.changeId };
        },
      },
      author: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author"),
        renderHTML: (attributes) => {
          if (!attributes.author) return {};
          return { "data-author": attributes.author };
        },
      },
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-id"),
        renderHTML: (attributes) => {
          if (!attributes.authorId) return {};
          return { "data-author-id": attributes.authorId };
        },
      },
      timestamp: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-timestamp"),
        renderHTML: (attributes) => {
          if (!attributes.timestamp) return {};
          return { "data-timestamp": attributes.timestamp };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "ins[data-change-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ins",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "track-insertion",
      }),
      0,
    ];
  },
});

/**
 * Deletion mark - used to mark removed text (shown as strikethrough)
 */
export const Deletion = TiptapMark.create({
  name: "deletion",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      changeId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-change-id"),
        renderHTML: (attributes) => {
          if (!attributes.changeId) return {};
          return { "data-change-id": attributes.changeId };
        },
      },
      author: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author"),
        renderHTML: (attributes) => {
          if (!attributes.author) return {};
          return { "data-author": attributes.author };
        },
      },
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-author-id"),
        renderHTML: (attributes) => {
          if (!attributes.authorId) return {};
          return { "data-author-id": attributes.authorId };
        },
      },
      timestamp: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-timestamp"),
        renderHTML: (attributes) => {
          if (!attributes.timestamp) return {};
          return { "data-timestamp": attributes.timestamp };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "del[data-change-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "del",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "track-deletion",
      }),
      0,
    ];
  },
});

/**
 * TrackChanges extension - manages track changes mode
 */
export const TrackChanges = TiptapMark.create<TrackChangesOptions>({
  name: "trackChanges",

  addOptions() {
    return {
      HTMLAttributes: {},
      enabled: false,
      currentUser: {
        id: "unknown",
        name: "Unknown",
      },
      onChangeDetected: undefined,
    };
  },

  addStorage() {
    return {
      enabled: this.options.enabled,
      changes: [] as TrackChange[],
    };
  },

  addCommands() {
    return {
      enableTrackChanges:
        () =>
        ({ editor }) => {
          (editor.storage as Record<string, any>).trackChanges.enabled = true;
          return true;
        },
      disableTrackChanges:
        () =>
        ({ editor }) => {
          (editor.storage as Record<string, any>).trackChanges.enabled = false;
          return true;
        },
      acceptChange:
        (changeId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (!node.isText) return;

            // Find insertion marks to keep
            const insertionMark = node.marks.find(
              (mark) =>
                mark.type.name === "insertion" &&
                mark.attrs.changeId === changeId,
            );
            if (insertionMark) {
              tr.removeMark(pos, pos + node.nodeSize, insertionMark);
              modified = true;
            }

            // Find deletion marks to remove content
            const deletionMark = node.marks.find(
              (mark) =>
                mark.type.name === "deletion" &&
                mark.attrs.changeId === changeId,
            );
            if (deletionMark) {
              tr.delete(pos, pos + node.nodeSize);
              modified = true;
            }
          });

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
      rejectChange:
        (changeId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (!node.isText) return;

            // Find insertion marks to remove content
            const insertionMark = node.marks.find(
              (mark) =>
                mark.type.name === "insertion" &&
                mark.attrs.changeId === changeId,
            );
            if (insertionMark) {
              tr.delete(pos, pos + node.nodeSize);
              modified = true;
            }

            // Find deletion marks to keep content (just remove mark)
            const deletionMark = node.marks.find(
              (mark) =>
                mark.type.name === "deletion" &&
                mark.attrs.changeId === changeId,
            );
            if (deletionMark) {
              tr.removeMark(pos, pos + node.nodeSize, deletionMark);
              modified = true;
            }
          });

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
      acceptAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          // Process in reverse to avoid position shifts
          const changes: Array<{
            pos: number;
            size: number;
            type: "insertion" | "deletion";
            mark: PMMark;
          }> = [];

          doc.descendants((node, pos) => {
            if (!node.isText) return;

            const insertionMark = node.marks.find(
              (m: PMMark) => m.type.name === "insertion",
            );
            if (insertionMark) {
              changes.push({
                pos,
                size: node.nodeSize,
                type: "insertion",
                mark: insertionMark,
              });
            }

            const deletionMark = node.marks.find(
              (m: PMMark) => m.type.name === "deletion",
            );
            if (deletionMark) {
              changes.push({
                pos,
                size: node.nodeSize,
                type: "deletion",
                mark: deletionMark,
              });
            }
          });

          // Sort by position descending
          changes.sort((a, b) => b.pos - a.pos);

          for (const change of changes) {
            if (change.type === "insertion") {
              tr.removeMark(change.pos, change.pos + change.size, change.mark);
              modified = true;
            } else {
              tr.delete(change.pos, change.pos + change.size);
              modified = true;
            }
          }

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
      rejectAllChanges:
        () =>
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          const changes: Array<{
            pos: number;
            size: number;
            type: "insertion" | "deletion";
            mark: PMMark;
          }> = [];

          doc.descendants((node, pos) => {
            if (!node.isText) return;

            const insertionMark = node.marks.find(
              (mark) => mark.type.name === "insertion",
            );
            if (insertionMark) {
              changes.push({
                pos,
                size: node.nodeSize,
                type: "insertion",
                mark: insertionMark,
              });
            }

            const deletionMark = node.marks.find(
              (mark) => mark.type.name === "deletion",
            );
            if (deletionMark) {
              changes.push({
                pos,
                size: node.nodeSize,
                type: "deletion",
                mark: deletionMark,
              });
            }
          });

          // Sort by position descending
          changes.sort((a, b) => b.pos - a.pos);

          for (const change of changes) {
            if (change.type === "insertion") {
              tr.delete(change.pos, change.pos + change.size);
              modified = true;
            } else {
              tr.removeMark(change.pos, change.pos + change.size, change.mark);
              modified = true;
            }
          }

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: trackChangesPluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (!extension.storage.enabled) {
            return null;
          }

          // Check if any transaction has actual changes
          const hasDocChanges = transactions.some(
            (tr) => tr.docChanged && !tr.getMeta("trackChangesProcessed"),
          );
          if (!hasDocChanges) {
            return null;
          }

          // Skip if already processed
          const lastTr = transactions[transactions.length - 1];
          if (lastTr.getMeta("trackChangesProcessed")) {
            return null;
          }

          // Skip if this is an accept/reject operation
          if (lastTr.getMeta("trackChangesAcceptReject")) {
            return null;
          }

          const tr = newState.tr;
          const { currentUser, onChangeDetected } = extension.options;

          // Process each step in each transaction
          for (const transaction of transactions) {
            if (!transaction.docChanged) continue;
            if (transaction.getMeta("trackChangesProcessed")) continue;

            transaction.steps.forEach((step, stepIndex) => {
              const stepMap = step.getMap();
              const invertedStep = step.invert(
                stepIndex === 0
                  ? oldState.doc
                  : transaction.docs[stepIndex] || oldState.doc,
              );

              stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                const changeId = `change-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const timestamp = new Date().toISOString();

                // Handle deletions (old content that was removed)
                if (oldEnd > oldStart) {
                  // Get deleted content from old state
                  const deletedContent = oldState.doc.textBetween(
                    oldStart,
                    oldEnd,
                    " ",
                  );

                  if (deletedContent && deletedContent.trim()) {
                    // Insert deletion mark with the deleted text
                    const deletionMark = newState.schema.marks.deletion.create({
                      changeId,
                      author: currentUser.name,
                      authorId: currentUser.id,
                      timestamp,
                    });

                    // For deletions, we need to re-insert the text with deletion mark
                    // But this is complex - for now, record the change
                    const change: TrackChange = {
                      id: changeId,
                      type: "deletion",
                      author: currentUser.name,
                      authorId: currentUser.id,
                      timestamp,
                      originalContent: deletedContent,
                    };

                    extension.storage.changes.push(change);

                    if (onChangeDetected) {
                      onChangeDetected(change);
                    }
                  }
                }

                // Handle insertions (new content that was added)
                if (newEnd > newStart) {
                  const insertedContent = newState.doc.textBetween(
                    newStart,
                    newEnd,
                    " ",
                  );

                  if (insertedContent && insertedContent.trim()) {
                    const insertionMark =
                      newState.schema.marks.insertion.create({
                        changeId,
                        author: currentUser.name,
                        authorId: currentUser.id,
                        timestamp,
                      });

                    // Add insertion mark to the new content
                    tr.addMark(newStart, newEnd, insertionMark);

                    const change: TrackChange = {
                      id: changeId,
                      type: "insertion",
                      author: currentUser.name,
                      authorId: currentUser.id,
                      timestamp,
                      newContent: insertedContent,
                    };

                    extension.storage.changes.push(change);

                    if (onChangeDetected) {
                      onChangeDetected(change);
                    }
                  }
                }
              });
            });
          }

          tr.setMeta("trackChangesProcessed", true);

          // Only return if we made changes
          if (tr.steps.length > 0) {
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});

export default TrackChanges;
