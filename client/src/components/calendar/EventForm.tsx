"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { useEvents } from "@/hooks/use-events";
import { Event, CreateEvent, UpdateEvent } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ResourceSelector } from "./ResourceSelector";
import { AttendeeList } from "./AttendeeList";
import { Users, Package } from "lucide-react";

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEvent?: Event;
  calendarId: string;
  defaultStartDate?: Date;
}

export function EventForm({
  open,
  onOpenChange,
  initialEvent,
  calendarId,
  defaultStartDate,
}: EventFormProps) {
  const { createEvent, updateEvent, deleteEvent } = useEvents(calendarId);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Omit<CreateEvent | UpdateEvent, "rrule" | "timezone">> & {
    rrule?: string;
    timezone?: string;
  }>(() => {
    if (initialEvent) {
      return {
        title: initialEvent.title,
        description: initialEvent.description,
        location: initialEvent.location,
        start_time: initialEvent.start_time,
        end_time: initialEvent.end_time,
        is_all_day: initialEvent.is_all_day,
        rrule: initialEvent.rrule,
        timezone: initialEvent.timezone,
      };
    }

    const start = defaultStartDate || new Date();
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    return {
      title: "",
      description: "",
      location: "",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_all_day: false,
      timezone: "UTC",
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [resourceSelectorOpen, setResourceSelectorOpen] = useState(false);
  const [attendeeListOpen, setAttendeeListOpen] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (initialEvent) {
        const updateData: UpdateEvent = {
          title: formData.title || undefined,
          description: formData.description || undefined,
          location: formData.location || undefined,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_all_day: formData.is_all_day,
        };
        await updateEvent(initialEvent.id, updateData);
        toast({ title: "Event updated successfully" });
      } else {
        const createData: CreateEvent = {
          title: formData.title || "Untitled Event",
          description: formData.description,
          location: formData.location,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_all_day: formData.is_all_day,
          timezone: formData.timezone,
        };
        await createEvent(createData);
        toast({ title: "Event created successfully" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialEvent) return;

    if (!confirm("Are you sure you want to delete this event?")) return;

    setIsSubmitting(true);
    try {
      await deleteEvent(initialEvent.id);
      toast({ title: "Event deleted successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialEvent ? "Edit Event" : "Create Event"}
          </DialogTitle>
          <DialogDescription>
            {initialEvent ? "Update event details" : "Add a new event to your calendar"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Event title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Add notes..."
              rows={3}
              value={formData.description || ""}
              onChange={handleInputChange}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              placeholder="Room or address"
              value={formData.location || ""}
              onChange={handleInputChange}
            />
          </div>

          {/* Start time */}
          <div className="space-y-2">
            <Label htmlFor="start_time">Start Date/Time</Label>
            <Input
              id="start_time"
              name="start_time"
              type="datetime-local"
              value={formData.start_time?.slice(0, 16)}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setFormData((prev) => ({
                  ...prev,
                  start_time: date.toISOString(),
                }));
              }}
            />
          </div>

          {/* End time */}
          <div className="space-y-2">
            <Label htmlFor="end_time">End Date/Time</Label>
            <Input
              id="end_time"
              name="end_time"
              type="datetime-local"
              value={formData.end_time?.slice(0, 16)}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setFormData((prev) => ({
                  ...prev,
                  end_time: date.toISOString(),
                }));
              }}
            />
          </div>

          {/* All day checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_all_day"
              checked={formData.is_all_day}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  is_all_day: e.target.checked,
                }))
              }
            />
            <Label htmlFor="is_all_day" className="font-normal cursor-pointer">
              All day event
            </Label>
          </div>

          {/* Resources section */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Resources
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResourceSelectorOpen(true)}
              >
                {selectedResourceIds.length > 0
                  ? `${selectedResourceIds.length} selected`
                  : "Add Resources"}
              </Button>
            </div>
            {selectedResourceIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedResourceIds.length} resource(s) will be booked for this event
              </div>
            )}
          </div>

          {/* Attendees section */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttendeeListOpen(true)}
              >
                {attendees.length > 0
                  ? `${attendees.length} invited`
                  : "Add Attendees"}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {initialEvent && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialEvent ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Resource Selector Dialog */}
    <ResourceSelector
      open={resourceSelectorOpen}
      onOpenChange={setResourceSelectorOpen}
      selectedResourceIds={selectedResourceIds}
      onResourcesSelected={setSelectedResourceIds}
      startTime={formData.start_time}
      endTime={formData.end_time}
    />

    {/* Attendee List Dialog */}
    <AttendeeList
      eventId={initialEvent?.id || ""}
      open={attendeeListOpen}
      onOpenChange={setAttendeeListOpen}
      attendees={attendees}
      onAttendeesChange={setAttendees}
    />
  );
}
