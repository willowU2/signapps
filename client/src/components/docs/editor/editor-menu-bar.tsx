import { Editor } from '@tiptap/react';
import { DynamicMenuBar } from '@/components/ui/dynamic-menu-bar';
import { editorMenuConfig } from './editor-menu-config';

interface EditorMenuBarProps {
    editor: Editor | null;
}

export function EditorMenuBar({ editor }: EditorMenuBarProps) {
    if (!editor) return null;

    return <DynamicMenuBar categories={editorMenuConfig} editor={editor} />;
}
