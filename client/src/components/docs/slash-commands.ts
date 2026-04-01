import { Extension } from "@tiptap/core";
import type {
  Editor as TiptapEditor,
  Range as TiptapRange,
} from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { CommandList } from "./command-list";

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: TiptapEditor; range: TiptapRange }) => void;
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: TiptapEditor;
          range: TiptapRange;
          props: CommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionOptions = (items: CommandItem[]) => ({
  items: ({ query }: { query: string }) => {
    return items
      .filter((item) =>
        item.title.toLowerCase().startsWith(query.toLowerCase()),
      )
      .slice(0, 10);
  },

  render: () => {
    let component: ReactRenderer;
    let floatingElement: HTMLDivElement | null = null;

    const updatePosition = (clientRect: (() => DOMRect) | null) => {
      if (!floatingElement || !clientRect) return;

      const virtualEl = {
        getBoundingClientRect: clientRect,
      };

      computePosition(virtualEl, floatingElement, {
        placement: "bottom-start",
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        if (floatingElement) {
          Object.assign(floatingElement.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        }
      });
    };

    return {
      onStart: (props: {
        editor: TiptapEditor;
        clientRect?: (() => DOMRect) | null;
        [key: string]: unknown;
      }) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        // Create floating element
        floatingElement = document.createElement("div");
        floatingElement.style.position = "absolute";
        floatingElement.style.zIndex = "9999";
        floatingElement.appendChild(component.element);
        document.body.appendChild(floatingElement);

        updatePosition(props.clientRect);
      },

      onUpdate(props: {
        clientRect?: (() => DOMRect) | null;
        [key: string]: unknown;
      }) {
        component.updateProps(props);
        updatePosition(props.clientRect != null ? props.clientRect : null);
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          if (floatingElement) {
            floatingElement.style.display = "none";
          }
          return true;
        }

        return (component?.ref as unknown as CommandListRef | null)?.onKeyDown(
          props,
        );
      },

      onExit() {
        if (floatingElement) {
          floatingElement.remove();
          floatingElement = null;
        }
        component.destroy();
      },
    };
  },
});
