'use client';

import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquarePlus } from 'lucide-react';

interface AddCommentButtonProps {
  editor: Editor | null;
  onAddComment: (content: string) => void;
  disabled?: boolean;
}

export function AddCommentButton({ editor, onAddComment, disabled }: AddCommentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');

  const hasSelection = editor ? editor.state.selection.from !== editor.state.selection.to : false;

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;

    onAddComment(content.trim());
    setContent('');
    setIsOpen(false);
  }, [content, onAddComment]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-sm text-[#444746] dark:text-[#e8eaed]"
          disabled={disabled || !hasSelection}
          title={hasSelection ? 'Ajouter un commentaire' : 'Sélectionnez du texte pour commenter'}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Nouveau commentaire</h4>
            <p className="text-xs text-muted-foreground">
              Ajoutez un commentaire sur le texte sélectionné
            </p>
          </div>
          <Textarea
            autoFocus
            placeholder="Écrire un commentaire..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ctrl+Entrée pour envoyer
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setContent('');
                  setIsOpen(false);
                }}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim()}
              >
                Commenter
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AddCommentButton;
