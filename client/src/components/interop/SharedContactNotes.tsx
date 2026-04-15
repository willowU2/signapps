"use client";
// Feature 28: Contact notes → shared between CRM and contacts

import { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { contactNotesApi, type ContactNote } from "@/lib/api/interop";
import { dealsApi } from "@/lib/api/crm";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  contactId: string;
  dealId?: string;
  source: "crm" | "contacts";
}

export function SharedContactNotes({ contactId, dealId, source }: Props) {
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<"all" | "crm" | "contacts">("all");

  const refresh = () => setNotes(contactNotesApi.byContact(contactId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const handleAdd = () => {
    if (!content.trim()) return;
    contactNotesApi.create({
      contactId,
      dealId,
      content: content.trim(),
      source,
    });
    toast.success("Note ajoutée.");
    setContent("");
    setAdding(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    contactNotesApi.delete(id);
    refresh();
  };

  const [dealTitles, setDealTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    dealsApi
      .list()
      .then((ds) =>
        setDealTitles(Object.fromEntries(ds.map((d) => [d.id, d.title]))),
      );
  }, []);

  const filtered = notes.filter((n) => filter === "all" || n.source === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> Notes partagées ({notes.length})
        </p>
        <div className="flex items-center gap-1">
          {(["all", "crm", "contacts"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "Toutes" : f === "crm" ? "CRM" : "Contacts"}
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs ml-1"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {adding && (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ajouter une note…"
            className="text-sm min-h-16 resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setAdding(false);
                setContent("");
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={!content.trim()}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune note.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filtered
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .map((note) => (
              <div
                key={note.id}
                className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs h-4 py-0">
                    {note.source === "crm" ? "CRM" : "Contacts"}
                  </Badge>
                  {note.dealId && dealTitles[note.dealId] && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {dealTitles[note.dealId]}
                    </span>
                  )}
                  <span>
                    {formatDistanceToNow(new Date(note.createdAt), {
                      locale: fr,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
