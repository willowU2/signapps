"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";

interface Feature {
  id: string;
  label: string;
  description: string;
  href: string;
  xp: number;
}

const FEATURES: Feature[] = [
  {
    id: "send_mail",
    label: "Envoyer un email",
    description: "Composez et envoyez votre premier email",
    href: "/mail",
    xp: 10,
  },
  {
    id: "create_doc",
    label: "Créer un document",
    description: "Créez un document collaboratif",
    href: "/docs",
    xp: 15,
  },
  {
    id: "schedule_event",
    label: "Planifier un événement",
    description: "Ajoutez un événement au calendrier",
    href: "/calendar",
    xp: 10,
  },
  {
    id: "upload_file",
    label: "Uploader un fichier",
    description: "Déposez un fichier dans Drive",
    href: "/drive",
    xp: 10,
  },
  {
    id: "start_chat",
    label: "Démarrer une conversation",
    description: "Envoyez un message à un collègue",
    href: "/chat",
    xp: 5,
  },
  {
    id: "create_task",
    label: "Créer une tâche",
    description: "Ajoutez votre première tâche",
    href: "/tasks",
    xp: 5,
  },
  {
    id: "invite_user",
    label: "Inviter un utilisateur",
    description: "Ajoutez un membre à votre espace",
    href: "/admin/users",
    xp: 20,
  },
  {
    id: "customize_theme",
    label: "Personnaliser le thème",
    description: "Changez les couleurs et l'apparence",
    href: "/settings/preferences",
    xp: 5,
  },
];

const STORAGE_KEY = "signapps-feature-checklist";

export function markFeatureDone(featureId: string) {
  if (typeof window === "undefined") return;
  const done = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "[]",
  ) as string[];
  if (!done.includes(featureId)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done, featureId]));
    window.dispatchEvent(new CustomEvent("featureDone", { detail: featureId }));
  }
}

export function FeatureDiscoveryChecklist() {
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      setDone(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    };
    load();
    window.addEventListener("featureDone", load);
    return () => window.removeEventListener("featureDone", load);
  }, []);

  const completed = FEATURES.filter((f) => done.includes(f.id));
  const progress = (completed.length / FEATURES.length) * 100;
  const totalXp = completed.reduce((sum, f) => sum + f.xp, 0);
  const remaining = FEATURES.filter((f) => !done.includes(f.id));

  const markDone = (id: string) => {
    const updated = [...done, id];
    setDone(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border rounded-xl overflow-hidden"
    >
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Découvrez SignApps</span>
              <Badge variant="secondary" className="text-xs">
                {completed.length}/{FEATURES.length}
              </Badge>
              {totalXp > 0 && (
                <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                  +{totalXp} XP
                </Badge>
              )}
            </div>
            <Progress value={progress} className="h-1.5 mt-1.5" />
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t divide-y">
          {FEATURES.map((f) => {
            const isDone = done.includes(f.id);
            return (
              <div
                key={f.id}
                className={`flex items-center gap-3 px-3 py-2 transition-colors ${isDone ? "bg-muted/20" : "hover:bg-muted/30"}`}
              >
                <button
                  onClick={() => markDone(f.id)}
                  disabled={isDone}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {isDone && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}
                  >
                    {f.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-yellow-600">+{f.xp} XP</span>
                  {!isDone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      asChild
                    >
                      <Link href={f.href}>Essayer</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {completed.length === FEATURES.length && (
          <div className="p-3 bg-primary/5 text-center">
            <p className="text-sm font-medium text-primary">
              Bravo ! Vous avez tout exploré 🎉
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
