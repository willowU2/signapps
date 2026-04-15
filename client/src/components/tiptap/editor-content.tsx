"use client";

import { EditorContent as TiptapEditorContent, Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

interface EditorContentProps {
  editor: Editor | null;
  className?: string;
}

export function EditorContent({ editor, className }: EditorContentProps) {
  return (
    <TiptapEditorContent
      editor={editor}
      className={cn(
        "prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none",
        "dark:prose-invert",
        "focus:outline-none",
        "[&_.ProseMirror]:min-h-[200px]",
        "[&_.ProseMirror]:p-4",
        "[&_.ProseMirror]:focus:outline-none",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
        "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
        className,
      )}
    />
  );
}
