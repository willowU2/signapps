"use client";

import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { entityHubApi } from "@/lib/api/entityHub";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, ChevronDown, ChevronUp } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status?: string;
  due_date?: string;
  progress_percent?: number;
  milestones?: Milestone[];
  tasks?: Task[];
}

interface Milestone {
  id: string;
  title: string;
  due_date?: string;
}

interface Task {
  id: string;
  title: string;
  status?: string;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progression</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full text-left p-4 space-y-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderKanban className="h-4 w-4 text-primary shrink-0" />
            <p className="font-semibold truncate">{project.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {project.status && (
              <Badge variant="outline" className="text-xs">
                {project.status}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {project.due_date && (
          <p className="text-xs text-muted-foreground">
            Échéance : {new Date(project.due_date).toLocaleDateString("fr-FR")}
          </p>
        )}

        {project.progress_percent !== undefined && (
          <ProgressBar value={project.progress_percent} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {project.milestones && project.milestones.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Jalons
              </p>
              <ul className="space-y-1">
                {project.milestones.map((m) => (
                  <li key={m.id} className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{m.title}</span>
                    {m.due_date && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(m.due_date).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.tasks && project.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Tâches assignées
              </p>
              <ul className="space-y-1">
                {project.tasks.map((t) => (
                  <li key={t.id} className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                    <span>{t.title}</span>
                    {t.status && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        {t.status}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(!project.milestones || project.milestones.length === 0) &&
            (!project.tasks || project.tasks.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Aucun jalon ni tâche disponible.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

export default function SupplierPortalProjectsPage() {
  usePageTitle("Mes Projets");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    entityHubApi
      .myProjects()
      .then((res) => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("Impossible de charger vos projets."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes Projets</h1>
        <p className="text-muted-foreground mt-1">
          Consultez l&apos;avancement de vos projets et vos tâches assignées.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 h-32 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Aucun projet assigné</p>
          <p className="text-sm mt-1">
            Vous n&apos;avez aucun projet en cours pour le moment.
          </p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
