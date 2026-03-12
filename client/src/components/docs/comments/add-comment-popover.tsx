'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AddCommentPopoverProps {
    onSubmit: (content: string) => void;
    onCancel: () => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    className?: string;
}

export function AddCommentPopover({
    onSubmit,
    onCancel,
    isOpen,
    onOpenChange,
    className,
}: AddCommentPopoverProps) {
    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (content.trim()) {
            onSubmit(content.trim());
            setContent('');
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        setContent('');
        onCancel();
        onOpenChange(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn('gap-1', className)}
                    title="Ajouter un commentaire (Ctrl+Alt+M)"
                >
                    <MessageSquarePlus className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Commenter</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-3"
                align="end"
                side="bottom"
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Nouveau commentaire</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handleCancel}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <Textarea
                        ref={textareaRef}
                        placeholder="Écrire un commentaire..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="min-h-[100px] resize-none"
                    />

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Ctrl+Entrée pour envoyer
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancel}
                            >
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={!content.trim()}
                            >
                                <Send className="h-4 w-4 mr-1" />
                                Commenter
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default AddCommentPopover;
