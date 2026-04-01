import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Mail } from "lucide-react";
import { calendarApi } from "@/lib/api";

export interface Attendee {
  id: string;
  event_id: string;
  user_id: string;
  email?: string;
  name?: string;
  rsvp_status: "pending" | "accepted" | "declined";
}

interface AttendeeListProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendees: Attendee[];
  onAttendeesChange: (attendees: Attendee[]) => void;
}

const rsvpColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
};

export function AttendeeList({
  eventId,
  open,
  onOpenChange,
  attendees,
  onAttendeesChange,
}: AttendeeListProps) {
  const [email, setEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>(attendees);
  useEffect(() => {
    setLocalAttendees(attendees);
  }, [attendees]);

  const handleAddAttendee = async () => {
    if (!email.trim()) return;

    try {
      setIsAdding(true);
      const response = await calendarApi.post(
        `/events/${eventId}/attendees`,
        {
          email: email,
          rsvp_status: "pending",
        }
      );

      const newAttendee: Attendee = {
        id: response.data.id,
        event_id: eventId,
        user_id: response.data.user_id ?? "",
        email: email,
        rsvp_status: "pending",
      };

      const updated = [...localAttendees, newAttendee];
      setLocalAttendees(updated);
      onAttendeesChange(updated);
      setEmail("");
    } catch {
      // ignore
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    try {
      await calendarApi.delete(`/attendees/${attendeeId}`);

      const updated = localAttendees.filter((a) => a.id !== attendeeId);
      setLocalAttendees(updated);
      onAttendeesChange(updated);
    } catch {
      // ignore
    }
  };

  const handleUpdateRSVP = async (
    attendeeId: string,
    status: "pending" | "accepted" | "declined"
  ) => {
    try {
      await calendarApi.put(
        `/attendees/${attendeeId}/rsvp`,
        { rsvp_status: status }
      );

      const updated = localAttendees.map((a) =>
        a.id === attendeeId ? { ...a, rsvp_status: status } : a
      );
      setLocalAttendees(updated);
      onAttendeesChange(updated);
    } catch {
      // ignore
    }
  };

  const rsvpStats = {
    accepted: localAttendees.filter((a) => a.rsvp_status === "accepted").length,
    declined: localAttendees.filter((a) => a.rsvp_status === "declined").length,
    pending: localAttendees.filter((a) => a.rsvp_status === "pending").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Event Attendees</DialogTitle>
          <DialogDescription>
            Manage invitations and RSVP responses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* RSVP Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-700">
                {rsvpStats.accepted}
              </p>
              <p className="text-xs text-green-600">Accepted</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded">
              <p className="text-2xl font-bold text-yellow-700">
                {rsvpStats.pending}
              </p>
              <p className="text-xs text-yellow-600">Pending</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <p className="text-2xl font-bold text-red-700">
                {rsvpStats.declined}
              </p>
              <p className="text-xs text-red-600">Declined</p>
            </div>
          </div>

          {/* Add attendee */}
          <div className="space-y-3 border-b pb-6">
            <Label htmlFor="attendee-email" className="text-sm font-medium">
              Add Attendee
            </Label>
            <div className="flex gap-2">
              <Input
                id="attendee-email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleAddAttendee();
                }}
              />
            </div>
            <Button
              onClick={handleAddAttendee}
              disabled={!email.trim() || isAdding}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Invite
            </Button>
          </div>

          {/* Attendees list */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Attendees</Label>
            {localAttendees.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                No attendees added yet
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {localAttendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-3 rounded border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attendee.name || attendee.email}
                      </p>
                      {attendee.email && attendee.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {attendee.email}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={attendee.rsvp_status}
                        onValueChange={(v: any) =>
                          handleUpdateRSVP(attendee.id, v)
                        }
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAttendee(attendee.id)}
                        className="h-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 rounded text-xs text-blue-900 flex gap-2">
            <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Invitations will be sent to attendees. They can respond with their RSVP
              status.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
