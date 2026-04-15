"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar, StickyNote, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { activitiesApi, type Activity, type ActivityType } from "@/lib/api/crm";

const TYPE_CONFIG: Record<
  ActivityType,
  {
    icon: typeof Mail;
    label: string;
    borderColor: string;
    bgColor: string;
    dotColor: string;
  }
> = {
  email: {
    icon: Mail,
    label: "Email",
    borderColor: "border-l-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    dotColor: "bg-blue-400",
  },
  phone: {
    icon: Phone,
    label: "Appel",
    borderColor: "border-l-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    dotColor: "bg-green-400",
  },
  meeting: {
    icon: Calendar,
    label: "Réunion",
    borderColor: "border-l-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    dotColor: "bg-purple-400",
  },
  note: {
    icon: StickyNote,
    label: "Note",
    borderColor: "border-l-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    dotColor: "bg-amber-400",
  },
};

interface Props {
  dealId?: string;
  contactId?: string;
  currentUser?: string;
}

export function ActivityLog({ dealId, contactId, currentUser }: Props) {
  const [activities, setActivities] = useState<Activity[]>(() => {
    if (dealId) return activitiesApi.byDeal(dealId);
    if (contactId) return activitiesApi.byContact(contactId);
    return [];
  });
  const [type, setType] = useState<ActivityType>("note");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [adding, setAdding] = useState(false);

  const reload = () => {
    if (dealId) setActivities(activitiesApi.byDeal(dealId));
    else if (contactId) setActivities(activitiesApi.byContact(contactId));
  };

  const add = () => {
    if (!content.trim()) return;
    activitiesApi.create({
      dealId,
      contactId,
      type,
      content: content.trim(),
      author: currentUser,
      date: new Date(date).toISOString(),
    });
    setContent("");
    setAdding(false);
    reload();
  };

  const remove = (id: string) => {
    activitiesApi.delete(id);
    reload();
  };

  const sorted = [...activities].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          Activités
          <Badge variant="secondary" className="text-xs">
            {activities.length}
          </Badge>
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {adding ? "Annuler" : "Ajouter"}
        </Button>
      </div>

      {adding && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={type}
              onValueChange={(v) => setType(v as ActivityType)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(TYPE_CONFIG) as [
                    ActivityType,
                    (typeof TYPE_CONFIG)[ActivityType],
                  ][]
                ).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              className="h-8 text-xs"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Textarea
            rows={3}
            placeholder="Notes, contenu de l'email, sujet de l'appel…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button size="sm" onClick={add} disabled={!content.trim()}>
            Enregistrer
          </Button>
        </Card>
      )}

      <div className="relative space-y-3 pl-6">
        <div className="absolute left-2 top-2 bottom-0 w-0.5 bg-border" />

        {sorted.map((act) => {
          const cfg = TYPE_CONFIG[act.type];
          const Icon = cfg.icon;
          return (
            <div key={act.id} className="relative group">
              <div
                className={`absolute -left-[18px] top-3 h-4 w-4 rounded-full ${cfg.dotColor} flex items-center justify-center ring-2 ring-background`}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </div>
              <Card
                className={`p-3 border-l-4 ${cfg.borderColor} ${cfg.bgColor} text-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {cfg.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(act.date), "d MMM yyyy, HH:mm", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {act.content}
                    </p>
                    {act.author && (
                      <p className="text-[10px] text-muted-foreground">
                        Par: {act.author}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => remove(act.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </Card>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground pl-2">
            Aucune activité enregistrée.
          </p>
        )}
      </div>
    </div>
  );
}
