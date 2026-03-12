'use client';

import { BubbleMenu as TiptapBubbleMenu, Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { Bold, Italic, Underline, Strikethrough, Code, Link } from 'lucide-react';

interface BubbleMenuProps {
    editor: Editor | null;
    className?: string;
}

export function BubbleMenu({ editor, className }: BubbleMenuProps) {
    if (!editor) {
        return null;
    }

    return (
        <TiptapBubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            className={cn(
                'flex items-center gap-1 p-1 rounded-lg border bg-background shadow-lg',
                className
            )}
        >
            <Toggle
                size="sm"
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('underline')}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
            >
                <Underline className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('strike')}
                onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('code')}
                onPressedChange={() => editor.chain().focus().toggleCode().run()}
            >
                <Code className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('link')}
                onPressedChange={() => {
                    if (editor.isActive('link')) {
                        editor.chain().focus().unsetLink().run();
                    } else {
                        const url = window.prompt('Enter URL');
                        if (url) {
                            editor.chain().focus().setLink({ href: url }).run();
                        }
                    }
                }}
            >
                <Link className="h-4 w-4" />
            </Toggle>
        </TiptapBubbleMenu>
    );
}
