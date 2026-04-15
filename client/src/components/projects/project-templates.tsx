"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, FolderOpen, Copy } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateTask {
  id: string;
  title: string;
  daysFromStart: number;
  durationDays: number;
  assigneeRole: string;
  priority: "low" | "medium" | "high";
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tasks: TemplateTask[];
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILT_IN: ProjectTemplate[] = [
  {
    id: "t1",
    name: "Développement Web",
    description: "Template standard pour projets web front/back",
    category: "Tech",
    createdAt: "2026-01-01",
    tasks: [
      {
        id: "1",
        title: "Brief & spécifications",
        daysFromStart: 0,
        durationDays: 3,
        assigneeRole: "PM",
        priority: "high",
      },
      {
        id: "2",
        title: "Architecture & design",
        daysFromStart: 3,
        durationDays: 5,
        assigneeRole: "Architecte",
        priority: "high",
      },
      {
        id: "3",
        title: "Setup infrastructure",
        daysFromStart: 5,
        durationDays: 2,
        assigneeRole: "DevOps",
        priority: "medium",
      },
      {
        id: "4",
        title: "Backend développement",
        daysFromStart: 7,
        durationDays: 14,
        assigneeRole: "Dev Backend",
        priority: "high",
      },
      {
        id: "5",
        title: "Frontend développement",
        daysFromStart: 7,
        durationDays: 14,
        assigneeRole: "Dev Frontend",
        priority: "high",
      },
      {
        id: "6",
        title: "Tests & QA",
        daysFromStart: 21,
        durationDays: 5,
        assigneeRole: "QA",
        priority: "high",
      },
      {
        id: "7",
        title: "Déploiement & recette",
        daysFromStart: 26,
        durationDays: 3,
        assigneeRole: "DevOps",
        priority: "medium",
      },
    ],
  },
  {
    id: "t2",
    name: "Lancement Produit",
    description: "Template go-to-market et marketing",
    category: "Business",
    createdAt: "2026-01-01",
    tasks: [
      {
        id: "1",
        title: "Analyse marché",
        daysFromStart: 0,
        durationDays: 7,
        assigneeRole: "Business Analyst",
        priority: "high",
      },
      {
        id: "2",
        title: "Définition positionnement",
        daysFromStart: 7,
        durationDays: 5,
        assigneeRole: "Product",
        priority: "high",
      },
      {
        id: "3",
        title: "Création contenu marketing",
        daysFromStart: 12,
        durationDays: 10,
        assigneeRole: "Marketing",
        priority: "medium",
      },
      {
        id: "4",
        title: "Préparation support commercial",
        daysFromStart: 12,
        durationDays: 8,
        assigneeRole: "Sales",
        priority: "medium",
      },
      {
        id: "5",
        title: "Lancement & communication",
        daysFromStart: 22,
        durationDays: 3,
        assigneeRole: "Marketing",
        priority: "high",
      },
    ],
  },
];

// ── Template Card ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onLoad,
  onDelete,
  builtIn,
}: {
  template: ProjectTemplate;
  onLoad: (t: ProjectTemplate) => void;
  onDelete?: (id: string) => void;
  builtIn?: boolean;
}) {
  return (
    <Card className="border-border/60 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              {template.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.description}
            </p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0 ml-2">
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {template.tasks.slice(0, 4).map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="truncate">{t.title}</span>
              <span className="ml-auto shrink-0">{t.durationDays}j</span>
            </div>
          ))}
          {template.tasks.length > 4 && (
            <p className="text-xs text-muted-foreground pl-3.5">
              +{template.tasks.length - 4} autres tâches...
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1"
            onClick={() => onLoad(template)}
          >
            <Copy className="size-3" /> Utiliser
          </Button>
          {!builtIn && onDelete && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 text-destructive"
              onClick={() => onDelete(template.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProjectTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("General");
  const [currentTasks, setCurrentTasks] = useState<TemplateTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loaded, setLoaded] = useState<ProjectTemplate | null>(null);

  const handleLoad = (t: ProjectTemplate) => {
    setLoaded(t);
    toast.success(
      `Template "${t.name}" chargé — ${t.tasks.length} tâches prêtes à l'usage.`,
    );
  };

  const handleDeleteCustom = (id: string) => {
    setTemplates((p) => p.filter((t) => t.id !== id));
    toast.success("Template supprimé.");
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const t: TemplateTask = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      daysFromStart: currentTasks.length * 5,
      durationDays: 5,
      assigneeRole: "",
      priority: "medium",
    };
    setCurrentTasks((p) => [...p, t]);
    setNewTaskTitle("");
  };

  const handleSaveTemplate = () => {
    if (!newName.trim() || currentTasks.length === 0) return;
    const t: ProjectTemplate = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim(),
      category: newCat.trim() || "General",
      tasks: currentTasks,
      createdAt: new Date().toISOString(),
    };
    setTemplates((p) => [...p, t]);
    setNewName("");
    setNewDesc("");
    setCurrentTasks([]);
    setSaving(false);
    toast.success(`Template "${t.name}" sauvegardé.`);
  };

  const allTemplates = [...BUILT_IN, ...templates];

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FolderOpen className="size-4" /> Templates de projets
        </h3>
        <Button size="sm" onClick={() => setSaving(true)} className="gap-1">
          <Save className="size-4" /> Créer template
        </Button>
      </div>

      {/* Loaded template preview */}
      {loaded && (
        <div className="border rounded-lg p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-primary">
              Template chargé: {loaded.name}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setLoaded(null)}
            >
              ×
            </Button>
          </div>
          <div className="space-y-1">
            {loaded.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-16 shrink-0">
                  J+{t.daysFromStart}
                </span>
                <span className="flex-1">{t.title}</span>
                <span className="text-muted-foreground">{t.durationDays}j</span>
                <Badge variant="outline" className="text-xs">
                  {t.assigneeRole || "—"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allTemplates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onLoad={handleLoad}
            onDelete={
              !BUILT_IN.find((b) => b.id === t.id)
                ? handleDeleteCustom
                : undefined
            }
            builtIn={!!BUILT_IN.find((b) => b.id === t.id)}
          />
        ))}
      </div>

      {/* Create template form */}
      {saving && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
          <p className="font-medium text-sm">Créer un template</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nom du template *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Catégorie"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
          </div>
          <Input
            placeholder="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Tâches ({currentTasks.length})
            </p>
            {currentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 border rounded px-2 py-1">
                  {t.title}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-destructive"
                  onClick={() =>
                    setCurrentTasks((p) => p.filter((x) => x.id !== t.id))
                  }
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Titre tâche..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTask();
                }}
                className="flex-1 h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddTask}
                className="gap-1"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSaveTemplate}
              disabled={!newName.trim() || currentTasks.length === 0}
            >
              <Save className="size-4 mr-1" /> Sauvegarder
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSaving(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
