'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { FontSize } from '../docs/extensions/font-size';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Comment } from '../docs/extensions/comment';
import { Mention } from '../docs/extensions/mention';
import { Insertion, Deletion, TrackChanges } from '../docs/extensions/track-changes';
import { createMentionSuggestion } from '@/hooks/use-mention-suggestions';
import { useYjsDocument } from '@/hooks/use-yjs-document';
import { useCollaborativeComments } from '@/hooks/use-collaborative-comments';
import { useTrackChanges } from '@/hooks/use-track-changes';
import { useAuthStore } from '@/lib/store';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, PencilLine, PanelRightOpen, MessageSquarePlus, Bold, Italic, Strikethrough, Eraser, Underline as UnderlineIcon } from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai-stream';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

import { DocumentHeader } from '../docs/editor/document-header';
import { EditorMenuBar } from '../docs/editor/editor-menu-bar';
import { EditorToolbar } from '../docs/editor/editor-toolbar';
import { CommentsSidebar } from '../docs/comments/comments-sidebar';
import { TrackChangesSidebar } from '../docs/track-changes/track-changes-sidebar';
import type { ExportComment } from '@/lib/api/office';
import type { CommentData } from '../docs/extensions/comment';

interface CollaborativeEditorProps {
    docId: string;
    onSynced?: () => void;
    placeholder?: string;
    title?: string;
}

