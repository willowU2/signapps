"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, Phone, Calendar, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface TimelineInteraction {
  id: string;
  type: "email" | "phone" | "meeting" | "note";
  date: string;
  content: string;
  author?: string;
}

export interface InteractionTimelineProps {
  interactions: TimelineInteraction[];
}

const TYPE_CONFIG = {
  email: {
    icon: Mail,
    label: "Email",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    dotColor: "bg-blue-400",
  },
  phone: {
    icon: Phone,
    label: "Appel",
    color: "bg-green-100 text-green-800 border-green-300",
    dotColor: "bg-green-400",
  },
  meeting: {
    icon: Calendar,
    label: "Réunion",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    dotColor: "bg-purple-400",
  },
  note: {
    icon: StickyNote,
    label: "Note",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    dotColor: "bg-amber-400",
  },
};

export function InteractionTimeline({
  interactions,
}: InteractionTimelineProps) {
  const sortedInteractions = [...interactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-0">
      {sortedInteractions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Aucune interaction enregistrée
          </p>
        </Card>
      ) : (
        <div className="relative space-y-6 pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-1 bg-gray-200" />

          {sortedInteractions.map((interaction, index) => {
            const config = TYPE_CONFIG[interaction.type];
            const Icon = config.icon;
            const date = format(
              parseISO(interaction.date),
              "d MMM yyyy à HH:mm",
              { locale: fr },
            );
            const contentPreview =
              interaction.content.slice(0, 80) +
              (interaction.content.length > 80 ? "..." : "");

            return (
              <div key={interaction.id} className="relative">
                {/* Timeline dot */}
                <div
                  className={`absolute -left-6 top-2 h-5 w-5 rounded-full border-4 border-white ${config.dotColor}`}
                />

                {/* Card */}
                <Card className={`p-4 border-l-4 ${config.color}`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {date}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 line-clamp-2">
                      {contentPreview}
                    </p>

                    {interaction.author && (
                      <p className="text-xs text-muted-foreground">
                        Par: {interaction.author}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
