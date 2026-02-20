'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

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
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Heading1,
    Heading2,
    Heading3,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    Palette,
    Highlighter,
    Table as TableIcon,
    Image as ImageIcon,
    Link as LinkIcon,
    Undo,
    Redo,
    MessageSquare,
    Menu,
    Bot
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

    // Toolbar states
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showAiToolbar, setShowAiToolbar] = useState(false);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';

        const wsProvider = new WebsocketProvider(baseUrl, documentId, ydoc);

        wsProvider.on('status', (event: { status: 'connected' | 'disconnected' }) => {
            setStatus(event.status);
        });

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
        };
    }, [documentId, ydoc]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: false, // Turn off Prosemirror history as Yjs handles it
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Subscript,
            Superscript,
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
            }),
            Placeholder.configure({
                placeholder: 'Type \'/\' for commands or start writing...',
                emptyEditorClass: 'is-editor-empty',
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
                class: 'prose prose-slate dark:prose-invert max-w-[816px] mx-auto focus:outline-none min-h-[1056px] bg-white dark:bg-[#1f1f1f] shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] ring-1 ring-gray-200/50 dark:ring-gray-800 p-[1in] rounded-sm my-6 transition-colors font-sans text-[11pt] leading-[1.5]',
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

    const ToolbarButton = ({
        onClick,
        isActive = false,
        disabled = false,
        children,
        title
    }: {
        onClick: () => void,
        isActive?: boolean,
        disabled?: boolean,
        children: React.ReactNode,
        title?: string
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1.5 min-w-[32px] rounded flex items-center justify-center transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isActive ? 'bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]' : 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'}`}
        >
            {children}
        </button>
    );

    const ToolbarDivider = () => <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center" />;

    return (
        <div className={`flex flex-col h-full bg-[#f8f9fa] dark:bg-[#1a1a1a] overflow-hidden ${className}`}>
            {/* Top Bar (Title & Main Menus - Simplified for now) */}
            <div className="flex flex-col border-b border-[#e3e3e3] dark:border-[#3c4043] bg-white dark:bg-[#202124]">
                <div className="flex items-center px-4 py-2 gap-4">
                    <div className="flex flex-col">
                        <div className="text-[18px] text-[#202124] dark:text-[#e8eaed] font-medium leading-[24px]">Untitled Document</div>
                        <div className="flex gap-4 text-[13px] text-[#444746] dark:text-[#9aa0a6] mt-0.5">
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">File</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Edit</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">View</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Insert</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Format</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Tools</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Extensions</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Help</span>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <div className="flex gap-3 items-center px-3 py-1 bg-gray-50 dark:bg-[#303134] rounded-full border border-gray-200 dark:border-[#5f6368]">
                            <span className={`w-2 h-2 rounded-full shadow-sm ${status === 'connected' ? 'bg-[#1e8e3e] shadow-green-500/50' : 'bg-[#d93025] shadow-red-500/50'}`}></span>
                            <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] font-medium tracking-wide">
                                {status === 'connected' ? 'Saved to drive' : 'Saving...'}
                            </span>
                            {isStreaming && (
                                <span className="flex items-center gap-1 text-[11px] text-[#c5221f] dark:text-[#f28b82] animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    AI
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Google Docs Style Ribbon */}
                <div className="flex items-center gap-0.5 px-3 py-1.5 bg-[#edf2fa] dark:bg-[#2d2e30] rounded-full mx-4 my-2 mb-3 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] overflow-x-auto">
                    {/* Undo/Redo */}
                    <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                        <Undo className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                        <Redo className="w-4 h-4" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Text Styles */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
                        <Heading1 className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
                        <Heading2 className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')} title="Paragraph">
                        <span className="text-[13px] font-medium px-1">Normal text</span>
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Font Styles */}
                    <div className="flex border border-[#c7c7c7] dark:border-[#5f6368] rounded overflow-hidden h-[28px] mx-1 items-center bg-white dark:bg-[#202124]">
                        <span className="px-3 text-[13px] text-[#444746] dark:text-[#e3e3e3] border-r border-[#c7c7c7] dark:border-[#5f6368] flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#303134]">Inter</span>
                        <div className="flex items-center">
                            <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#303134] cursor-pointer border-r border-[#c7c7c7] dark:border-[#5f6368]">-</span>
                            <span className="px-3 text-[13px] text-[#444746] dark:text-[#e3e3e3]">11</span>
                            <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#303134] cursor-pointer border-l border-[#c7c7c7] dark:border-[#5f6368]">+</span>
                        </div>
                    </div>

                    <ToolbarDivider />

                    {/* Basic Formatting */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)">
                        <Bold className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)">
                        <Italic className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline (Ctrl+U)">
                        <UnderlineIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    {/* Colors */}
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} title="Text color">
                            <Palette className="w-[18px] h-[18px]" />
                        </ToolbarButton>
                        {showColorPicker && (
                            <div className="absolute top-10 left-0 bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                                {['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
                                    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
                                ].map(color => (
                                    <button
                                        key={color}
                                        className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                                    />
                                ))}
                                <button
                                    className="w-full mt-1 text-xs text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                    onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <ToolbarButton onClick={() => setShowHighlightPicker(!showHighlightPicker)} title="Highlight color">
                            <Highlighter className="w-[18px] h-[18px]" />
                        </ToolbarButton>
                        {showHighlightPicker && (
                            <div className="absolute top-10 left-0 bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 shadow-xl rounded-md p-2 flex flex-wrap w-[140px] gap-1 z-30">
                                {['#fce8e6', '#fce8b2', '#fff2cc', '#e6f4ea', '#e8f0fe', '#f3e8fd', '#ffffff',
                                ].map(color => (
                                    <button
                                        key={color}
                                        className="w-5 h-5 rounded-full ring-1 ring-inset ring-black/10 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        onClick={() => { editor.chain().focus().setHighlight({ color }).run(); setShowHighlightPicker(false); }}
                                    />
                                ))}
                                <button
                                    className="w-full mt-1 text-xs text-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                    onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }}
                                >
                                    None
                                </button>
                            </div>
                        )}
                    </div>

                    <ToolbarDivider />

                    {/* Alignment */}
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align left">
                        <AlignLeft className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align center">
                        <AlignCenter className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align right">
                        <AlignRight className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* Lists */}
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bulleted list">
                        <List className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list">
                        <ListOrdered className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist">
                        <CheckSquare className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
                        <TableIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => {
                        const url = window.prompt('URL');
                        if (url) {
                            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                        }
                    }} isActive={editor.isActive('link')} title="Insert link">
                        <LinkIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => {
                        const url = window.prompt('Image URL');
                        if (url) {
                            editor.chain().focus().setImage({ src: url }).run();
                        }
                    }} title="Insert image">
                        <ImageIcon className="w-[18px] h-[18px]" />
                    </ToolbarButton>

                    <ToolbarDivider />

                    {/* AI Integrations Toggle */}
                    <button
                        onClick={() => setShowAiToolbar(!showAiToolbar)}
                        className={`p-1.5 px-3 rounded flex items-center gap-1.5 transition-all ml-auto mr-1 ${showAiToolbar ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'text-[#444746] dark:text-[#e3e3e3] hover:bg-[#f1f3f4] dark:hover:bg-[#303134]'}`}
                    >
                        <Bot className="w-4 h-4" />
                        <span className="text-[12px] font-medium hidden sm:inline">AI Tools</span>
                    </button>
                </div>

                {/* AI Auxiliary Toolbar */}
                {showAiToolbar && (
                    <div className="flex flex-wrap items-center gap-2 px-6 py-2 bg-purple-50/50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/30 shadow-inner">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mr-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Magic
                        </span>

                        {isStreaming ? (
                            <button
                                onClick={stop}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-[13px] font-medium transition-colors flex items-center"
                            >
                                <Square className="w-3.5 h-3.5 mr-1.5" /> Stop Generation
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleSummarize}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center"
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Summarize Document
                                </button>
                                <button
                                    onClick={() => handleAiAction('improve')}
                                    disabled={editor.state.selection.empty}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Improve Selection
                                </button>
                                <button
                                    onClick={() => handleAiAction('fix')}
                                    disabled={editor.state.selection.empty}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-[13px] font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Fix Selection
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>


            {/* Editor Canvas Area */}
            <div className="flex-1 overflow-y-auto w-full relative pb-16 pt-2 bg-[#f8f9fa] dark:bg-[#1a1a1a] custom-scrollbar">

                {/* BubbleMenu - Text Selection Toolbar */}
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        tippyOptions={{ duration: 150, animation: 'fade' }}
                        className="bg-white/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-200/50 dark:border-gray-700/50 rounded-[8px] overflow-hidden flex divide-x divide-gray-100 dark:divide-gray-800 pl-1"
                    >
                        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
                            <Bold className="w-[16px] h-[16px]" />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
                            <Italic className="w-[16px] h-[16px]" />
                        </ToolbarButton>

                        <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] mx-1 self-center" />

                        <button
                            onClick={() => handleAiAction('improve')}
                            disabled={isStreaming}
                            className="flex items-center gap-1.5 px-3 py-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors"
                        >
                            {aiAction === 'improve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Improve
                        </button>
                        <button
                            onClick={() => handleAiAction('fix')}
                            disabled={isStreaming}
                            className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                        >
                            {aiAction === 'fix' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                            Fix
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
                        className="bg-white/95 dark:bg-[#202124]/95 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-200 dark:border-[#5f6368] rounded-[8px] overflow-hidden min-w-[220px]"
                    >
                        {floatingMode === 'menu' && (
                            <div className="flex flex-col py-1.5 min-w-[200px]">
                                <button
                                    onClick={() => setFloatingMode('prompt')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-[13px] font-medium text-purple-600 dark:text-purple-400 transition-colors text-left"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Help me write...
                                </button>
                                <button
                                    onClick={handleContinueWriting}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                >
                                    {aiAction === 'continue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    Continue writing
                                </button>
                                <button
                                    onClick={() => setFloatingMode('translate')}
                                    disabled={isStreaming}
                                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                >
                                    <Languages className="w-4 h-4" />
                                    Translate...
                                </button>
                            </div>
                        )}

                        {floatingMode === 'prompt' && (
                            <div className="flex items-center gap-2 p-1.5 min-w-[350px]">
                                <Sparkles className="w-4 h-4 text-purple-500 ml-2 shrink-0" />
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
                                    className="flex-1 border-none bg-transparent text-[13px] focus:outline-none px-2 py-1.5 text-[#202124] dark:text-[#e8eaed] placeholder-[#80868b] dark:placeholder-[#9aa0a6]"
                                />
                                <button
                                    onClick={handleHelpMeWrite}
                                    disabled={!promptValue.trim() || isStreaming}
                                    className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-30 transition-colors"
                                >
                                    {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => { setFloatingMode('menu'); setPromptValue(''); }}
                                    className="p-1.5 rounded-md text-[#5f6368] dark:text-[#9aa0a6] hover:bg-gray-100 dark:hover:bg-[#303134] transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {floatingMode === 'translate' && (
                            <div className="flex flex-col py-1 min-w-[180px]">
                                <div className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6] font-semibold">Translate to</div>
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleTranslate(lang.code, lang.label)}
                                        disabled={isStreaming}
                                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#444746] dark:text-[#e3e3e3] transition-colors text-left"
                                    >
                                        {lang.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setFloatingMode('menu')}
                                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] text-[#5f6368] dark:text-[#9aa0a6] transition-colors text-left border-t border-[#e3e3e3] dark:border-[#3c4043] mt-1"
                                >
                                    <X className="w-4 h-4" />
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
