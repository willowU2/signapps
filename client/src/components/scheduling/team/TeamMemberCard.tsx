"use client";

/**
 * TeamMemberCard Component
 *
 * Displays a team member with their current status and availability.
 */

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type {
  TeamMember,
  AvailabilitySlot,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface TeamMemberCardProps {
  member: TeamMember;
  currentStatus?: AvailabilitySlot["status"];
  nextAvailable?: Date;
  onScheduleMeeting?: (member: TeamMember) => void;
  onViewCalendar?: (member: TeamMember) => void;
  onSendMessage?: (member: TeamMember) => void;
  className?: string;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  AvailabilitySlot["status"],
  { label: string; color: string; bgColor: string }
> = {
  available: {
    label: "Disponible",
    color: "text-green-600",
    bgColor: "bg-green-500",
  },
  busy: {
    label: "Occupé",
    color: "text-red-600",
    bgColor: "bg-red-500",
  },
  tentative: {
    label: "Peut-être disponible",
    color: "text-amber-600",
    bgColor: "bg-amber-500",
  },
  "out-of-office": {
    label: "Absent",
    color: "text-slate-600",
    bgColor: "bg-slate-400",
  },
};

// ============================================================================
// Get Initials
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Main Component
// ============================================================================

export function TeamMemberCard({
  member,
  currentStatus = "available",
  nextAvailable,
  onScheduleMeeting,
  onViewCalendar,
  onSendMessage,
  className,
}: TeamMemberCardProps) {
  const status = statusConfig[currentStatus];

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar with status indicator */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.avatarUrl} alt={member.name} />
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                status.bgColor,
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{member.name}</CardTitle>
            <CardDescription className="text-sm">
              {member.role || member.department}
            </CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewCalendar?.(member)}>
                <Calendar className="h-4 w-4 mr-2" />
                Voir le calendrier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendMessage?.(member)}>
                <Mail className="h-4 w-4 mr-2" />
                Envoyer un message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Status */}
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn("font-normal", status.color)}
          >
            {status.label}
          </Badge>
          {currentStatus !== "available" && nextAvailable && (
            <span className="text-xs text-muted-foreground">
              Dispo. à {format(nextAvailable, "HH:mm", { locale: fr })}
            </span>
          )}
        </div>

        {/* Working Hours */}
        {member.workingHours && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {member.workingHours.schedule.monday?.start} -{" "}
              {member.workingHours.schedule.monday?.end}
            </span>
            <span className="text-muted-foreground/50">
              ({member.workingHours.timezone})
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onSendMessage?.(member)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onScheduleMeeting?.(member)}
          >
            <Video className="h-4 w-4 mr-2" />
            Réunion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function TeamMemberCardCompact({
  member,
  currentStatus = "available",
  onClick,
  className,
}: Pick<TeamMemberCardProps, "member" | "currentStatus" | "className"> & {
  onClick?: (member: TeamMember) => void;
}) {
  const status = statusConfig[currentStatus];

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
            className,
          )}
          onClick={() => onClick?.(member)}
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.avatarUrl} alt={member.name} />
              <AvatarFallback className="text-xs">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background",
                status.bgColor,
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{member.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {member.role}
            </p>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="flex gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={member.avatarUrl} alt={member.name} />
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="font-semibold">{member.name}</h4>
            <p className="text-sm text-muted-foreground">
              {member.role} {member.department && `• ${member.department}`}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {member.email}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ============================================================================
// Avatar Stack (for showing multiple team members)
// ============================================================================

export function TeamMemberAvatarStack({
  members,
  max = 4,
  size = "default",
  onClick,
}: {
  members: TeamMember[];
  max?: number;
  size?: "sm" | "default" | "lg";
  onClick?: (member: TeamMember) => void;
}) {
  const visibleMembers = members.slice(0, max);
  const remaining = members.length - max;

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    default: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  return (
    <div className="flex -space-x-2">
      {visibleMembers.map((member) => (
        <Avatar
          key={member.id}
          className={cn(
            sizeClasses[size],
            "border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110",
          )}
          onClick={() => onClick?.(member)}
        >
          <AvatarImage src={member.avatarUrl} alt={member.name} />
          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            sizeClasses[size],
            "flex items-center justify-center rounded-full border-2 border-background bg-muted font-medium",
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export default TeamMemberCard;
