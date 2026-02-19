'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import { useYjsDocument } from '@/hooks/use-yjs-document';
import { useAuthStore } from '@/lib/store';
import { useState, useEffect } from 'react';

interface CollaborativeEditorProps {
    docId: string;
    onSynced?: () => void;
    placeholder?: string;
}

export function CollaborativeEditor({
    docId,
    onSynced,
    placeholder = 'Start typing...',
}: CollaborativeEditorProps) {
    const { ydoc, provider, awareness, isSynced } = useYjsDocument(docId, {
        onSync: onSynced,
    });
    const { user } = useAuthStore();
    const [editorReady, setEditorReady] = useState(false);

    // Update awareness with current user info
    useEffect(() => {
        if (awareness && user) {
            awareness.setLocalState({
                user: {
                    name: user.username,
                    color: generateUserColor(user.id),
                },
            });
        }
    }, [awareness, user]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder }),
            ydoc ? Collaboration.configure({ document: ydoc }) : null,
            provider ? CollaborationCursor.configure({ provider }) : null,
        ].filter(Boolean) as any[],
        content: '',
        onUpdate: () => {
            // Auto-save could be added here
        },
        onSelectionUpdate: ({ editor }) => {
            // Update awareness with cursor position
            if (awareness && user) {
                const pos = editor.state.selection.$anchor.pos;
                awareness.setLocalState({
                    user: {
                        name: user.username,
                        color: generateUserColor(user.id),
                    },
                    cursor: { anchor: pos },
                });
            }
        },
        editable: isSynced,
    });

    useEffect(() => {
        if (editor && !editorReady && isSynced) {
            setEditorReady(true);
        }
    }, [editor, isSynced, editorReady]);

    if (!editor || !ydoc || !provider) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-center">
                    <div className="animate-spin">⏳</div>
                    <p className="text-gray-500 mt-2">Initializing collaborative editor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center gap-2">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`px-3 py-1 rounded ${
                        editor.isActive('bold')
                            ? 'bg-blue-500 text-white'
                            : 'bg-white hover:bg-gray-100'
                    }`}
                >
                    <strong>B</strong>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`px-3 py-1 rounded ${
                        editor.isActive('italic')
                            ? 'bg-blue-500 text-white'
                            : 'bg-white hover:bg-gray-100'
                    }`}
                >
                    <em>I</em>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`px-3 py-1 rounded ${
                        editor.isActive('heading', { level: 1 })
                            ? 'bg-blue-500 text-white'
                            : 'bg-white hover:bg-gray-100'
                    }`}
                >
                    H1
                </button>

                {/* Sync indicator */}
                <div className="ml-auto flex items-center gap-2">
                    <div
                        className={`w-2 h-2 rounded-full ${
                            isSynced ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                        }`}
                    />
                    <span className="text-xs text-gray-600">
                        {isSynced ? 'Synced' : 'Syncing...'}
                    </span>
                </div>
            </div>

            {/* Editor */}
            <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none p-4 min-h-96 focus:outline-none"
            />

            {/* Collaborators indicator */}
            {awareness && (
                <div className="bg-gray-50 border-t border-gray-200 p-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Collaborators:</span>
                    <div className="flex gap-1">
                        {Array.from(awareness.getStates().values()).map((state: any, idx) => (
                            <div
                                key={idx}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{
                                    backgroundColor: state.user?.color || '#ccc',
                                }}
                                title={state.user?.name}
                            >
                                {state.user?.name?.[0]?.toUpperCase()}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Generate a consistent color for a user based on their ID
 */
function generateUserColor(userId: string): string {
    const colors = [
        '#FF6B6B',
        '#4ECDC4',
        '#45B7D1',
        '#FFA07A',
        '#98D8C8',
        '#F7DC6F',
        '#BB8FCE',
        '#85C1E2',
    ];
    const hash = userId
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}
