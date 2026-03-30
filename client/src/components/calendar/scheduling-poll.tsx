"use client";

import React, { useState, useCallback, useMemo } from "react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  HelpCircle,
  Users,
  Link2,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { calendarApi } from "@/lib/api/calendar";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimeSlot {
  id: string;
  date: string; // ISO date string
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export type VoteValue = "yes" | "maybe" | "no";

export interface PollVote {
  participantName: string;
  participantEmail: string;
  votes: Record<string, VoteValue>; // slotId → vote
  submittedAt: string;
}

export interface SchedulePoll {
  id: string;
  title: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  slots: TimeSlot[];
  participants: string[]; // emails
  votes: PollVote[];
  confirmedSlotId: string | null;
  createdAt: string;
  status: "open" | "confirmed" | "closed";
}

// ── Storage helpers ────────────────────────────────────────────────────────

const POLLS_KEY = "signapps_schedule_polls";

export function getPolls(): SchedulePoll[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(POLLS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getPoll(id: string): SchedulePoll | null {
  return getPolls().find((p) => p.id === id) || null;
}

export function savePoll(poll: SchedulePoll): void {
  const polls = getPolls();
  const idx = polls.findIndex((p) => p.id === poll.id);
  if (idx >= 0) {
    polls[idx] = poll;
    calendarApi.put(`/polls/${poll.id}`, poll).catch(() => {});
  } else {
    polls.push(poll);
    calendarApi.post('/polls', poll).catch(() => {});
  }
  localStorage.setItem(POLLS_KEY, JSON.stringify(polls));
}

// ── Create Poll Dialog ─────────────────────────────────────────────────────

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (poll: SchedulePoll) => void;
}

export function CreatePollDialog({ open, onOpenChange, onCreated }: CreatePollDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [participantEmail, setParticipantEmail] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [newSlotDate, setNewSlotDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("10:00");

  const reset = useCallback(() => {
    setStep(1);
    setTitle("");
    setDescription("");
    setOrganizerName("");
    setOrganizerEmail("");
    setSlots([]);
    setParticipantEmail("");
    setParticipants([]);
  }, []);

  const addSlot = () => {
    if (!newSlotDate || !newSlotStart || !newSlotEnd) return;
    setSlots((prev) => [
      ...prev,
      { id: uuidv4().slice(0, 8), date: newSlotDate, startTime: newSlotStart, endTime: newSlotEnd },
    ]);
  };

  const removeSlot = (id: string) => setSlots((prev) => prev.filter((s) => s.id !== id));

  const addParticipant = () => {
    const email = participantEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (participants.includes(email)) return;
    setParticipants((prev) => [...prev, email]);
    setParticipantEmail("");
  };

  const removeParticipant = (email: string) =>
    setParticipants((prev) => prev.filter((p) => p !== email));

  const handleCreate = () => {
    const poll: SchedulePoll = {
      id: uuidv4().slice(0, 12),
      title,
      description,
      organizerName,
      organizerEmail,
      slots,
      participants,
      votes: [],
      confirmedSlotId: null,
      createdAt: new Date().toISOString(),
      status: "open",
    };
    savePoll(poll);
    toast.success("Sondage créé");
    onCreated?.(poll);
    reset();
    onOpenChange(false);
  };

  const canProceedStep1 = title.trim().length > 0 && organizerName.trim().length > 0;
  const canProceedStep2 = slots.length >= 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Create Availability Poll
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3 &mdash;{" "}
            {step === 1 ? "Details" : step === 2 ? "Time Slots" : "Participants"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poll-title">Title *</Label>
              <Input
                id="poll-title"
                placeholder="Team sync, Lunch meetup..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poll-desc">Description</Label>
              <Textarea
                id="poll-desc"
                placeholder="What is this meeting about?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="org-name">Your name *</Label>
                <Input
                  id="org-name"
                  placeholder="Alice Dupont"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Your email</Label>
                <Input
                  id="org-email"
                  type="email"
                  placeholder="alice@company.com"
                  value={organizerEmail}
                  onChange={(e) => setOrganizerEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Time Slots ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newSlotDate}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                />
              </div>
              <div className="space-y-1 w-24">
                <Label className="text-xs">From</Label>
                <Input
                  type="time"
                  value={newSlotStart}
                  onChange={(e) => setNewSlotStart(e.target.value)}
                />
              </div>
              <div className="space-y-1 w-24">
                <Label className="text-xs">To</Label>
                <Input
                  type="time"
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                />
              </div>
              <Button type="button" size="icon" variant="outline" onClick={addSlot}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {slots.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Add at least 2 time slots for participants to vote on.
              </p>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm"
                >
                  <span className="font-medium">
                    {format(new Date(slot.date), "EEE dd MMM", { locale: fr })}
                  </span>
                  <span className="text-muted-foreground">
                    {slot.startTime} &ndash; {slot.endTime}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeSlot(slot.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Participants ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="bob@company.com"
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParticipant())}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {participants.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button
                    type="button"
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    onClick={() => removeParticipant(email)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Optionally add participant emails. Anyone with the link can also vote.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            >
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleCreate}>
              Create Poll
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Poll Vote View ─────────────────────────────────────────────────────────

interface PollVoteViewProps {
  pollId: string;
}

export function PollVoteView({ pollId }: PollVoteViewProps) {
  const [poll, setPoll] = useState<SchedulePoll | null>(() => getPoll(pollId));
  const [voterName, setVoterName] = useState("");
  const [voterEmail, setVoterEmail] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [submitted, setSubmitted] = useState(false);

  const toggleVote = (slotId: string) => {
    setVotes((prev) => {
      const current = prev[slotId] || "no";
      const next: VoteValue = current === "no" ? "yes" : current === "yes" ? "maybe" : "no";
      return { ...prev, [slotId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!poll || !voterName.trim()) return;
    const newVote: PollVote = {
      participantName: voterName.trim(),
      participantEmail: voterEmail.trim(),
      votes,
      submittedAt: new Date().toISOString(),
    };
    const updated = { ...poll, votes: [...poll.votes, newVote] };
    savePoll(updated);
    setPoll(updated);
    setSubmitted(true);
    toast.success("Vote submitted");
    try {
      await calendarApi.post(`/polls/${poll.id}/vote`, newVote);
    } catch {
      // localStorage already updated
    }
  };

  const handleConfirm = async (slotId: string) => {
    if (!poll) return;
    const updated = { ...poll, confirmedSlotId: slotId, status: "confirmed" as const };
    savePoll(updated);
    setPoll(updated);
    toast.success("Créneau confirmé");
    try {
      await calendarApi.post(`/polls/${poll.id}/confirm`, { slot_id: slotId });
    } catch {
      // localStorage already updated
    }
  };

  // Compute best slot
  const slotScores = useMemo(() => {
    if (!poll) return {};
    const scores: Record<string, number> = {};
    poll.slots.forEach((slot) => {
      scores[slot.id] = 0;
      poll.votes.forEach((v) => {
        const val = v.votes[slot.id];
        if (val === "yes") scores[slot.id] += 2;
        else if (val === "maybe") scores[slot.id] += 1;
      });
    });
    return scores;
  }, [poll]);

  const bestSlotId = useMemo(() => {
    if (!poll || poll.votes.length === 0) return null;
    let best = "";
    let bestScore = -1;
    Object.entries(slotScores).forEach(([id, score]) => {
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    });
    return best || null;
  }, [slotScores, poll]);

  if (!poll) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <CalendarDays className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">Poll not found</p>
        <p className="text-sm">This poll may have been deleted or the link is invalid.</p>
      </div>
    );
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/poll/${poll.id}`);
    toast.success("Lien copié");
  };

  const voteIcon = (val: VoteValue | undefined) => {
    if (val === "yes") return <Check className="h-4 w-4 text-green-600" />;
    if (val === "maybe") return <HelpCircle className="h-4 w-4 text-amber-500" />;
    return <X className="h-4 w-4 text-red-400" />;
  };

  const voteBg = (val: VoteValue | undefined) => {
    if (val === "yes") return "bg-green-100 dark:bg-green-900/30";
    if (val === "maybe") return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-red-50 dark:bg-red-900/20";
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{poll.title}</h1>
          {poll.status === "confirmed" && (
            <Badge className="bg-green-600 text-white">Confirmed</Badge>
          )}
        </div>
        {poll.description && <p className="text-muted-foreground">{poll.description}</p>}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Crown className="h-3.5 w-3.5" /> {poll.organizerName}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {poll.votes.length} vote(s)
          </span>
          <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={copyLink}>
            <Link2 className="h-3.5 w-3.5" /> Copy link
          </Button>
        </div>
      </div>

      {/* Vote Matrix */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium min-w-[140px]">Participant</th>
              {poll.slots.map((slot) => (
                <th
                  key={slot.id}
                  className={cn(
                    "text-center px-3 py-2 font-medium min-w-[100px]",
                    bestSlotId === slot.id && "bg-green-100 dark:bg-green-900/30",
                    poll.confirmedSlotId === slot.id && "bg-primary/10"
                  )}
                >
                  <div>{format(new Date(slot.date), "EEE dd/MM", { locale: fr })}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {slot.startTime}&ndash;{slot.endTime}
                  </div>
                  {bestSlotId === slot.id && poll.votes.length > 0 && (
                    <Badge variant="outline" className="text-[10px] mt-1 text-green-700 border-green-300">
                      Best
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {poll.votes.map((vote, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{vote.participantName}</td>
                {poll.slots.map((slot) => (
                  <td
                    key={slot.id}
                    className={cn("text-center px-3 py-2", voteBg(vote.votes[slot.id]))}
                  >
                    {voteIcon(vote.votes[slot.id])}
                  </td>
                ))}
              </tr>
            ))}

            {/* Current voter row (if not yet submitted) */}
            {!submitted && poll.status === "open" && (
              <tr className="border-t-2 border-primary/20">
                <td className="px-3 py-2">
                  <Input
                    className="h-8 text-sm"
                    placeholder="Your name"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                  />
                </td>
                {poll.slots.map((slot) => (
                  <td key={slot.id} className="text-center px-3 py-2">
                    <button
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full mx-auto flex items-center justify-center transition-colors",
                        voteBg(votes[slot.id])
                      )}
                      onClick={() => toggleVote(slot.id)}
                    >
                      {voteIcon(votes[slot.id])}
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vote button */}
      {!submitted && poll.status === "open" && (
        <div className="flex items-center gap-3">
          <Input
            className="max-w-[240px]"
            type="email"
            placeholder="Your email (optional)"
            value={voterEmail}
            onChange={(e) => setVoterEmail(e.target.value)}
          />
          <Button onClick={handleSubmit} disabled={!voterName.trim()}>
            Submit Vote
          </Button>
        </div>
      )}

      {submitted && (
        <p className="text-sm text-green-600 font-medium">Your vote has been recorded.</p>
      )}

      {/* Organizer: Confirm a slot */}
      {poll.status === "open" && poll.votes.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <h3 className="font-semibold text-sm">Organizer: Confirm a time slot</h3>
          <div className="flex flex-wrap gap-2">
            {poll.slots.map((slot) => (
              <Button
                key={slot.id}
                variant={bestSlotId === slot.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleConfirm(slot.id)}
              >
                {format(new Date(slot.date), "dd/MM")} {slot.startTime}
                {bestSlotId === slot.id && " (Best)"}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed slot info */}
      {poll.confirmedSlotId && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="font-semibold text-green-800 dark:text-green-300">
            Confirmed:{" "}
            {(() => {
              const slot = poll.slots.find((s) => s.id === poll.confirmedSlotId);
              if (!slot) return "Unknown";
              return `${format(new Date(slot.date), "EEEE dd MMMM", { locale: fr })} ${slot.startTime} - ${slot.endTime}`;
            })()}
          </p>
        </div>
      )}
    </div>
  );
}
