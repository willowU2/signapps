// IDEA-012: Suggestion mode — lightweight track-changes for guests
// Wraps insertions in a suggestion mark without direct modification
import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface SuggestionOptions {
  enabled: boolean;
  author: string;
  authorId: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMode: {
      enableSuggestionMode: () => ReturnType;
      disableSuggestionMode: () => ReturnType;
    };
  }
}

export const suggestionPluginKey = new PluginKey("suggestionMode");

// Mark for suggested insertions
export const SuggestionInsertion = Mark.create({
  name: "suggestionInsertion",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      author: { default: "Anonymous" },
      authorId: { default: "" },
      timestamp: { default: () => new Date().toISOString() },
    };
  },

  parseHTML() {
    return [{ tag: "ins[data-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ins",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion": "",
        class:
          "suggestion-insertion bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 underline decoration-green-500 no-underline",
        title: `Suggested by ${HTMLAttributes.author}`,
      }),
      0,
    ];
  },
});

// Mark for suggested deletions (struck-through)
export const SuggestionDeletion = Mark.create({
  name: "suggestionDeletion",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      author: { default: "Anonymous" },
      authorId: { default: "" },
      timestamp: { default: () => new Date().toISOString() },
    };
  },

  parseHTML() {
    return [{ tag: "del[data-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "del",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-suggestion": "",
        class:
          "suggestion-deletion bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through decoration-red-500",
        title: `Supprimé by ${HTMLAttributes.author}`,
      }),
      0,
    ];
  },
});

export const SuggestionMode = Extension.create<SuggestionOptions>({
  name: "suggestionMode",

  addOptions() {
    return { enabled: false, author: "Anonymous", authorId: "" };
  },

  addStorage() {
    return { enabled: false };
  },

  addCommands() {
    return {
      enableSuggestionMode:
        () =>
        ({ editor }) => {
          (
            editor.storage as unknown as Record<string, unknown>
          ).suggestionMode = { enabled: true };
          return true;
        },
      disableSuggestionMode:
        () =>
        ({ editor }) => {
          (
            editor.storage as unknown as Record<string, unknown>
          ).suggestionMode = { enabled: false };
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: suggestionPluginKey,
        props: {},
      }),
    ];
  },
});
