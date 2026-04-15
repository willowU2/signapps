"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType = "note" | "email" | "call" | "meeting" | "document";

export interface ContactActivity {
  id: string;
  contactId: string;
  type: ActivityType;
  title: string;
  content?: string;
  date: string; // ISO
  createdBy: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ActivityType,
  { icon: React.ReactNode; color: string; label: string }
> = {
  note: {
    icon: <MessageSquare className="size-3.5" />,
    color: "bg-slate-100 text-slate-700",
    label: "Note",
  },
  email: {
    icon: <Mail className="size-3.5" />,
    color: "bg-blue-100 text-blue-700",
    label: "Email",
  },
  call: {
    icon: <Phone className="size-3.5" />,
    color: "bg-green-100 text-green-700",
    label: "Appel",
  },
  meeting: {
    icon: <Calendar className="size-3.5" />,
    color: "bg-purple-100 text-purple-700",
    label: "Réunion",
  },
  document: {
    icon: <FileText className="size-3.5" />,
    color: "bg-orange-100 text-orange-700",
    label: "Document",
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────

interface ContactHistoryProps {
  contactId: string;
  contactName: string;
  activities: ContactActivity[];
  onAdd: (activity: ContactActivity) => void;
  onDelete: (id: string) => void;
}

export function ContactHistory({
  contactId,
  contactName,
  activities,
  onAdd,
  onDelete,
}: ContactHistoryProps) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<ActivityType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const contactActivities = activities
    .filter((a) => a.contactId === contactId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAdd = () => {
    if (!title.trim()) return;
    const a: ContactActivity = {
      id: crypto.randomUUID(),
      contactId,
      type,
      title: title.trim(),
      content: content.trim() || undefined,
      date: new Date().toISOString(),
      createdBy: "Moi",
    };
    onAdd(a);
    setTitle("");
    setContent("");
    setType("note");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Historique — {contactName}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          className="gap-1 h-7 text-xs"
        >
          <Plus className="size-3" /> Activité
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="h-8 rounded-md border text-sm px-2 bg-background"
            >
              {(
                Object.entries(TYPE_CONFIG) as [
                  ActivityType,
                  { label: string },
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Titre *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 h-8 text-sm"
            />
          </div>
          <Input
            placeholder="Détails (optionnel)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAdd}
              disabled={!title.trim()}
            >
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAdding(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {contactActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune activité enregistrée.
          </p>
        ) : (
          contactActivities.map((a) => {
            const cfg = TYPE_CONFIG[a.type];
            return (
              <div key={a.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center shrink-0",
                      cfg.color,
                    )}
                  >
                    {cfg.icon}
                  </div>
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="flex-1 pb-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      {a.content && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {a.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </time>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-5 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(a.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <Badge className={cn("text-xs mt-1", cfg.color)}>
                    {cfg.label}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
