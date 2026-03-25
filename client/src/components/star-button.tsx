'use client';

import { Star } from 'lucide-react';
import { useStarredStore, type StarredItem } from '@/stores/starred-store';
import { cn } from '@/lib/utils';

interface StarButtonProps {
  item: Omit<StarredItem, 'starredAt'>;
  className?: string;
}

export function StarButton({ item, className }: StarButtonProps) {
  const { toggle, isStarred } = useStarredStore();
  const starred = isStarred(item.id);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(item); }}
      className={cn(
        'p-1 rounded-md transition-colors hover:bg-accent',
        className
      )}
      title={starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Star
        className={cn(
          'h-4 w-4 transition-colors',
          starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
        )}
      />
    </button>
  );
}
