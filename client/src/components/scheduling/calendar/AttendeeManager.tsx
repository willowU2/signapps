'use client';

/**
 * Attendee Manager Component
 *
 * Interface for managing event attendees with search, add, remove, and RSVP tracking.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  X,
  Search,
  User,
  Mail,
  Check,
  Clock,
  HelpCircle,
  UserPlus,
  Users,
  Crown,
  Star,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RSVPBadge } from './RSVPActions';
import type { Attendee, RSVPStatus, TeamMember } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface AttendeeManagerProps {
  /** Current attendees */
  attendees: Attendee[];
  /** Callback when attendees change */
  onChange: (attendees: Attendee[]) => void;
  /** Organizer ID (cannot be removed) */
  organizerId?: string;
  /** Available team members to suggest */
  teamMembers?: TeamMember[];
  /** Maximum number of attendees */
  maxAttendees?: number;
  /** Whether the manager is read-only */
  readOnly?: boolean;
  /** Custom class name */
  className?: string;
}

interface AttendeeInputProps {
  onAdd: (attendee: Partial<Attendee>) => void;
  teamMembers: TeamMember[];
  existingIds: string[];
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_ICONS: Record<RSVPStatus, React.ElementType> = {
  accepted: Check,
  declined: X,
  tentative: HelpCircle,
  pending: Clock,
};

const STATUS_COLORS: Record<RSVPStatus, string> = {
  accepted: 'text-green-600',
  declined: 'text-red-600',
  tentative: 'text-yellow-600',
  pending: 'text-muted-foreground',
};

// ============================================================================
// Helpers
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function generateAttendeeId(): string {
  return `attendee-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// AttendeeManager Component
// ============================================================================

export function AttendeeManager({
  attendees,
  onChange,
  organizerId,
  teamMembers = [],
  maxAttendees = 50,
  readOnly = false,
  className,
}: AttendeeManagerProps) {
  const [showAddInput, setShowAddInput] = React.useState(false);

  // Stats
  const stats = React.useMemo(() => {
    const result = {
      total: attendees.length,
      accepted: 0,
      declined: 0,
      tentative: 0,
      pending: 0,
      required: 0,
      optional: 0,
    };

    for (const a of attendees) {
      const status = a.status || 'pending';
      result[status]++;
      if (a.required) result.required++;
      else result.optional++;
    }

    return result;
  }, [attendees]);

  // Add attendee
  const handleAdd = (partial: Partial<Attendee>) => {
    if (attendees.length >= maxAttendees) return;

    const newAttendee: Attendee = {
      id: partial.id || generateAttendeeId(),
      name: partial.name || '',
      email: partial.email || '',
      status: partial.status || 'pending',
      required: partial.required ?? true,
    };

    // Check for duplicates
    if (attendees.some((a) => a.email === newAttendee.email || a.id === newAttendee.id)) {
      return;
    }

    onChange([...attendees, newAttendee]);
    setShowAddInput(false);
  };

  // Remove attendee
  const handleRemove = (attendeeId: string) => {
    if (attendeeId === organizerId) return;
    onChange(attendees.filter((a) => a.id !== attendeeId));
  };

  // Toggle required status
  const handleToggleRequired = (attendeeId: string) => {
    onChange(
      attendees.map((a) =>
        a.id === attendeeId ? { ...a, required: !a.required } : a
      )
    );
  };

  // Set as organizer
  const handleSetOrganizer = (_attendeeId: string) => {
    // This would typically call a parent callback — no-op until wired up
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Participants ({stats.total})
        </Label>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {stats.accepted > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              {stats.accepted}
            </span>
          )}
          {stats.tentative > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <HelpCircle className="h-3 w-3" />
              {stats.tentative}
            </span>
          )}
          {stats.declined > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <X className="h-3 w-3" />
              {stats.declined}
            </span>
          )}
          {stats.pending > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stats.pending}
            </span>
          )}
        </div>
      </div>

      {/* Attendee list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {attendees.map((attendee) => (
          <AttendeeRow
            key={attendee.id}
            attendee={attendee}
            isOrganizer={attendee.id === organizerId}
            onRemove={() => handleRemove(attendee.id)}
            onToggleRequired={() => handleToggleRequired(attendee.id)}
            onSetOrganizer={() => handleSetOrganizer(attendee.id)}
            readOnly={readOnly}
          />
        ))}

        {attendees.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Aucun participant ajouté
          </div>
        )}
      </div>

      {/* Add attendee */}
      {!readOnly && (
        <>
          {showAddInput ? (
            <AttendeeInput
              onAdd={handleAdd}
              teamMembers={teamMembers}
              existingIds={attendees.map((a) => a.id)}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAddInput(true)}
              disabled={attendees.length >= maxAttendees}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un participant
            </Button>
          )}
        </>
      )}

      {/* Max attendees warning */}
      {attendees.length >= maxAttendees && (
        <p className="text-xs text-muted-foreground text-center">
          Nombre maximum de participants atteint ({maxAttendees})
        </p>
      )}
    </div>
  );
}

// ============================================================================
// AttendeeRow Component
// ============================================================================

interface AttendeeRowProps {
  attendee: Attendee;
  isOrganizer: boolean;
  onRemove: () => void;
  onToggleRequired: () => void;
  onSetOrganizer: () => void;
  readOnly: boolean;
}

function AttendeeRow({
  attendee,
  isOrganizer,
  onRemove,
  onToggleRequired,
  onSetOrganizer,
  readOnly,
}: AttendeeRowProps) {
  const StatusIcon = STATUS_ICONS[attendee.status || 'pending'];

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
      {/* Avatar */}
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">
          {getInitials(attendee.name || attendee.email)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {attendee.name || attendee.email}
          </span>
          {isOrganizer && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Crown className="h-3 w-3 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>Organisateur</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!attendee.required && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              Opt.
            </Badge>
          )}
        </div>
        {attendee.name && (
          <p className="text-xs text-muted-foreground truncate">
            {attendee.email}
          </p>
        )}
      </div>

      {/* Status */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <StatusIcon
              className={cn('h-4 w-4', STATUS_COLORS[attendee.status || 'pending'])}
            />
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <RSVPBadge status={attendee.status || 'pending'} />
              {attendee.respondedAt && (
                <p className="mt-1 text-muted-foreground">
                  {format(new Date(attendee.respondedAt), "d MMM 'à' HH:mm", {
                    locale: fr,
                  })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Actions */}
      {!readOnly && !isOrganizer && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleRequired}>
              {attendee.required ? (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Marquer optionnel
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2 fill-current" />
                  Marquer requis
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Retirer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ============================================================================
// AttendeeInput Component
// ============================================================================

function AttendeeInput({ onAdd, teamMembers, existingIds }: AttendeeInputProps) {
  const [searchValue, setSearchValue] = React.useState('');
  const [emailInput, setEmailInput] = React.useState('');
  const [showEmailInput, setShowEmailInput] = React.useState(false);

  // Filter available members
  const availableMembers = teamMembers.filter(
    (m) => !existingIds.includes(m.id)
  );

  // Filter by search
  const filteredMembers = availableMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      m.email.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Handle member selection
  const handleSelectMember = (member: TeamMember) => {
    onAdd({
      id: member.id,
      name: member.name,
      email: member.email,
      required: true,
    });
  };

  // Handle email input
  const handleAddByEmail = () => {
    if (!emailInput.trim() || !emailInput.includes('@')) return;
    onAdd({
      email: emailInput.trim(),
      name: '',
      required: true,
    });
    setEmailInput('');
    setShowEmailInput(false);
  };

  return (
    <div className="space-y-2 p-2 border rounded-lg bg-muted/30">
      {!showEmailInput ? (
        <Command className="rounded-lg border shadow-none">
          <CommandInput
            placeholder="Rechercher un participant..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-40">
            <CommandEmpty>
              <div className="py-2 text-center text-sm text-muted-foreground">
                Aucun résultat
                <Button
                  variant="link"
                  size="sm"
                  className="block mx-auto"
                  onClick={() => setShowEmailInput(true)}
                >
                  Ajouter par email
                </Button>
              </div>
            </CommandEmpty>
            {filteredMembers.length > 0 && (
              <CommandGroup heading="Membres de l'équipe">
                {filteredMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    onSelect={() => handleSelectMember(member)}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Ajouter par email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="email@exemple.com"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddByEmail();
              }}
            />
            <Button size="sm" onClick={handleAddByEmail}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowEmailInput(false)}
          >
            Retour à la recherche
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AttendeeListCompact (for inline display)
// ============================================================================

interface AttendeeListCompactProps {
  attendees: Attendee[];
  maxDisplay?: number;
  className?: string;
}

export function AttendeeListCompact({
  attendees,
  maxDisplay = 4,
  className,
}: AttendeeListCompactProps) {
  const displayAttendees = attendees.slice(0, maxDisplay);
  const remaining = attendees.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center -space-x-2', className)}>
        {displayAttendees.map((attendee) => (
          <Tooltip key={attendee.id}>
            <TooltipTrigger>
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback className="text-xs">
                  {getInitials(attendee.name || attendee.email)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">{attendee.name || attendee.email}</p>
                <RSVPBadge status={attendee.status || 'pending'} />
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback className="text-xs bg-muted">
                  +{remaining}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                {attendees.slice(maxDisplay).map((a) => (
                  <p key={a.id}>{a.name || a.email}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AttendeeManager;
