import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Minimal EventCard for display purposes
// (The real EventForm is a complex dialog — this story shows the display card)
// ---------------------------------------------------------------------------

interface EventCardProps {
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees?: number;
  color?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
}

function EventCard({
  title,
  start,
  end,
  location,
  attendees,
  color = "#6366f1",
  isAllDay = false,
  isCancelled = false,
}: EventCardProps) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const timeLabel = isAllDay
    ? "All day"
    : `${startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <Card
      className="w-72 overflow-hidden"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle
            className={`text-sm font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}
          >
            {title}
          </CardTitle>
          {isCancelled && (
            <Badge variant="destructive" className="text-xs">
              Cancelled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          <span>{timeLabel}</span>
        </div>
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            <span>{location}</span>
          </div>
        )}
        {attendees !== undefined && attendees > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span>
              {attendees} attendee{attendees > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const meta: Meta<typeof EventCard> = {
  title: "Calendar/EventCard",
  component: EventCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact calendar event display card used in list and agenda views.",
      },
    },
  },
  argTypes: {
    color: { control: "color" },
    isAllDay: { control: "boolean" },
    isCancelled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof EventCard>;

export const Default: Story = {
  args: {
    title: "Team Standup",
    start: "2026-04-01T09:00:00",
    end: "2026-04-01T09:30:00",
    location: "Meeting Room A",
    attendees: 5,
    color: "#6366f1",
  },
};

export const AllDay: Story = {
  args: {
    title: "Company Holiday",
    start: "2026-04-01T00:00:00",
    end: "2026-04-01T23:59:59",
    isAllDay: true,
    color: "#10b981",
    attendees: 0,
  },
};

export const Cancelled: Story = {
  args: {
    title: "Q2 Planning Session",
    start: "2026-04-02T14:00:00",
    end: "2026-04-02T16:00:00",
    location: "Conference Room B",
    attendees: 8,
    isCancelled: true,
    color: "#ef4444",
  },
};

export const MinimalNoLocation: Story = {
  args: {
    title: "Quick sync",
    start: "2026-04-01T11:00:00",
    end: "2026-04-01T11:15:00",
    color: "#f59e0b",
  },
};

export const LongTitle: Story = {
  args: {
    title: "Annual Strategy Workshop — Executive Leadership Team",
    start: "2026-04-03T09:00:00",
    end: "2026-04-03T17:00:00",
    location: "Paris HQ, Floor 12 — Grand Salle",
    attendees: 20,
    color: "#8b5cf6",
  },
};
