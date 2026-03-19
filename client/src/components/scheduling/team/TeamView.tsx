'use client';

/**
 * TeamView Component
 *
 * Main view for team availability and scheduling.
 * Shows team members with their status and a timeline for finding free slots.
 */

import * as React from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  LayoutGrid,
  Clock,
  Users,
  Video,
  Plus,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  TeamMemberCard,
  TeamMemberCardCompact,
} from './TeamMemberCard';
import { TeamTimeline } from './TeamTimeline';
import { EventSheet } from '../calendar/EventSheet';
import {
  useTeamMembers,
  useAvailabilitySlots,
} from '@/lib/scheduling/api/team';
import { useEvents, useCreateEvent } from '@/lib/scheduling/api/calendar';
import type {
  TeamMember,
  AvailabilitySlot,
  CreateEventInput,
} from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface TeamViewProps {
  className?: string;
}

type ViewMode = 'grid' | 'timeline';

// ============================================================================
// Status Filter Options
// ============================================================================

const statusOptions: { value: AvailabilitySlot['status']; label: string }[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'busy', label: 'Occupé' },
  { value: 'tentative', label: 'Peut-être' },
  { value: 'out-of-office', label: 'Absent' },
];

// ============================================================================
// Main Component
// ============================================================================

export function TeamView({ className }: TeamViewProps) {
  const router = useRouter();

  // State
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [search, setSearch] = React.useState('');
  const [selectedStatuses, setSelectedStatuses] = React.useState<
    AvailabilitySlot['status'][]
  >([]);
  const [selectedDepartments, setSelectedDepartments] = React.useState<string[]>([]);
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Event Sheet State
  const [showEventSheet, setShowEventSheet] = React.useState(false);
  const [eventSheetMember, setEventSheetMember] = React.useState<TeamMember | null>(null);
  const [eventSheetDate, setEventSheetDate] = React.useState<Date | undefined>();
  const [eventSheetTime, setEventSheetTime] = React.useState<string | undefined>();

  // Message Dialog State
  const [showMessageDialog, setShowMessageDialog] = React.useState(false);
  const [messageMember, setMessageMember] = React.useState<TeamMember | null>(null);
  const [messageContent, setMessageContent] = React.useState('');
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);

  // Data
  const { data: members = [], isLoading: membersLoading } = useTeamMembers();
  const { data: slots = [], isLoading: slotsLoading } = useAvailabilitySlots(currentDate);
  const { data: events = [], isLoading: eventsLoading } = useEvents({
    start: currentDate,
    end: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
  });

  // Mutations
  const createEvent = useCreateEvent();

  // Get unique departments
  const departments = React.useMemo(() => {
    const depts = new Set<string>();
    members.forEach((m) => {
      if (m.department) depts.add(m.department);
    });
    return Array.from(depts);
  }, [members]);

  // Get current status for a member
  const getMemberStatus = (memberId: string): AvailabilitySlot['status'] => {
    const now = new Date();
    const slot = slots.find(
      (s) =>
        s.memberId === memberId &&
        new Date(s.start) <= now &&
        new Date(s.end) >= now
    );
    return slot?.status ?? 'available';
  };

  // Filter members
  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !m.name.toLowerCase().includes(searchLower) &&
          !m.email.toLowerCase().includes(searchLower) &&
          !m.role?.toLowerCase().includes(searchLower) &&
          !m.department?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (selectedStatuses.length > 0) {
        const status = getMemberStatus(m.id);
        if (!selectedStatuses.includes(status)) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartments.length > 0) {
        if (!m.department || !selectedDepartments.includes(m.department)) {
          return false;
        }
      }

      return true;
    });
  }, [members, search, selectedStatuses, selectedDepartments, slots]);

  // Handlers
  const handleScheduleMeeting = (member: TeamMember) => {
    // Open meeting creation dialog with member pre-selected
    setEventSheetMember(member);
    setEventSheetDate(new Date());
    setEventSheetTime(undefined);
    setShowEventSheet(true);
  };

  const handleViewCalendar = (member: TeamMember) => {
    // Navigate to calendar page filtered by team member
    router.push(`/cal?member=${member.id}&view=week`);
  };

  const handleSendMessage = (member: TeamMember) => {
    // Open messaging dialog
    setMessageMember(member);
    setMessageContent('');
    setShowMessageDialog(true);
  };

  const handleTimelineSlotClick = (member: TeamMember, time: Date) => {
    // Open meeting creation with pre-filled time and member
    setEventSheetMember(member);
    setEventSheetDate(time);
    setEventSheetTime(format(time, 'HH:mm'));
    setShowEventSheet(true);
  };

  const handleEventSave = async (event: CreateEventInput) => {
    // Add the selected member as attendee if not already included
    const attendees = event.attendees || [];
    if (eventSheetMember && !attendees.includes(eventSheetMember.email)) {
      attendees.push(eventSheetMember.email);
    }

    await createEvent.mutateAsync({
      calendarId: event.calendarId || 'default',
      input: { ...event, attendees },
    });

    setShowEventSheet(false);
    setEventSheetMember(null);
  };

  const handleSendMessageSubmit = async () => {
    if (!messageMember || !messageContent.trim()) return;

    setIsSendingMessage(true);
    try {
      // Navigate to chat with the member
      // For now, we'll open a direct message channel
      router.push(`/chat/dm/${messageMember.id}?message=${encodeURIComponent(messageContent)}`);
      setShowMessageDialog(false);
      setMessageMember(null);
      setMessageContent('');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isLoading = membersLoading || slotsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">
          Chargement de l'équipe...
        </div>
      </div>
    );
  }

  // Stats
  const availableCount = filteredMembers.filter(
    (m) => getMemberStatus(m.id) === 'available'
  ).length;
  const busyCount = filteredMembers.filter(
    (m) => getMemberStatus(m.id) === 'busy'
  ).length;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtres
              {(selectedStatuses.length > 0 || selectedDepartments.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {selectedStatuses.length + selectedDepartments.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Statut</DropdownMenuLabel>
            {statusOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedStatuses.includes(opt.value)}
                onCheckedChange={(checked) => {
                  setSelectedStatuses(
                    checked
                      ? [...selectedStatuses, opt.value]
                      : selectedStatuses.filter((s) => s !== opt.value)
                  );
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
            {departments.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Département</DropdownMenuLabel>
                {departments.map((dept) => (
                  <DropdownMenuCheckboxItem
                    key={dept}
                    checked={selectedDepartments.includes(dept)}
                    onCheckedChange={(checked) => {
                      setSelectedDepartments(
                        checked
                          ? [...selectedDepartments, dept]
                          : selectedDepartments.filter((d) => d !== dept)
                      );
                    }}
                  >
                    {dept}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Stats */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {availableCount} dispo.
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {busyCount} occupé
          </span>
        </div>

        {/* View Mode */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Quick Actions */}
        <Button size="sm">
          <Video className="h-4 w-4 mr-2" />
          Planifier
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {viewMode === 'grid' && (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMembers.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  currentStatus={getMemberStatus(member.id)}
                  onScheduleMeeting={handleScheduleMeeting}
                  onViewCalendar={handleViewCalendar}
                  onSendMessage={handleSendMessage}
                />
              ))}
              {filteredMembers.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  Aucun membre trouvé
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {viewMode === 'timeline' && (
          <TeamTimeline
            members={filteredMembers}
            slots={slots}
            events={events}
            date={currentDate}
            onDateChange={setCurrentDate}
            onSlotClick={handleTimelineSlotClick}
            className="h-full"
          />
        )}
      </div>

      {/* Event Sheet for scheduling meetings */}
      <EventSheet
        isOpen={showEventSheet}
        onClose={() => {
          setShowEventSheet(false);
          setEventSheetMember(null);
        }}
        defaultDate={eventSheetDate}
        defaultTime={eventSheetTime}
        onSave={handleEventSave}
      />

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {messageMember && (
                <>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={messageMember.avatarUrl} alt={messageMember.name} />
                    <AvatarFallback>{getInitials(messageMember.name)}</AvatarFallback>
                  </Avatar>
                  <span>Message à {messageMember.name}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Envoyez un message direct à ce membre de l'équipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Écrivez votre message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="min-h-[120px]"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowMessageDialog(false);
                setMessageMember(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSendMessageSubmit}
              disabled={!messageContent.trim() || isSendingMessage}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSendingMessage ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamView;
