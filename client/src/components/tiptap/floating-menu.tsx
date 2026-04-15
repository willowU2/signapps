"use client";

import { FloatingMenu as TiptapFloatingMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Table,
  Image,
  Minus,
} from "lucide-react";

interface FloatingMenuProps {
  editor: Editor | null;
  className?: string;
}

export function FloatingMenu({ editor, className }: FloatingMenuProps) {
  if (!editor) {
    return null;
  }

  return (
    <TiptapFloatingMenu
      editor={editor}
      className={cn(
        "flex flex-col gap-1 p-2 rounded-lg border bg-background shadow-lg min-w-[200px]",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground px-2 py-1">Insert block</p>

      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4 mr-2" />
        Heading 1
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4 mr-2" />
        Heading 2
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4 mr-2" />
        Heading 3
      </Button>

      <div className="h-px bg-border my-1" />

      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4 mr-2" />
        Bullet List
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4 mr-2" />
        Numbered List
      </Button>

      <div className="h-px bg-border my-1" />

      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4 mr-2" />
        Quote
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4 mr-2" />
        Code Block
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4 mr-2" />
        Divider
      </Button>
    </TiptapFloatingMenu>
  );
}
