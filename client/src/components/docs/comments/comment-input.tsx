'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CommentInputProps {
  placeholder?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CommentInput({
  placeholder = 'Ecrire un commentaire...',
  onSubmit,
  onCancel,
  autoFocus = false,
  compact = false,
  className,
}: CommentInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel?.();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'resize-none text-sm',
          compact ? 'min-h-[60px]' : 'min-h-[100px]'
        )}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Ctrl+Entree pour envoyer
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
          )}
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={!content.trim()}
          >
            <Send className="h-4 w-4 mr-1" />
            {compact ? 'Repondre' : 'Commenter'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CommentInput;
