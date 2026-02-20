'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import { useYjsDocument } from '@/hooks/use-yjs-document';
import { useAuthStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, StopCircle, Type } from 'lucide-react';
import { useAiStream } from '@/hooks/use-ai-stream';
import { toast } from 'sonner';

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

    // AI state
    const [aiQuery, setAiQuery] = useState('');
    const [isAiOpen, setIsAiOpen] = useState(false);
    const { stream, stop, isStreaming } = useAiStream();

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
        editable: isSynced,
    });

    useEffect(() => {
        if (editor && !editorReady && isSynced) {
            setEditorReady(true);
        }
    }, [editor, isSynced, editorReady]);

    const handleAiGenerate = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!aiQuery.trim() || !editor) return;

        // Ensure we are inserting at current position or at the end
        if (!editor.isFocused) {
            editor.commands.focus();
        }

        // Add a newline before AI content if needed
        editor.commands.insertContent(' ');

        await stream(
            `Write content for a document based on this prompt: ${aiQuery}`,
            {
                onToken: (token) => {
                    // Tiptap insert text directly
                    editor.commands.insertContent(token);
                },
                onDone: () => {
                    setAiQuery('');
                    setIsAiOpen(false);
                },
                onError: (err) => {
                    toast.error(`AI Error: ${err}`);
                },
            },
            {
                systemPrompt: "You are an expert writing assistant. Provide direct, formatting-friendly plain text without filler phrases like 'Here is the content'. Output the direct requested content.",
                language: 'en'
            }
        );
    }, [aiQuery, editor, stream]);

    const stopAi = useCallback(() => {
        stop();
        toast.info("AI generation stopped.");
    }, [stop]);

    // Handle selection changes for awareness manually if needed
    // (useEditor handles it normally, but doing it explicitly here)
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
            <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-xl border border-border">
                <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground mt-4 text-sm font-medium">Initializing collaborative workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="border border-border rounded-xl overflow-hidden glass-panel flex flex-col h-full bg-card">
            {/* Toolbar */}
            <div className="bg-muted/30 border-b border-border p-2 flex items-center gap-1 overflow-x-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}
                >
                    <strong className="font-bold font-serif text-lg">B</strong>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}
                >
                    <em className="font-serif text-lg">I</em>
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}
                >
                    <Type className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-2" />

                {/* AI Help Me Write Tool */}
                <Popover open={isAiOpen} onOpenChange={setIsAiOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:hover:bg-purple-900/50 dark:border-purple-800 dark:text-purple-300 shadow-sm transition-all group"
                        >
                            <Sparkles className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                            Help me write
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-3 glass" align="start">
                        {isStreaming ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 animate-pulse" />
                                    AI is writing...
                                </p>
                                <Button size="sm" variant="destructive" className="w-full" onClick={stopAi}>
                                    <StopCircle className="h-4 w-4 mr-2" /> Stop Generation
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleAiGenerate} className="grid gap-3">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" /> Ask Assistant
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Describe what you want to add to your document.
                                    </p>
                                </div>
                                <Input
                                    autoFocus
                                    placeholder="e.g., Write an intro about our new Q3 roadmap..."
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                    className="h-9 focus-visible:ring-purple-500"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                    disabled={!aiQuery.trim()}
                                >
                                    Generate
                                </Button>
                            </form>
                        )}
                    </PopoverContent>
                </Popover>

                {/* Sync indicator */}
                <div className="ml-auto flex items-center gap-2 px-2 bg-background/50 rounded-full py-1 border border-border">
                    <div
                        className={`w-2 h-2 rounded-full ${isSynced ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'
                            }`}
                    />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
                        {isSynced ? 'Synced' : 'Syncing'}
                    </span>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto cursor-text bg-background">
                <EditorContent
                    editor={editor}
                    className="prose prose-sm dark:prose-invert max-w-none p-6 min-h-[500px] focus:outline-none focus-visible:outline-none"
                    onClick={() => editor.commands.focus()}
                />
            </div>

            {/* Collaborators indicator */}
            {awareness && (
                <div className="bg-muted/20 border-t border-border p-2 flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Present:</span>
                    <div className="flex gap-1.5 -space-x-2 *:ring-2 *:ring-background">
                        {Array.from(awareness.getStates().values()).map((state: any, idx) => (
                            <div
                                key={idx}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm hover:scale-110 transition-transform cursor-default relative group"
                                style={{
                                    backgroundColor: state.user?.color || '#ccc',
                                }}
                            >
                                {state.user?.name?.[0]?.toUpperCase() || '?'}
                                <div className="absolute -top-8 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                    {state.user?.name || 'Unknown'}
                                </div>
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
