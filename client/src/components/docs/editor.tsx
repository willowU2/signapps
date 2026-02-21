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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { SlashCommands, getSuggestionOptions } from './slash-commands';
import { Comment } from './comment-extension';
import { v4 as uuidv4 } from 'uuid';
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
    Menu,
    Bot,
    Code,
    FileImage,
    Smile,
    MessageSquare,
    MessageSquarePlus,
    Trash2
} from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai-stream';
import { toast } from 'sonner';

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const lowlight = createLowlight(common);

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

    // Cover & Icon states
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [docIcon, setDocIcon] = useState<string>('\ud83d\udcc4');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_WS_URL || 'ws://localhost:3010/api/v1/docs/text';

        const wsProvider = new WebsocketProvider(baseUrl, documentId, ydoc, { connect: false });

        // Check if server is reachable before connecting
        const httpUrl = baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        fetch(httpUrl, { method: 'HEAD' })
            .then(() => wsProvider.connect())
            .catch(() => console.warn(`[Docs Editor] Collaboration server at ${baseUrl} is offline. Running in local-only mode.`));

        wsProvider.on('status', (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
            setStatus(event.status);
        });

        setProvider(wsProvider);

        return () => {
            wsProvider.destroy();
        };
    }, [documentId, ydoc]);

    // Table of Contents state
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);

    // Comments state
    const [comments, setComments] = useState<{ id: string, text: string, author: string, timestamp: number }[]>([]);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(true);

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
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            SlashCommands.configure({
                suggestion: getSuggestionOptions([
                    {
                        title: 'Heading 1',
                        description: 'Big section heading.',
                        icon: <Heading1 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                        },
                    },
                    {
                        title: 'Heading 2',
                        description: 'Medium section heading.',
                        icon: <Heading2 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                        },
                    },
                    {
                        title: 'Heading 3',
                        description: 'Small section heading.',
                        icon: <Heading3 className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
                        },
                    },
                    {
                        title: 'Bullet List',
                        description: 'Create a simple bulleted list.',
                        icon: <List className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleBulletList().run();
                        },
                    },
                    {
                        title: 'Numbered List',
                        description: 'Create a list with numbering.',
                        icon: <ListOrdered className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                        },
                    },
                    {
                        title: 'To-do List',
                        description: 'Track tasks with a to-do list.',
                        icon: <CheckSquare className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleTaskList().run();
                        },
                    },
                    {
                        title: 'Code Block',
                        description: 'Capture a code snippet.',
                        icon: <Code className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
                        },
                    },
                    {
                        title: 'Image',
                        description: 'Upload or embed an image.',
                        icon: <ImageIcon className="w-4 h-4" />,
                        command: ({ editor, range }: any) => {
                            const url = window.prompt('Image URL');
                            if (url) {
                                editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
                            } else {
                                editor.chain().focus().deleteRange(range).run();
                            }
                        },
                    },
                    {
                        title: 'Ask AI',
                        description: 'Generate text using AI.',
                        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
                        command: ({ editor, range }: any) => {
                            editor.chain().focus().deleteRange(range).run();
                            setTimeout(() => {
                                setFloatingMode('prompt');
                            }, 50);
                        },
                    },
                ]),
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
            Comment,
            Collaboration.configure({
                document: ydoc || undefined,
            }),
            ...(provider ? [
                CollaborationCursor.configure({
                    provider: provider,
                    user: {
                        name: userName || 'Anonymous',
                        color: getRandomColor(),
                    },
                })
            ] : []),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] transition-colors font-sans text-[11pt] leading-[1.6]',
            },
        },
        onUpdate: ({ editor }) => {
            const headings: { id: string, text: string, level: number }[] = [];
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'heading') {
                    const id = `heading-${pos}`;
                    headings.push({
                        id,
                        text: node.textContent,
                        level: node.attrs.level,
                    });
                }
            });
            setToc(headings);
        }
    }, [ydoc, provider]);

    // Initial TOC processing
    useEffect(() => {
        if (!editor) return;
        const headings: { id: string, text: string, level: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
                const id = `heading-${pos}`;
                headings.push({
                    id,
                    text: node.textContent,
                    level: node.attrs.level,
                });
            }
        });
        setToc(headings);
    }, [editor]);

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
            <div className="flex-1 overflow-y-auto w-full relative pb-16 custom-scrollbar bg-white dark:bg-[#1b1b1b] flex flex-row">
                <div className="flex-1 min-w-0">
                    {/* Notion-style Cover */}
                    {coverImage ? (
                        <div className="relative h-[30vh] min-h-[200px] w-full group">
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={() => {
                                        const url = window.prompt('Cover Image URL (e.g., Unsplash):');
                                        if (url) setCoverImage(url);
                                    }}
                                    className="px-3 py-1.5 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded text-xs font-medium border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-white dark:hover:bg-black"
                                >
                                    Change cover
                                </button>
                                <button
                                    onClick={() => setCoverImage(null)}
                                    className="px-3 py-1.5 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded text-xs font-medium border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-white dark:hover:bg-black"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-16 w-full group relative transition-all max-w-[900px] mx-auto px-12 pt-8">
                            <button
                                onClick={() => {
                                    // Default nice gradient cover
                                    setCoverImage('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop');
                                }}
                                className="absolute bottom-0 left-12 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <FileImage className="w-4 h-4" /> Add cover
                            </button>
                        </div>
                    )}

                    {/* Main Content Area constrained like Notion */}
                    <div className="max-w-[900px] mx-auto px-12 sm:px-[var(--editor-padding,4rem)] relative">

                        {/* Notion-style Icon */}
                        <div className={`relative group ${coverImage ? '-mt-12 mb-4' : 'mt-4 mb-2'}`}>
                            <button
                                className="text-6xl hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors -ml-2 select-none relative z-10"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            >
                                {docIcon}
                                <div className="absolute top-0 right-0 p-1 bg-white dark:bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 shadow-sm text-gray-400">
                                    <Smile className="w-3 h-3" />
                                </div>
                            </button>
                            {showEmojiPicker && (
                                <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-[#202124] border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-3 grid grid-cols-5 gap-2 w-[240px]">
                                    {['\ud83d\udcc4', '\ud83d\udcd8', '\u2728', '\ud83d\ude80', '\ud83d\udca1', '\ud83c\udf10', '\ud83d\udcca', '\ud83d\udcbb', '\ud83d\udcf0', '\ud83d\udcdd'].map(emoji => (
                                        <button
                                            key={emoji}
                                            className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1"
                                            onClick={() => { setDocIcon(emoji); setShowEmojiPicker(false); }}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>


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
                                    onClick={() => {
                                        const commentId = uuidv4();
                                        editor.chain().focus().setComment(commentId).run();
                                        setComments(prev => [...prev, { id: commentId, text: '', author: userName || 'Anonymous', timestamp: Date.now() }]);
                                        setActiveCommentId(commentId);
                                        setShowComments(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-100 dark:hover:bg-[#303134] text-[13px] font-medium text-[#444746] dark:text-[#e3e3e3] transition-colors"
                                >
                                    <MessageSquarePlus className="w-3.5 h-3.5" />
                                    Comment
                                </button>

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

                {/* Table of Contents Sidebar */}
                <div className="hidden lg:block w-[240px] shrink-0 border-l border-gray-100 dark:border-gray-800/50 p-6 pt-12 overflow-y-auto max-h-full sticky top-0 custom-scrollbar">
                    {toc.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">On this page</h3>
                            <nav className="flex flex-col gap-1.5">
                                {toc.map((heading) => (
                                    <button
                                        key={heading.id}
                                        onClick={() => {
                                            // Extract pos from heading.id (e.g. "heading-123" -> 123)
                                            const pos = parseInt(heading.id.split('-')[1]);
                                            if (!isNaN(pos) && editor) {
                                                // Set cursor to the heading
                                                editor.chain().focus().setTextSelection(pos).run();
                                                // Scroll into view (Tiptap handles this automatically with focus)
                                            }
                                        }}
                                        className={`text-left text-[13px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate
                                            ${heading.level === 1 ? 'font-medium text-gray-800 dark:text-gray-200 mt-2' : ''}
                                            ${heading.level === 2 ? 'text-gray-600 dark:text-gray-400 ml-3' : ''}
                                            ${heading.level === 3 ? 'text-gray-500 dark:text-gray-500 ml-6' : ''}
                                        `}
                                    >
                                        {heading.text || 'Untitled page section'}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}

                    {/* Comments Section */}
                    {showComments && comments.length > 0 && (
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Comments</h3>
                                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{comments.length}</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`p-3 rounded-lg border text-sm transition-all relative group
                                            ${activeCommentId === comment.id
                                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202124] hover:border-gray-300 dark:hover:border-gray-700'
                                            }
                                        `}
                                        onClick={() => setActiveCommentId(comment.id)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-[13px] text-gray-800 dark:text-gray-200">{comment.author}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-500">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (editor) {
                                                            editor.chain().focus().unsetComment(comment.id).run();
                                                        }
                                                        setComments(prev => prev.filter(c => c.id !== comment.id));
                                                        if (activeCommentId === comment.id) setActiveCommentId(null);
                                                    }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={comment.text}
                                            onChange={(e) => {
                                                const newText = e.target.value;
                                                setComments(prev => prev.map(c => c.id === comment.id ? { ...c, text: newText } : c));
                                            }}
                                            placeholder="Add a comment..."
                                            className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300 min-h-[40px] text-[13px]"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Editor;
