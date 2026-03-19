/**
 * Type declarations for editor modules that will be implemented later.
 * These declarations allow TypeScript to recognize dynamic imports.
 */

declare module '@/components/docs/document-editor' {
  import type { ComponentType } from 'react';

  interface EditorProps {
    content?: unknown;
    onChange?: (newContent: unknown) => void;
    readOnly?: boolean;
    documentId?: string;
    [key: string]: unknown;
  }

  const DocumentEditor: ComponentType<EditorProps>;
  export default DocumentEditor;
}

declare module '@/components/sheets/sheet-editor' {
  import type { ComponentType } from 'react';

  interface EditorProps {
    content?: unknown;
    onChange?: (newContent: unknown) => void;
    readOnly?: boolean;
    documentId?: string;
    [key: string]: unknown;
  }

  const SheetEditor: ComponentType<EditorProps>;
  export default SheetEditor;
}

declare module '@/components/slides/slide-editor' {
  import type { ComponentType } from 'react';

  interface EditorProps {
    content?: unknown;
    onChange?: (newContent: unknown) => void;
    readOnly?: boolean;
    documentId?: string;
    [key: string]: unknown;
  }

  const SlideEditor: ComponentType<EditorProps>;
  export default SlideEditor;
}

// Tiptap extension modules
declare module '@/lib/tiptap/extensions/comments' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/track-changes' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/collaboration' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/mentions' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/emoji' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/math' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/code-block' {
  const extension: unknown;
  export default extension;
}

declare module '@/lib/tiptap/extensions/table' {
  const extension: unknown;
  export default extension;
}
