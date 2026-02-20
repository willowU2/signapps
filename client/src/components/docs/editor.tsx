'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useEffect, useState } from 'react';
import { Sparkles, Wand2, CheckCheck, FileText } from 'lucide-react';
import { aiApi } from '@/lib/api';
import { toast } from 'sonner';


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
    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        // Initialize Yjs document
        const doc = new Y.Doc();
        setYdoc(doc);

        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';

        // Connect to WebSocket
        // WebsocketProvider appends `/${roomName}` to the serverUrl internally,
        // so we pass the base URL and the documentId as the room name.
        const wsProvider = new WebsocketProvider(
            baseUrl,
            documentId,
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

    const handleAiAction = async (action: 'improve' | 'fix' | 'shorten') => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to);
        if (!text) return;

        setIsAiLoading(true);
        const toastId = toast.loading("AI working...");

        try {
            let systemPrompt = "You are a helpful writing assistant. Output ONLY the rewritten text, no explanations.";
            let userPrompt = "";

            if (action === 'improve') userPrompt = `Improve the writing of the following text:\n\n${text}`;
            if (action === 'fix') userPrompt = `Fix grammar and spelling errors in the following text:\n\n${text}`;
            if (action === 'shorten') userPrompt = `Shorten the following text while keeping key information:\n\n${text}`;

            const response = await aiApi.chat(userPrompt, {
                systemPrompt
            });

            if (response.data.answer) {
                editor.chain().focus().insertContent(response.data.answer).run();
                toast.success("Text updated!");
            }
        } catch (e) {
            toast.error("AI request failed");
            console.error(e);
        } finally {
            setIsAiLoading(false);
            toast.dismiss(toastId);
        }
    };

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
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
                    <button
                        onClick={async () => {
                            if (!editor) return;
                            const text = editor.getText();
                            if (!text) return;

                            setIsAiLoading(true);
                            const toastId = toast.loading("Summarizing document...");

                            try {
                                const response = await aiApi.chat(`Summarize the following document in 3-5 bullet points:\n\n${text}`, {
                                    systemPrompt: "You are a helpful assistant. Output a concise summary."
                                });

                                if (response.data.answer) {
                                    toast.success("Summary generated", {
                                        description: response.data.answer,
                                        duration: 10000,
                                    });
                                }
                            } catch (e) {
                                toast.error("Summarization failed");
                            } finally {
                                setIsAiLoading(false);
                                toast.dismiss(toastId);
                            }
                        }}
                        disabled={isAiLoading}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-purple-600 transition-colors"
                        title="Summarize Document"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 relative">
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        tippyOptions={{ duration: 100 }}
                        className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex divide-x divide-gray-200 dark:divide-gray-700 h-9"
                    >
                        <button
                            onClick={() => handleAiAction('improve')}
                            disabled={isAiLoading}
                            className="flex items-center gap-2 px-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-xs font-medium text-purple-600 dark:text-purple-400 transition-colors"
                        >
                            <Sparkles className="w-3 h-3" />
                            Improve
                        </button>
                        <button
                            onClick={() => handleAiAction('fix')}
                            disabled={isAiLoading}
                            className="flex items-center gap-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            <CheckCheck className="w-3 h-3" />
                            Fix
                        </button>
                        <button
                            onClick={() => handleAiAction('shorten')}
                            disabled={isAiLoading}
                            className="flex items-center gap-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            <Wand2 className="w-3 h-3" />
                            Shorten
                        </button>
                    </BubbleMenu>
                )}
                <EditorContent editor={editor} className="h-full min-h-[500px]" />
            </div>
        </div>
    );
};

export default Editor;
