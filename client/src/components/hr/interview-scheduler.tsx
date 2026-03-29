"use client";

import { useState } from "react";
import { Calendar, Clock, MapPin, User, CheckCircle, Clock as ClockIcon } from "lucide-react";

interface InterviewSlot {
  id: string;
  candidateName: string;
  interviewer: string;
  room: string;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled";
}

const DEFAULT_SLOTS: InterviewSlot[] = [
  {
    id: "1",
    candidateName: "Sarah Johnson",
    interviewer: "Marc Dupont",
    room: "Meeting Room A",
    date: "2026-03-25",
    time: "10:00",
    status: "scheduled",
  },
  {
    id: "2",
    candidateName: "Pierre Laurent",
    interviewer: "Marie Renard",
    room: "Meeting Room B",
    date: "2026-03-25",
    time: "14:00",
    status: "scheduled",
  },
  {
    id: "3",
    candidateName: "Emma Chen",
    interviewer: "Marc Dupont",
    room: "Meeting Room A",
    date: "2026-03-26",
    time: "11:00",
    status: "completed",
  },
  {
    id: "4",
    candidateName: "Jean Martin",
    interviewer: "Sophie Bernard",
    room: "Meeting Room C",
    date: "2026-03-27",
    time: "09:00",
    status: "scheduled",
  },
  {
    id: "5",
    candidateName: "Anna Garcia",
    interviewer: "Marie Renard",
    room: "Meeting Room B",
    date: "2026-03-24",
    time: "15:00",
    status: "cancelled",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return (
        <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
          <ClockIcon className="w-3 h-3" />
          Scheduled
        </div>
      );
    case "completed":
      return (
        <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Completed
        </div>
      );
    case "cancelled":
      return (
        <div className="inline-flex items-center gap-1 bg-muted text-gray-800 px-2 py-1 rounded text-xs font-medium">
          Cancelled
        </div>
      );
    default:
      return null;
  }
}

export function InterviewScheduler() {
  const [slots, setSlots] = useState<InterviewSlot[]>(DEFAULT_SLOTS);

  const scheduledCount = slots.filter((s) => s.status === "scheduled").length;
  const completedCount = slots.filter((s) => s.status === "completed").length;
  const cancelledCount = slots.filter((s) => s.status === "cancelled").length;

  const handleMarkCompleted = (id: string) => {
    setSlots(
      slots.map((s) =>
        s.id === id ? { ...s, status: "completed" } : s
      )
    );
  };

  const handleCancel = (id: string) => {
    setSlots(
      slots.map((s) =>
        s.id === id ? { ...s, status: "cancelled" } : s
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Interview Scheduler</h2>
        <p className="text-muted-foreground">Manage candidate interview schedule</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">Scheduled</p>
          <p className="text-2xl font-bold text-blue-900">{scheduledCount}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">Completed</p>
          <p className="text-2xl font-bold text-green-900">{completedCount}</p>
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <p className="text-sm text-muted-foreground font-medium">Cancelled</p>
          <p className="text-2xl font-bold text-foreground">{cancelledCount}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted border-b p-4">
          <h3 className="font-semibold text-foreground">Interview Calendar</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-card">
            <thead className="bg-muted border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Candidate</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Interviewer</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Date & Time</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Room</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-muted">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <p className="font-medium text-foreground">{slot.candidateName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-muted-foreground">{slot.interviewer}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-foreground">{slot.date}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {slot.time}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <p className="text-muted-foreground">{slot.room}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(slot.status)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {slot.status === "scheduled" && (
                      <>
                        <button
                          onClick={() => handleMarkCompleted(slot.id)}
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 rounded px-2 py-1 text-xs font-medium"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => handleCancel(slot.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-2 py-1 text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
