'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { usersApi, type User } from '@/lib/api/identity';
import { MentionBadge } from './mention-badge';

// ============================================================================
// Types
// ============================================================================

export interface MentionedUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: MentionedUser[]) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  rows?: number;
}

// ============================================================================
// Component
// ============================================================================

export const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = 'Tapez @ pour mentionner...',
      className,
      autoFocus = false,
      rows = 3,
    },
    ref
  ) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentions, setMentions] = useState<MentionedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    // Search users when query changes
    useEffect(() => {
      if (!query) {
        setUsers([]);
        return;
      }

      const abortController = new AbortController();
      setIsLoading(true);

      usersApi
        .list(1, 10)
        .then((response) => {
          if (abortController.signal.aborted) return;
          const ud = response.data as { users?: User[] } | User[];
          const allUsers = (ud as { users?: User[] })?.users || (Array.isArray(ud) ? ud : []);
          const filtered = allUsers.filter(
            (u: User) =>
              u.username.toLowerCase().includes(query.toLowerCase()) ||
              (u.display_name || '').toLowerCase().includes(query.toLowerCase())
          );
          setUsers(filtered.slice(0, 8));
          setSelectedIndex(0);
          setIsLoading(false);
        })
        .catch(() => {
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        });

      return () => abortController.abort();
    }, [query]);

    // Detect @ trigger in text
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;

        // Look for @ trigger
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
          setQuery(mentionMatch[1]);
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
          setQuery('');
        }

        onChange(newValue, mentions);
      },
      [onChange, mentions]
    );

    // Insert mention
    const insertMention = useCallback(
      (user: User) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const textAfterCursor = value.slice(cursorPos);

        // Replace @query with @username
        const mentionStart = textBeforeCursor.lastIndexOf('@');
        const before = value.slice(0, mentionStart);
        const mentionText = `@${user.username} `;
        const newValue = before + mentionText + textAfterCursor;

        const mentionedUser: MentionedUser = {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        };

        const newMentions = [...mentions, mentionedUser];
        setMentions(newMentions);
        onChange(newValue, newMentions);
        setShowDropdown(false);
        setQuery('');

        // Re-focus textarea after insert
        requestAnimationFrame(() => {
          textarea.focus();
          const newPos = before.length + mentionText.length;
          textarea.setSelectionRange(newPos, newPos);
        });
      },
      [value, mentions, onChange, textareaRef]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showDropdown && users.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % users.length);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertMention(users[selectedIndex]);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setShowDropdown(false);
            return;
          }
        }

        // Submit on Ctrl+Enter
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [showDropdown, users, selectedIndex, insertMention, onSubmit]
    );

    return (
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('resize-none', className)}
          autoFocus={autoFocus}
          rows={rows}
        />

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[240px] overflow-y-auto"
          >
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Recherche...
              </div>
            ) : users.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Aucun utilisateur trouve
              </div>
            ) : (
              users.map((user, index) => (
                <button
                  key={user.id}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => insertMention(user)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {(user.display_name || user.username)
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">
                      {user.display_name || user.username}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = 'MentionInput';

export default MentionInput;
