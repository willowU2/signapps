'use client';

import { useState, useEffect } from 'react';
import { UserPlus, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usersApi, type User } from '@/lib/api/identity';

// ============================================================================
// Types
// ============================================================================

export interface TaskAssigneeSelectorProps {
  /** Currently assigned user ID */
  assigneeId?: string | null;
  /** Currently assigned user (if already loaded) */
  assignee?: User | null;
  /** Callback when assignee changes */
  onAssigneeChange: (userId: string | null, user: User | null) => void;
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TaskAssigneeSelector({
  assigneeId,
  assignee: initialAssignee,
  onAssigneeChange,
  size = 'md',
  className,
}: TaskAssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assignee, setAssignee] = useState<User | null>(initialAssignee || null);

  // Load user if we have an ID but no user object
  useEffect(() => {
    if (assigneeId && !assignee) {
      usersApi
        .get(assigneeId)
        .then((res) => setAssignee(res.data))
        .catch(() => {});
    }
  }, [assigneeId, assignee]);

  // Load users for the dropdown
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    usersApi
      .list(1, 50)
      .then((response) => {
        const allUsers = response.data?.users || response.data || [];
        setUsers(allUsers);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [open]);

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(search.toLowerCase()) ||
          (u.display_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const handleSelect = (user: User) => {
    setAssignee(user);
    onAssigneeChange(user.id, user);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignee(null);
    onAssigneeChange(null, null);
  };

  const avatarSize = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start gap-2 font-normal',
            size === 'sm' && 'h-7 px-2',
            !assignee && 'text-muted-foreground',
            className
          )}
        >
          {assignee ? (
            <>
              <Avatar className={avatarSize}>
                <AvatarImage src={assignee.avatar_url} />
                <AvatarFallback className="text-[10px]">
                  {(assignee.display_name || assignee.username)
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={cn('truncate', textSize)}>
                {assignee.display_name || assignee.username}
              </span>
              <X
                className="h-3 w-3 ml-auto shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span className={textSize}>Assigner</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
              autoFocus
            />
          </div>
        </div>

        {/* User list */}
        <ScrollArea className="max-h-[240px]">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Chargement...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Aucun utilisateur trouve
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  user.id === assigneeId && 'bg-accent/50'
                )}
                onClick={() => handleSelect(user)}
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
        </ScrollArea>

        {/* Unassign option */}
        {assignee && (
          <div className="border-t p-1">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              onClick={() => {
                setAssignee(null);
                onAssigneeChange(null, null);
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
              Retirer l&apos;assignation
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default TaskAssigneeSelector;
