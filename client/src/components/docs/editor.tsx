'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
    Sparkles,
    Wand2,
    CheckCheck,
    FileText,
    Loader2,
    Pencil,
    ArrowRight,
    Languages,
    X,
    Square,
} from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai-stream';
import { toast } from 'sonner';

const getRandomColor = () => {
    const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
    return colors[Math.floor(Math.random() * colors.length)];
};

interface EditorProps {
    documentId: string;
    className?: string;
    userName?: string;
}

type FloatingMode = 'menu' | 'prompt' | 'translate';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Fran\u00e7ais' },
    { code: 'es', label: 'Espa\u00f1ol' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'pt', label: 'Portugu\u00eas' },
];

const Editor = ({ documentId, className, userName }: EditorProps) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [ydoc] = useState<Y.Doc>(() => new Y.Doc());

    // AI state
    const { stream, stop, isStreaming } = useAiStream();
    const [aiAction, setAiAction] = useState<string | null>(null);

    // FloatingMenu state
    const [floatingMode, setFloatingMode] = useState<FloatingMode>('menu');
    const [promptValue, setPromptValue] = useState('');
    const promptInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';

        const wsProvider = new WebsocketProvider(baseUrl, documentId, ydoc);

        wsProvider.on('status', (event: { status: 'connected' | 'disconnected' }) => {
            setStatus(event.status);
        });

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
            ydoc.destroy();
        };
    }, [documentId, ydoc]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false,
            }),
            Placeholder.configure({
                placeholder: 'Start writing or press / for AI help...',
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
                class: 'prose prose-slate dark:prose-invert sm:prose-base lg:prose-lg max-w-[850px] mx-auto focus:outline-none min-h-[1056px] bg-white dark:bg-gray-900 shadow-premium ring-1 ring-gray-200/50 dark:ring-gray-800/50 p-12 sm:p-16 md:p-24 rounded-sm my-8 transition-colors',
            },
        },
    }, [ydoc, provider]);

    // Streaming AI action for BubbleMenu (improve/fix/shorten)
    const handleAiAction = useCallback(async (action: 'improve' | 'fix' | 'shorten') => {
        if (!editor || isStreaming) return;
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to);
        if (!text) return;

        setAiAction(action);

        const systemPrompts: Record<string, string> = {
            improve: 'You are a professional editor. Rewrite the text to improve clarity, flow, and style. Output ONLY the rewritten text.',
            fix: 'You are a meticulous proofreader. Fix all grammar, spelling, and punctuation errors. Output ONLY the corrected text.',
            shorten: 'You are a concise writer. Shorten the text while preserving all key information. Output ONLY the shortened text.',
        };

        // Delete selected text first
        editor.chain().focus().deleteSelection().run();

        await stream(
            `${action === 'improve' ? 'Improve' : action === 'fix' ? 'Fix grammar and spelling in' : 'Shorten'} the following text:\n\n${text}`,
            {
                onToken: (token) => {
                    editor.chain().focus().insertContent(token).run();
                },
                onDone: () => {
                    setAiAction(null);
                    toast.success('Text updated');
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`AI error: ${err}`);
                },
            },
            { systemPrompt: systemPrompts[action], language: 'en' },
        );
    }, [editor, isStreaming, stream]);

    // Streaming summarize
    const handleSummarize = useCallback(async () => {
        if (!editor || isStreaming) return;
        const text = editor.getText();
        if (!text) return;

        setAiAction('summarize');
        let summary = '';
        const toastId = toast.loading('Generating summary...');

        await stream(
            `Summarize the following document in 3-5 bullet points:\n\n${text}`,
            {
                onToken: (token) => {
                    summary += token;
                    toast.loading(summary.slice(0, 200) + (summary.length > 200 ? '...' : ''), { id: toastId });
                },
                onDone: (full) => {
                    setAiAction(null);
                    toast.success('Summary', { id: toastId, description: full, duration: 15000 });
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`Summarization failed: ${err}`, { id: toastId });
                },
            },
            { systemPrompt: 'You are a helpful assistant. Output a concise summary.', language: 'en' },
        );
    }, [editor, isStreaming, stream]);

    // FloatingMenu: Help me write
    const handleHelpMeWrite = useCallback(async () => {
        if (!editor || isStreaming || !promptValue.trim()) return;
        const prompt = promptValue.trim();
        setPromptValue('');
        setFloatingMode('menu');
        setAiAction('write');

        await stream(
            prompt,
            {
                onToken: (token) => {
                    editor.chain().focus().insertContent(token).run();
                },
                onDone: () => {
                    setAiAction(null);
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`AI error: ${err}`);
                },
            },
            {
                systemPrompt: 'You are a professional writer. Write clear, well-structured content based on the user\'s instruction. Output ONLY the content, no explanations or meta-text.',
                language: 'en',
            },
        );
    }, [editor, isStreaming, promptValue, stream]);

    // FloatingMenu: Continue writing
    const handleContinueWriting = useCallback(async () => {
        if (!editor || isStreaming) return;
        setFloatingMode('menu');
        setAiAction('continue');

        // Grab last ~1000 characters before cursor as context
        const { from } = editor.state.selection;
        const start = Math.max(0, from - 1000);
        const context = editor.state.doc.textBetween(start, from);

        if (!context.trim()) {
            toast.error('No preceding text to continue from');
            setAiAction(null);
            return;
        }

        await stream(
            `Continue writing naturally from where this text leaves off:\n\n${context}`,
            {
                onToken: (token) => {
                    editor.chain().focus().insertContent(token).run();
                },
                onDone: () => {
                    setAiAction(null);
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`AI error: ${err}`);
                },
            },
            {
                systemPrompt: 'You are a professional writer. Continue the text seamlessly, matching the tone, style, and topic. Output ONLY the continuation, no explanations.',
                language: 'en',
            },
        );
    }, [editor, isStreaming, stream]);

    // FloatingMenu: Translate
    const handleTranslate = useCallback(async (langCode: string, langLabel: string) => {
        if (!editor || isStreaming) return;
        setFloatingMode('menu');

        const { from, to } = editor.state.selection;
        const hasSelection = from !== to;
        const text = hasSelection
            ? editor.state.doc.textBetween(from, to)
            : editor.getText();

        if (!text.trim()) return;

        setAiAction('translate');

        if (hasSelection) {
            editor.chain().focus().deleteSelection().run();
        } else {
            editor.chain().focus().selectAll().deleteSelection().run();
        }

        await stream(
            `Translate the following text to ${langLabel}:\n\n${text}`,
            {
                onToken: (token) => {
                    editor.chain().focus().insertContent(token).run();
                },
                onDone: () => {
                    setAiAction(null);
                    toast.success(`Translated to ${langLabel}`);
                },
                onError: (err) => {
                    setAiAction(null);
                    toast.error(`Translation failed: ${err}`);
                },
            },
            {
                systemPrompt: `You are a professional translator. Translate the text to ${langLabel}. Output ONLY the translation.`,
                language: langCode,
            },
        );
    }, [editor, isStreaming, stream]);

    // Reset floating mode when menu hides
    useEffect(() => {
        if (floatingMode === 'prompt' && promptInputRef.current) {
            promptInputRef.current.focus();
        }
    }, [floatingMode]);

    if (!editor || !ydoc || !provider) {
        return <div className="flex items-center justify-center p-8 text-gray-500">Initializing editor...</div>;
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50/50 dark:bg-[#0a0a0a] overflow-hidden ${className}`}>
            {/* Toolbar Ribbon */}
            <div className="sticky top-0 z-20 border-b border-gray-200/60 dark:border-gray-800/60 p-2.5 px-6 flex items-center justify-between bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl shadow-sm">
                <div className="flex gap-3 items-center">
                    <span className={`w-2 h-2 rounded-full shadow-sm ${status === 'connected' ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`}></span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest">{status}</span>
                    {isStreaming && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            AI writing...
                        </span>
                    )}
                </div>
                <div className="flex gap-1.5 p-1 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg border border-gray-200/50 dark:border-gray-800/50">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        disabled={!editor.can().chain().focus().toggleBold().run()}
                        className={`p-1.5 min-w-[32px] rounded-md transition-all font-serif font-bold ${editor.isActive('bold') ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
                    >
                        B
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        disabled={!editor.can().chain().focus().toggleItalic().run()}
                        className={`p-1.5 min-w-[32px] rounded-md transition-all font-serif italic ${editor.isActive('italic') ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
                    >
                        I
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        disabled={!editor.can().chain().focus().toggleStrike().run()}
                        className={`p-1.5 min-w-[32px] rounded-md transition-all font-serif line-through ${editor.isActive('strike') ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
                    >
                        S
                    </button>
                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1.5 self-center" />
                    {isStreaming ? (
                        <button
                            onClick={stop}
                            className="p-1.5 min-w-[32px] rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors flex items-center justify-center"
                            title="Stop AI"
                        >
                            <Square className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSummarize}
                            disabled={isStreaming}
                            className="p-1.5 px-3 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 transition-colors flex items-center gap-1.5 font-medium text-[13px]"
                            title="Summarize Document"
                        >
                            <FileText className="w-4 h-4" />
                            Summarize
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full relative pt-4 pb-16 custom-scrollbar">
                {/* BubbleMenu - AI actions on selected text */}
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        tippyOptions={{ duration: 150, animation: 'fade' }}
                        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden flex divide-x divide-gray-100 dark:divide-gray-800 p-0.5"
                    >
                        <button
                            onClick={() => handleAiAction('improve')}
                            disabled={isStreaming}
                            className="flex items-center gap-2 px-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-xs font-medium text-purple-600 dark:text-purple-400 transition-colors"
                        >
                            {aiAction === 'improve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Improve
                        </button>
                        <button
                            onClick={() => handleAiAction('fix')}
                            disabled={isStreaming}
                            className="flex items-center gap-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            {aiAction === 'fix' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                            Fix
                        </button>
                        <button
                            onClick={() => handleAiAction('shorten')}
                            disabled={isStreaming}
                            className="flex items-center gap-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            {aiAction === 'shorten' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Shorten
                        </button>
                    </BubbleMenu>
                )}

                {/* FloatingMenu - AI actions on empty lines */}
                {editor && (
                    <FloatingMenu
                        editor={editor}
                        tippyOptions={{
                            duration: 150,
                            animation: 'shift-toward',
                            placement: 'bottom-start',
                            onHide: () => {
                                setFloatingMode('menu');
                                setPromptValue('');
                            },
                        }}
                        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-xl shadow-purple-900/5 border border-purple-100 dark:border-purple-900/30 rounded-xl overflow-hidden min-w-[220px]"
                    >
                        {floatingMode === 'menu' && (
                            <div className="flex flex-col py-1 min-w-[200px]">
                                <button
                                    onClick={() => setFloatingMode('prompt')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-xs font-medium text-purple-600 dark:text-purple-400 transition-colors text-left"
                                >
                                    <Pencil className="w-3 h-3" />
                                    Help me write...
                                </button>
                                <button
                                    onClick={handleContinueWriting}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors text-left"
                                >
                                    {aiAction === 'continue' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                                    Continue writing
                                </button>
                                <button
                                    onClick={() => setFloatingMode('translate')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors text-left"
                                >
                                    <Languages className="w-3 h-3" />
                                    Translate...
                                </button>
                            </div>
                        )}

                        {floatingMode === 'prompt' && (
                            <div className="flex items-center gap-1 p-1 min-w-[300px]">
                                <Sparkles className="w-3 h-3 text-purple-500 ml-2 shrink-0" />
                                <input
                                    ref={promptInputRef}
                                    type="text"
                                    value={promptValue}
                                    onChange={(e) => setPromptValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleHelpMeWrite();
                                        }
                                        if (e.key === 'Escape') {
                                            setFloatingMode('menu');
                                            setPromptValue('');
                                        }
                                    }}
                                    placeholder="Describe what to write..."
                                    className="flex-1 border-none bg-transparent text-xs focus:outline-none px-1 py-1.5"
                                />
                                <button
                                    onClick={handleHelpMeWrite}
                                    disabled={!promptValue.trim() || isStreaming}
                                    className="p-1 rounded text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-30 transition-colors"
                                >
                                    {isStreaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                                </button>
                                <button
                                    onClick={() => { setFloatingMode('menu'); setPromptValue(''); }}
                                    className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        {floatingMode === 'translate' && (
                            <div className="flex flex-col py-1 min-w-[160px]">
                                <div className="px-3 py-1 text-[10px] uppercase text-gray-400 font-semibold">Translate to</div>
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleTranslate(lang.code, lang.label)}
                                        disabled={isStreaming}
                                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 transition-colors text-left"
                                    >
                                        {lang.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setFloatingMode('menu')}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-400 transition-colors text-left border-t border-gray-100 dark:border-gray-700 mt-1"
                                >
                                    <X className="w-3 h-3" />
                                    Back
                                </button>
                            </div>
                        )}
                    </FloatingMenu>
                )}

                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default Editor;
