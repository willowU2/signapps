'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useEffect, useState } from 'react';


// Define the random color for the cursor
const getRandomColor = () => {
    const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
    return colors[Math.floor(Math.random() * colors.length)];
};

interface EditorProps {
    documentId: string;
    className?: string;
    userName?: string;
}

const Editor = ({ documentId, className, userName }: EditorProps) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

    useEffect(() => {
        // Initialize Yjs document
        const doc = new Y.Doc();
        setYdoc(doc);

        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';
        const wsUrl = `${baseUrl}/${documentId}/ws`;

        // Connect to WebSocket
        const wsProvider = new WebsocketProvider(
            wsUrl,
            documentId, // Room name
            doc
        );

        wsProvider.on('status', (event: { status: 'connected' | 'disconnected' }) => {
            console.log(`Websocket status: ${event.status}`);
            setStatus(event.status);
        });

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
            doc.destroy();
        };

    }, [documentId]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false, // Disabling history because Yjs handles it
            }),
            Collaboration.configure({
                document: ydoc || undefined,
            }),
            CollaborationCursor.configure({
                provider: provider,
                user: {
                    name: userName || 'Anonymous',
                    color: getRandomColor(),
                },
            }),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none h-full p-4 min-h-[500px]',
            },
        },
    }, [ydoc, provider]);

    if (!editor || !ydoc || !provider) {
        return <div className="flex items-center justify-center p-8 text-gray-500">Initializing editor...</div>;
    }

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-gray-900 border rounded-lg overflow-hidden ${className}`}>
            <div className="border-b border-gray-200 dark:border-gray-800 p-2 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                <div className="flex gap-2 items-center">
                    <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-xs text-gray-500 uppercase font-medium">{status}</span>
                </div>
                {/* Toolbar placeholders */}
                <div className="flex gap-1">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        disabled={!editor.can().chain().focus().toggleBold().run()}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    >
                        B
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        disabled={!editor.can().chain().focus().toggleItalic().run()}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    >
                        I
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        disabled={!editor.can().chain().focus().toggleStrike().run()}
                        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('strike') ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    >
                        S
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
                <EditorContent editor={editor} className="h-full min-h-[500px]" />
            </div>
        </div>
    );
};

export default Editor;
