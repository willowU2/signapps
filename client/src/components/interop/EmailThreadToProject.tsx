"use client";

/**
 * Feature 12: Email thread → create project from thread
 * Feature 27: Mail draft → link to related project
 */

import { useState } from "react";
import { FolderPlus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";
import type { Mail } from "@/lib/data/mail";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mail: Mail;
}

export function EmailThreadToProjectDialog({ open, onOpenChange, mail }: Props) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim()) { toast.error("Le nom du projet est requis"); return; }
    setSaving(true);
    try {
      const API = CALENDAR_URL;
      let projectId = `local_proj_${Date.now()}`;
      try {
        const res = await fetch(`${API}/projects`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projectName.trim(), description: description.trim() || `Créé depuis l'email : ${mail.subject}` }),
        });
        if (res.ok) { const d = await res.json(); projectId = d.id ?? d.data?.id ?? projectId; }
      } catch { /* store locally */ }

      // Store locally if API failed
      if (projectId.startsWith("local_")) {
        const projects = JSON.parse(localStorage.getItem("interop:local_projects") || "[]");
        projects.push({ id: projectId, name: projectName, description, created_at: new Date().toISOString() });
        localStorage.setItem("interop:local_projects", JSON.stringify(projects));
      }

      interopStore.addLink({ sourceType: "mail", sourceId: mail.id, sourceTitle: mail.subject, targetType: "task", targetId: projectId, targetTitle: projectName, relation: "project_source" });
      toast.success(`Projet « ${projectName} » créé`);
      onOpenChange(false);
    } catch {
      toast.error("Impossible de créer le projet");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-indigo-500" />
            Créer un projet depuis ce fil
          </DialogTitle>
          <DialogDescription>
            L'email « {mail.subject} » deviendra la source du projet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nom du projet *</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Mon nouveau projet" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description optionnelle" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving || !projectName.trim()}>
            {saving ? "Création…" : "Créer le projet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Feature 27: small indicator component for linking a draft to a project */
export function DraftProjectLink({ draftId, className }: { draftId: string; className?: string }) {
  const [projectId, setProjectId] = useState<string | null>(() => {
    const links = interopStore.getLinksBySource("mail", draftId);
    return links.find(l => l.relation === "draft_project")?.targetId ?? null;
  });

  const localProjects: { id: string; name: string }[] = JSON.parse(
    typeof window !== "undefined" ? (localStorage.getItem("interop:local_projects") || "[]") : "[]"
  );

  const linked = localProjects.find(p => p.id === projectId);

  const handleLink = (id: string, name: string) => {
    interopStore.addLink({ sourceType: "mail", sourceId: draftId, sourceTitle: "Brouillon", targetType: "task", targetId: id, targetTitle: name, relation: "draft_project" });
    setProjectId(id);
    toast.success(`Brouillon lié au projet « ${name} »`);
  };

  if (linked) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <Link2 className="h-3 w-3" />
        Lié au projet : <strong>{linked.name}</strong>
      </div>
    );
  }

  if (localProjects.length === 0) return null;

  return (
    <select
      className={`text-xs border border-border rounded px-2 py-1 bg-background ${className}`}
      defaultValue=""
      onChange={e => { const p = localProjects.find(x => x.id === e.target.value); if (p) handleLink(p.id, p.name); }}
    >
      <option value="" disabled>Lier à un projet…</option>
      {localProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