export function CollaborativeEditor({
    docId,
    onSynced,
    placeholder = 'Commencez à taper...',
    title = 'Document sans titre',
}: CollaborativeEditorProps) {
    const { ydoc, provider, awareness, isSynced } = useYjsDocument(docId, {
        onSync: onSynced,
    });
    const { user } = useAuthStore();
    const [editorReady, setEditorReady] = useState(false);
    const [docTitle, setDocTitle] = useState(title);

    // AI state
    const [aiQuery, setAiQuery] = useState('');
    const { stream, stop, isStreaming } = useAiStream();
    
    const [isSaving, setIsSaving] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);

    // Close context menu on any click
    useEffect(() => {
        const handleGlobalClick = () => setContextMenu(null);
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

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
        immediatelyRender: false, // Required for SSR compatibility with Next.js
        extensions: [
            StarterKit.configure({
                undoRedo: false, // Yjs handles undo/redo
            }),
            Placeholder.configure({ placeholder }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Link.configure({ openOnClick: false }),
            Image,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            TextStyle,
            FontFamily.configure({
                types: ['textStyle'],
            }),
            FontSize.configure({
                types: ['textStyle'],
            }),
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            Comment.configure({
                HTMLAttributes: {
                    class: 'comment-highlight bg-yellow-100 dark:bg-yellow-900/30 border-b-2 border-yellow-400',
                },
            }),
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1 font-medium',
                },
                suggestion: createMentionSuggestion(),
            }),
            CharacterCount.configure({
                limit: null,
            }),
            // Track Changes extensions
            Insertion.configure({
                HTMLAttributes: {
                    class: 'track-insertion',
                },
            }),
            Deletion.configure({
                HTMLAttributes: {
                    class: 'track-deletion',
                },
            }),
            TrackChanges.configure({
                enabled: false,
                currentUser: {
                    id: user?.id || 'unknown',
                    name: user?.username || 'Anonyme',
                },
            }),
            ydoc ? Collaboration.configure({
                document: ydoc,
                provider: provider || undefined,
            }) : null,
        ].filter(Boolean) as any[],
        content: '',
        onUpdate: () => {
            // Auto-save logic could be added here
        },
        editable: isSynced,
        editorProps: {
            handleDOMEvents: {
                contextmenu: (view, event) => {
                    if (!view.state.selection.empty) {
                        event.preventDefault();
                        setContextMenu({ x: event.clientX, y: event.clientY });
                        return true;
                    }
                    return false;
                }
            }
        }
    });

    useEffect(() => {
        if (editor && !editorReady && isSynced) {
            setEditorReady(true);
        }
    }, [editor, isSynced, editorReady]);

    // Collaborative comments with real-time sync
    const {
        comments,
        activeCommentId,
        sidebarOpen,
        toggleSidebar,
        setSidebarOpen,
        addComment,
        deleteComment,
        resolveComment,
        reopenComment,
        addReply,
        setActiveComment,
        goToComment,
    } = useCollaborativeComments({
        ydoc,
        documentId: docId,
        editor,
    });

    // Track Changes
    const {
        enabled: trackChangesEnabled,
        showChanges: trackChangesShowChanges,
        pendingChanges: trackChangesPendingChanges,
        allChanges: trackChangesAllChanges,
        activeChangeId: trackChangesActiveChangeId,
        toggleEnabled: toggleTrackChanges,
        toggleShowChanges,
        acceptChange,
        rejectChange,
        acceptAllChanges,
        rejectAllChanges,
        goToChange: goToTrackChange,
    } = useTrackChanges({
        editor,
        documentId: docId,
    });

    // Track Changes Sidebar state
    const [trackChangesSidebarOpen, setTrackChangesSidebarOpen] = useState(false);
    const toggleTrackChangesSidebar = useCallback(() => {
        setTrackChangesSidebarOpen((prev) => !prev);
    }, []);

    // Handle reply from sidebar (with current user context)
    const handleReply = useCallback((commentId: string, content: string) => {
        addReply(commentId, content);
    }, [addReply]);

    const handleAiGenerate = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!aiQuery.trim() || !editor) return;

        if (!editor.isFocused) {
            editor.commands.focus();
        }

        editor.commands.insertContent(' ');

        await stream(
            `Write content for a document based on this prompt: ${aiQuery}`,
            {
                onToken: (token) => {
                    editor.commands.insertContent(token);
                },
                onDone: () => {
                    setAiQuery('');
                },
                onError: (err) => {
                    toast.error(`AI Error: ${err}`);
                },
            },
            {
                systemPrompt: "You are an expert writing assistant. Provide direct, formatting-friendly plain text without filler phrases.",
                language: 'fr'
            }
        );
    }, [aiQuery, editor, stream]);

    const stopAi = useCallback(() => {
        stop();
        toast.info("Génération d'IA arrêtée.");
    }, [stop]);

    useEffect(() => {
        if (!editor) return;
        const updateAwareness = () => {
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
        };
        editor.on('selectionUpdate', updateAwareness);
        return () => {
            editor.off('selectionUpdate', updateAwareness);
        };
    }, [editor, awareness, user]);

    if (!editor || !ydoc || !provider) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-muted dark:bg-gray-900 absolute inset-0">
                <div className="text-center">
                    <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className=" h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground mt-4 text-sm font-medium">Initialisation du document...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-[#f8f9fa] dark:bg-background overflow-hidden font-sans">
            {/* Header & Menus */}
            <div className="flex flex-col shrink-0 drop-shadow-sm z-20">
                <DocumentHeader
                    title={docTitle}
                    onTitleChange={setDocTitle}
                    isSynced={isSynced}
                    awarenessStates={awareness ? Array.from(awareness.getStates().values() as unknown as any[]) : []}
                    menuBar={<EditorMenuBar editor={editor} />}
                />

                <EditorToolbar
                    editor={editor}
                    documentTitle={docTitle}
                    isStreaming={isStreaming}
                    aiQuery={aiQuery}
                    setAiQuery={setAiQuery}
                    onAiGenerate={handleAiGenerate}
                    stopAi={stopAi}
                    onAddComment={addComment}
                    onToggleSidebar={toggleSidebar}
                    commentCount={comments.filter(c => !c.resolved).length}
                    exportComments={convertToExportComments(comments)}
                    // Track Changes
                    trackChangesEnabled={trackChangesEnabled}
                    trackChangesShowChanges={trackChangesShowChanges}
                    trackChangesPendingChanges={trackChangesPendingChanges}
                    onToggleTrackChanges={toggleTrackChanges}
                    onToggleShowChanges={toggleShowChanges}
                    onAcceptAllChanges={acceptAllChanges}
                    onRejectAllChanges={rejectAllChanges}
                    onAcceptChange={acceptChange}
                    onRejectChange={rejectChange}
                    onToggleTrackChangesSidebar={toggleTrackChangesSidebar}
                />
            </div>

            {/* Main Content Area with Sidebar */}
            <div className="flex-1 flex overflow-hidden">
                {/* Document Canvas Area */}
                <div className="flex-1 overflow-y-auto w-full flex justify-center py-6 px-4 cursor-text bg-[#f8f9fa] dark:bg-[#1f1f1f] relative">
                    
                    {contextMenu && (
                        <div 
                            className="fixed z-[100] min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <button
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 w-full"
                                onClick={() => editor?.chain().focus().toggleBold().run()}
                                disabled={!editor?.can().chain().focus().toggleBold().run()}
                            >
                                <Bold className="mr-2 h-4 w-4" />
                                <span>Gras</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘B</span>
                            </button>
                            <button
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 w-full"
                                onClick={() => editor?.chain().focus().toggleItalic().run()}
                                disabled={!editor?.can().chain().focus().toggleItalic().run()}
                            >
                                <Italic className="mr-2 h-4 w-4" />
                                <span>Italique</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘I</span>
                            </button>
                            <button
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 w-full"
                                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                                disabled={!editor?.can().chain().focus().toggleUnderline().run()}
                            >
                                <UnderlineIcon className="mr-2 h-4 w-4" />
                                <span>Souligné</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘U</span>
                            </button>
                            <button
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 w-full"
                                onClick={() => editor?.chain().focus().toggleStrike().run()}
                                disabled={!editor?.can().chain().focus().toggleStrike().run()}
                            >
                                <Strikethrough className="mr-2 h-4 w-4" />
                                <span>Barré</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘⇧X</span>
                            </button>
                            <div className="-mx-1 my-1 h-px bg-border" />
                            <button
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 w-full"
                                onClick={() => editor?.chain().focus().unsetAllMarks().run()}
                            >
                                <Eraser className="mr-2 h-4 w-4" />
                                <span>Effacer le formatage</span>
                            </button>
                        </div>
                    )}

                    <div className="w-[816px] shrink-0 min-h-[1056px] bg-background dark:bg-[#1f1f1f] shadow-[0_1px_3px_auto_rgba(0,0,0,0.1)] ring-1 ring-[#e2e2e2] dark:ring-[#ffffff1a] rounded-sm relative mt-2 mb-10 block">
                            <EditorContent
                                editor={editor}
                                className="prose prose-sm md:prose-base dark:prose-invert max-w-none px-[96px] py-[96px] min-h-full focus:outline-none focus-visible:outline-none placeholder:text-[#5f6368] dark:placeholder:text-[#9aa0a6] text-[11pt] [&_.comment-highlight]:bg-yellow-100 [&_.comment-highlight]:dark:bg-yellow-900/30 [&_.comment-highlight]:border-b-2 [&_.comment-highlight]:border-yellow-400"
                            />

                            {/* Floating Canvas AI Buttons (visible when empty) */}
                            {editor.isEmpty && (
                                <div className="absolute top-[300px] left-0 right-0 flex items-center justify-center gap-2 z-10 select-none pointer-events-none">
                                    <Button
                                        variant="secondary"
                                        className="bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full shadow-sm font-medium h-[36px] px-5 pointer-events-auto transition-colors"
                                    >
                                        <Sparkles className="h-[18px] w-[18px] mb-0.5 mr-2 text-[#0b57d0]" fill="#0b57d0" />
                                        Générer un document
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full shadow-sm font-medium h-[36px] px-5 pointer-events-auto transition-colors"
                                    >
                                        <PencilLine className="h-[18px] w-[18px] mb-0.5 mr-2 text-[#0b57d0]" fill="#0b57d0" />
                                        M'aider à écrire
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="bg-background hover:bg-muted text-[#444746] rounded-full shadow-sm ring-1 ring-[#dadce0] font-medium h-[36px] px-4 pointer-events-auto transition-colors"
                                    >
                                        <PanelRightOpen className="h-[18px] w-[18px] mb-0.5 mr-2" />
                                        Plus
                                    </Button>
                                </div>
                            )}

                            {/* Floating Right Page Action Buttons */}
                            <div className="absolute top-[300px] -right-12 hidden xl:flex flex-col gap-2 items-center">
                                <div className="bg-background dark:bg-[#202124] rounded-full shadow-sm ring-1 ring-[#dadce0] dark:ring-[#5f6368] p-1.5 flex flex-col items-center">
                                    <Button variant="ghost" size="icon" className="h-[36px] w-[36px] rounded-full text-[#1a73e8] hover:bg-[#e8f0fe] dark:hover:bg-[#1a73e820]">
                                        <PencilLine className="h-[18px] w-[18px]" />
                                    </Button>
                                    <div className="h-[1px] w-6 bg-[#dadce0] dark:bg-[#5f6368] my-0.5" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-[36px] w-[36px] rounded-full text-[#1a73e8] hover:bg-[#e8f0fe] dark:hover:bg-[#1a73e820]"
                                        onClick={toggleSidebar}
                                    >
                                        <MessageSquarePlus className="h-[18px] w-[18px]" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                </div>

                {/* Comments Sidebar */}
                {sidebarOpen && (
                    <CommentsSidebar
                        comments={comments}
                        activeCommentId={activeCommentId}
                        onCommentClick={goToComment}
                        onResolve={resolveComment}
                        onReopen={reopenComment}
                        onReply={handleReply}
                        onDelete={deleteComment}
                        className="w-[320px] shrink-0"
                    />
                )}

                {/* Track Changes Sidebar */}
                {trackChangesSidebarOpen && (
                    <TrackChangesSidebar
                        changes={trackChangesAllChanges}
                        activeChangeId={trackChangesActiveChangeId}
                        onChangeClick={goToTrackChange}
                        onAcceptChange={acceptChange}
                        onRejectChange={rejectChange}
                        onAcceptAll={acceptAllChanges}
                        onRejectAll={rejectAllChanges}
                        onClose={toggleTrackChangesSidebar}
                        className="w-[320px] shrink-0"
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Convert internal CommentData to ExportComment format for DOCX export
 */
function convertToExportComments(comments: CommentData[]): ExportComment[] {
    return comments.map((c) => ({
        id: c.id,
        author: c.author,
        content: c.content,
        created_at: c.createdAt,
        resolved: c.resolved,
        replies: c.replies?.map((r) => ({
            author: r.author,
            content: r.content,
            created_at: r.createdAt,
        })),
    }));
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
