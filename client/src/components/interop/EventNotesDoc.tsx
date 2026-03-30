"use client";

/**
 * Feature 17: Calendar event notes → auto-save as doc
 */

import { useEffect, useState } from "react";
import { FileText, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";

interface Props {
  eventId: string;
  eventTitle: string;
  notes: string;
  className?: string;
}

export function EventNotesDocSave({ eventId, eventTitle, notes, className }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if already saved
  useEffect(() => {
    const docs: { eventId: string }[] = JSON.parse(localStorage.getItem("interop:event_docs") || "[]");
    setSaved(docs.some(d => d.eventId === eventId));
  }, [eventId]);

  const handleSave = async () => {
    if (!notes.trim()) { toast.error("Aucune note à enregistrer"); return; }
    setSaving(true);
    try {
      const docId = `doc_${eventId}`;
      let saved_id = docId;

      // Try docs API
      try {
        const API = process.env.NEXT_PUBLIC_DOCS_API || "http://localhost:3012/api/v1";
        const res = await fetch(`${API}/documents`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Notes : ${eventTitle}`, content: notes, source: "calendar_event", source_id: eventId }),
        });
        if (res.ok) { const d = await res.json(); saved_id = d.id ?? d.data?.id ?? docId; }
      } catch { /* fallback to localStorage */ }

      // Save locally
      const docs = JSON.parse(localStorage.getItem("interop:event_docs") || "[]");
      docs.push({ eventId, docId: saved_id, title: `Notes : ${eventTitle}`, notes, created_at: new Date().toISOString() });
      localStorage.setItem("interop:event_docs", JSON.stringify(docs));

      interopStore.addLink({ sourceType: "event", sourceId: eventId, sourceTitle: eventTitle, targetType: "document", targetId: saved_id, targetTitle: `Notes : ${eventTitle}`, relation: "notes_doc" });
      setSaved(true);
      toast.success("Notes enregistrées comme document");
    } catch {
      toast.error("Impossible d'enregistrer les notes");
    } finally { setSaving(false); }
  };

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSave}
        disabled={saving || saved || !notes.trim()}
        className="gap-2 h-8 text-xs"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {saved ? "Notes enregistrées" : "Enregistrer les notes"}
      </Button>
    </div>
  );
}
