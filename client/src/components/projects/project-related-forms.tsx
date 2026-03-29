"use client";

// Feature 14: Project → show related forms (feedback forms)

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, ExternalLink, Users, CheckSquare, Star, MessageSquare } from "lucide-react";

type FormType = "feedback" | "survey" | "checklist" | "review";

interface RelatedForm {
  id: string;
  title: string;
  type: FormType;
  responses: number;
  targetAudience: string;
  createdAt: string;
  status: "active" | "closed" | "draft";
  link?: string;
}

const TYPE_CONFIG: Record<FormType, { icon: React.ReactNode; label: string; class: string }> = {
  feedback: { icon: <MessageSquare className="size-3.5" />, label: "Feedback", class: "text-blue-600" },
  survey: { icon: <ClipboardList className="size-3.5" />, label: "Sondage", class: "text-purple-600" },
  checklist: { icon: <CheckSquare className="size-3.5" />, label: "Checklist", class: "text-green-600" },
  review: { icon: <Star className="size-3.5" />, label: "Revue", class: "text-yellow-600" },
};

const STATUS_CONFIG = {
  active: { label: "Actif", class: "bg-green-100 text-green-800" },
  closed: { label: "Fermé", class: "bg-muted text-gray-800" },
  draft: { label: "Brouillon", class: "bg-yellow-100 text-yellow-800" },
};

const DEMO_FORMS: RelatedForm[] = [
  { id: "f1", title: "Satisfaction sprint 3", type: "feedback", responses: 5, targetAudience: "Équipe projet", createdAt: "2026-03-20", status: "active" },
  { id: "f2", title: "Rétrospective Q1", type: "survey", responses: 8, targetAudience: "Toute l'équipe", createdAt: "2026-03-15", status: "active" },
  { id: "f3", title: "Checklist déploiement v2", type: "checklist", responses: 3, targetAudience: "DevOps", createdAt: "2026-03-10", status: "closed" },
  { id: "f4", title: "Revue de performance Q1", type: "review", responses: 0, targetAudience: "Managers", createdAt: "2026-03-29", status: "draft" },
];

interface ProjectRelatedFormsProps {
  projectName?: string;
  forms?: RelatedForm[];
}

export function ProjectRelatedForms({ projectName = "Refonte Backend Auth", forms = DEMO_FORMS }: ProjectRelatedFormsProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? forms : forms.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4" />
          Formulaires liés
        </CardTitle>
        <Badge variant="secondary">{forms.filter((f) => f.status === "active").length} actifs</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayed.map((form) => (
          <div key={form.id} className="flex items-center gap-2 rounded-lg border p-2.5">
            <span className={TYPE_CONFIG[form.type].class}>{TYPE_CONFIG[form.type].icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{form.title}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_CONFIG[form.status].class}`}>
                  {STATUS_CONFIG[form.status].label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Users className="size-2.5" />{form.targetAudience}</span>
                <span>·</span>
                <span>{form.responses} réponses</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-7 shrink-0">
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        ))}
        {forms.length > 3 && (
          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Voir moins" : `Voir ${forms.length - 3} autres`}
          </Button>
        )}
        <Button variant="outline" size="sm" className="w-full gap-1 text-xs h-7">
          <ClipboardList className="size-3.5" />
          Créer un formulaire
        </Button>
      </CardContent>
    </Card>
  );
}
