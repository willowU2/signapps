"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  Loader2,
  Sparkles,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi, calendarApi } from "@/lib/api";
import { useEvents } from "@/hooks/use-events";
import { CreateEvent } from "@/types/calendar";

interface SuggestedSlot {
  start_time: string;
  end_time: string;
  score: number;
  reason: string;
}

interface FindSlotProps {
  calendarId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindSlot({ calendarId, open, onOpenChange }: FindSlotProps) {
  const { createEvent, events } = useEvents(calendarId);

  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [participants, setParticipants] = useState("");
  const [constraints, setConstraints] = useState("");
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SuggestedSlot | null>(null);

  const handleFindSlots = async () => {
    if (!description.trim()) {
      toast.error("Please describe the meeting");
      return;
    }

    setIsLoading(true);
    setSuggestedSlots([]);
    setSelectedSlot(null);

    try {
      // Build calendar context from existing events
      const now = new Date();
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 14);

      const existingEvents = events
        .filter((e) => {
          const start = new Date(e.start_time);
          return start >= now && start <= nextWeek;
        })
        .map((e) => ({
          title: e.title,
          start: e.start_time,
          end: e.end_time,
          is_all_day: e.is_all_day,
        }));

      const prompt = `You are a scheduling assistant. Based on the existing calendar events and the meeting requirements, suggest 3 optimal time slots for the next 2 weeks.

Current date/time: ${now.toISOString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Existing calendar events (next 2 weeks):
${JSON.stringify(existingEvents, null, 2)}

Meeting requirements:
- Description: ${description}
- Duration: ${duration} minutes
${participants ? `- Participants: ${participants}` : ""}
${constraints ? `- Constraints: ${constraints}` : ""}

Rules:
- Avoid scheduling over existing events
- Prefer business hours (9:00-18:00) unless specified otherwise
- Consider reasonable gaps between meetings (at least 15 min)
- Score each slot from 0 to 100 based on quality

Return ONLY valid JSON array with exactly 3 suggestions:
[{"start_time": "ISO8601", "end_time": "ISO8601", "score": number, "reason": "brief explanation"}]`;

      const response = await aiApi.chat(prompt, {
        systemPrompt:
          "You are a scheduling AI. Return only valid JSON, no markdown.",
      });

      try {
        const jsonMatch = response.data.answer.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const slots: SuggestedSlot[] = JSON.parse(jsonMatch[0]);
          setSuggestedSlots(slots.sort((a, b) => b.score - a.score));
          toast.success(`Found ${slots.length} available slots`);
        } else {
          toast.error("AI could not find available slots");
        }
      } catch {
        toast.error("Failed to parse slot suggestions");
      }
    } catch (error) {
      toast.error("Failed to analyze calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async (slot: SuggestedSlot) => {
    setIsCreating(true);
    setSelectedSlot(slot);

    try {
      const eventData: CreateEvent = {
        title: description,
        description: participants ? `Participants: ${participants}` : undefined,
        start_time: slot.start_time,
        end_time: slot.end_time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      await createEvent(eventData);
      toast.success("Event created successfully");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error("Impossible de créer event");
    } finally {
      setIsCreating(false);
      setSelectedSlot(null);
    }
  };

  const resetForm = () => {
    setDescription("");
    setDuration("60");
    setParticipants("");
    setConstraints("");
    setSuggestedSlots([]);
    setSelectedSlot(null);
  };

  const formatSlotTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Find a Slot with AI
          </DialogTitle>
          <DialogDescription>
            Describe your meeting and let AI find the best time slots
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meeting description */}
          <div className="space-y-2">
            <Label htmlFor="slot-description">Meeting Description *</Label>
            <Input
              id="slot-description"
              placeholder="e.g., Weekly team standup"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="slot-duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration (minutes)
            </Label>
            <Input
              id="slot-duration"
              type="number"
              min={15}
              max={480}
              step={15}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label
              htmlFor="slot-participants"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Participants (optional)
            </Label>
            <Input
              id="slot-participants"
              placeholder="e.g., Alice, Bob, Charlie"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          {/* Constraints */}
          <div className="space-y-2">
            <Label htmlFor="slot-constraints">
              Additional Constraints (optional)
            </Label>
            <Textarea
              id="slot-constraints"
              placeholder="e.g., Must be in the morning, avoid Mondays..."
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={2}
            />
          </div>

          {/* Find slots button */}
          <Button
            onClick={handleFindSlots}
            disabled={isLoading || !description.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing calendar...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Find Available Slots
              </>
            )}
          </Button>

          {/* Suggested slots */}
          {suggestedSlots.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold">Suggested Time Slots</h3>
              {suggestedSlots.map((slot, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedSlot === slot ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => !isCreating && handleCreateEvent(slot)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {formatSlotTime(slot.start_time)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            to
                          </span>
                          <span className="text-sm font-medium">
                            {formatSlotTime(slot.end_time)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {slot.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              slot.score >= 80
                                ? "bg-green-500"
                                : slot.score >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                          />
                          <span className="text-xs font-semibold">
                            {slot.score}%
                          </span>
                        </div>
                        {isCreating && selectedSlot === slot ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground text-center">
                Click a slot to create the event
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
