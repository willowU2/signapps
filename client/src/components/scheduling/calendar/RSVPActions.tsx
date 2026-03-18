'use client';

/**
 * RSVP Actions Components
 *
 * Components for responding to event invitations and displaying RSVP status.
 */

import * as React from 'react';
import { Check, X, HelpCircle, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RSVPStatus, Attendee } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface RSVPButtonsProps {
  currentStatus?: RSVPStatus;
  onResponse: (status: RSVPStatus, declineReason?: string) => void;
  isLoading?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

interface RSVPSummaryProps {
  attendees: Attendee[];
  showDetails?: boolean;
  className?: string;
}

interface RSVPBadgeProps {
  status: RSVPStatus;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
  RSVPStatus,
  { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  accepted: { label: 'Accepté', icon: Check, variant: 'default' },
  declined: { label: 'Refusé', icon: X, variant: 'destructive' },
  tentative: { label: 'Peut-être', icon: HelpCircle, variant: 'secondary' },
  pending: { label: 'En attente', icon: Clock, variant: 'outline' },
};

// ============================================================================
// RSVPBadge
// ============================================================================

export function RSVPBadge({ status, className }: RSVPBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ============================================================================
// RSVPButtons
// ============================================================================

export function RSVPButtons({
  currentStatus = 'pending',
  onResponse,
  isLoading = false,
  size = 'default',
  className,
}: RSVPButtonsProps) {
  const [showDeclineDialog, setShowDeclineDialog] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState('');

  const handleAccept = () => {
    onResponse('accepted');
  };

  const handleTentative = () => {
    onResponse('tentative');
  };

  const handleDeclineClick = () => {
    setShowDeclineDialog(true);
  };

  const handleDeclineConfirm = () => {
    onResponse('declined', declineReason.trim() || undefined);
    setShowDeclineDialog(false);
    setDeclineReason('');
  };

  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2', className)}>
        {/* Accept */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentStatus === 'accepted' ? 'default' : 'outline'}
              size={buttonSize}
              onClick={handleAccept}
              disabled={isLoading}
              className={cn(
                currentStatus === 'accepted' && 'bg-green-600 hover:bg-green-700'
              )}
            >
              <Check className={iconSize} />
              <span className="ml-1.5">Accepter</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Je participerai</TooltipContent>
        </Tooltip>

        {/* Tentative */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentStatus === 'tentative' ? 'secondary' : 'outline'}
              size={buttonSize}
              onClick={handleTentative}
              disabled={isLoading}
            >
              <HelpCircle className={iconSize} />
              <span className="ml-1.5">Peut-être</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Je ne suis pas sûr(e)</TooltipContent>
        </Tooltip>

        {/* Decline */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentStatus === 'declined' ? 'destructive' : 'outline'}
              size={buttonSize}
              onClick={handleDeclineClick}
              disabled={isLoading}
            >
              <X className={iconSize} />
              <span className="ml-1.5">Refuser</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Je ne participerai pas</TooltipContent>
        </Tooltip>

        {/* Decline Dialog */}
        <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Refuser l'invitation</DialogTitle>
              <DialogDescription>
                Vous pouvez ajouter une raison pour votre refus (optionnel).
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="decline-reason">Raison (optionnel)</Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Ex: Je suis en congé ce jour-là..."
                className="mt-2"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeclineConfirm}>
                Confirmer le refus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// RSVPSummary
// ============================================================================

export function RSVPSummary({
  attendees,
  showDetails = false,
  className,
}: RSVPSummaryProps) {
  const summary = React.useMemo(() => {
    const result = {
      accepted: [] as Attendee[],
      declined: [] as Attendee[],
      tentative: [] as Attendee[],
      pending: [] as Attendee[],
    };

    for (const attendee of attendees) {
      const status = attendee.status || 'pending';
      result[status].push(attendee);
    }

    return result;
  }, [attendees]);

  const total = attendees.length;
  const respondedCount = total - summary.pending.length;

  if (total === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        Aucun participant
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {respondedCount}/{total} réponse{respondedCount !== 1 ? 's' : ''}
          </span>
        </div>

        {summary.accepted.length > 0 && (
          <Badge variant="default" className="bg-green-600 gap-1">
            <Check className="h-3 w-3" />
            {summary.accepted.length}
          </Badge>
        )}

        {summary.tentative.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            <HelpCircle className="h-3 w-3" />
            {summary.tentative.length}
          </Badge>
        )}

        {summary.declined.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            {summary.declined.length}
          </Badge>
        )}

        {summary.pending.length > 0 && (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {summary.pending.length}
          </Badge>
        )}
      </div>

      {/* Detailed list */}
      {showDetails && (
        <div className="space-y-2">
          {/* Accepted */}
          {summary.accepted.length > 0 && (
            <AttendeeGroup
              title="Participent"
              attendees={summary.accepted}
              icon={Check}
              iconClassName="text-green-600"
            />
          )}

          {/* Tentative */}
          {summary.tentative.length > 0 && (
            <AttendeeGroup
              title="Peut-être"
              attendees={summary.tentative}
              icon={HelpCircle}
              iconClassName="text-yellow-600"
            />
          )}

          {/* Declined */}
          {summary.declined.length > 0 && (
            <AttendeeGroup
              title="Ne participent pas"
              attendees={summary.declined}
              icon={X}
              iconClassName="text-destructive"
            />
          )}

          {/* Pending */}
          {summary.pending.length > 0 && (
            <AttendeeGroup
              title="En attente de réponse"
              attendees={summary.pending}
              icon={Clock}
              iconClassName="text-muted-foreground"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AttendeeGroup (internal)
// ============================================================================

interface AttendeeGroupProps {
  title: string;
  attendees: Attendee[];
  icon: React.ElementType;
  iconClassName?: string;
}

function AttendeeGroup({ title, attendees, icon: Icon, iconClassName }: AttendeeGroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn('h-3 w-3', iconClassName)} />
        {title}
      </div>
      <div className="flex flex-wrap gap-1 pl-5">
        {attendees.map((attendee) => (
          <TooltipProvider key={attendee.id}>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  {attendee.name || attendee.email}
                  {!attendee.required && (
                    <span className="text-muted-foreground ml-1">(opt.)</span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p>{attendee.email}</p>
                  {attendee.respondedAt && (
                    <p className="text-muted-foreground">
                      Répondu le {new Date(attendee.respondedAt).toLocaleDateString('fr')}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// RSVPInline (compact version for event cards)
// ============================================================================

interface RSVPInlineProps {
  status: RSVPStatus;
  onResponse: (status: RSVPStatus) => void;
  isLoading?: boolean;
  className?: string;
}

export function RSVPInline({ status, onResponse, isLoading, className }: RSVPInlineProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onResponse('accepted')}
        disabled={isLoading}
        className={cn(
          'p-1 rounded hover:bg-green-100 transition-colors',
          status === 'accepted' && 'bg-green-100 text-green-600'
        )}
        title="Accepter"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onResponse('tentative')}
        disabled={isLoading}
        className={cn(
          'p-1 rounded hover:bg-yellow-100 transition-colors',
          status === 'tentative' && 'bg-yellow-100 text-yellow-600'
        )}
        title="Peut-être"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onResponse('declined')}
        disabled={isLoading}
        className={cn(
          'p-1 rounded hover:bg-red-100 transition-colors',
          status === 'declined' && 'bg-red-100 text-red-600'
        )}
        title="Refuser"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default RSVPButtons;
