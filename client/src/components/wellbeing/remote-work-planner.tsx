"use client";

/**
 * Remote Work Planner Component
 *
 * Weekly grid (Mon-Fri) with toggle for office/remote per day.
 * Includes team view to see colleague availability.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Home, Users } from "lucide-react";

export type WorkLocation = "office" | "remote";

export interface DaySchedule {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  location: WorkLocation;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  schedule: DaySchedule[];
}

export interface RemoteWorkPlannerProps {
  currentSchedule: DaySchedule[];
  teamMembers?: TeamMember[];
  onScheduleChange?: (day: DaySchedule["day"], location: WorkLocation) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function DayCard({
  day,
  location,
  onToggle,
}: {
  day: DaySchedule["day"];
  location: WorkLocation;
  onToggle: () => void;
}) {
  const isRemote = location === "remote";
  const shortDay = day.substring(0, 3);

  return (
    <button
      onClick={onToggle}
      className={`p-4 rounded-lg border-2 transition-all text-center space-y-2 ${
        isRemote
          ? "bg-blue-50 border-blue-300 hover:border-blue-400"
          : "bg-orange-50 border-orange-300 hover:border-orange-400"
      }`}
    >
      <p className="text-xs font-semibold text-muted-foreground">{shortDay}</p>
      <div className="flex justify-center">
        {isRemote ? (
          <Home className="w-6 h-6 text-blue-600" />
        ) : (
          <MapPin className="w-6 h-6 text-orange-600" />
        )}
      </div>
      <Badge
        className={
          isRemote ? "bg-blue-600 text-white" : "bg-orange-600 text-white"
        }
      >
        {isRemote ? "Remote" : "Office"}
      </Badge>
    </button>
  );
}

function TeamMemberAvailability({
  member,
  day,
}: {
  member: TeamMember;
  day: DaySchedule["day"];
}) {
  const daySchedule = member.schedule.find((s) => s.day === day);
  const isRemote = daySchedule?.location === "remote";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white text-xs font-bold">
        {member.avatar || getInitials(member.name)}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{member.name}</p>
      </div>
      <div className="flex items-center gap-1">
        {isRemote ? (
          <Home className="w-4 h-4 text-blue-600" />
        ) : (
          <MapPin className="w-4 h-4 text-orange-600" />
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {isRemote ? "Remote" : "Office"}
        </span>
      </div>
    </div>
  );
}

export function RemoteWorkPlanner({
  currentSchedule,
  teamMembers = [],
  onScheduleChange,
}: RemoteWorkPlannerProps) {
  const scheduleMap = Object.fromEntries(
    currentSchedule.map((s) => [s.day, s.location]),
  );

  const handleToggle = (day: DaySchedule["day"]) => {
    const currentLocation = scheduleMap[day] || "office";
    const newLocation: WorkLocation =
      currentLocation === "remote" ? "office" : "remote";
    onScheduleChange?.(day, newLocation);
  };

  const getTeamPresence = (day: DaySchedule["day"]) => {
    return teamMembers.filter(
      (member) =>
        member.schedule.find((s) => s.day === day)?.location === "office",
    ).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Planificateur Télétravail
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre Semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {DAYS.map((day) => (
              <DayCard
                key={day}
                day={day}
                location={scheduleMap[day] || "office"}
                onToggle={() => handleToggle(day)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle className="text-base">Disponibilité Équipe</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {DAYS.map((day) => (
                <div key={day} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold">{day}</p>
                    <Badge variant="outline">
                      {getTeamPresence(day)} au bureau
                    </Badge>
                  </div>
                  <div className="space-y-2 pl-2 border-l border-border">
                    {teamMembers.map((member) => (
                      <TeamMemberAvailability
                        key={member.id}
                        member={member}
                        day={day}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-900">
          💡 Cliquez sur un jour pour basculer entre travail au bureau et
          télétravail.
        </p>
      </div>
    </div>
  );
}
