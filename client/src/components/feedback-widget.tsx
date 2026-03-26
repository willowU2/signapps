"use client";

import { useState } from "react";
import { toast } from "sonner";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "suggestion" | "other">("suggestion");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: text }),
      });
      setSent(true);
      setTimeout(() => { setSent(false); setOpen(false); setText(""); }, 2000);
    } catch {
      toast.error("Erreur lors de l'envoi du feedback.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center text-lg" title="Feedback">
        ?
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-popover border rounded-lg shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Feedback</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
      </div>
      <div className="flex gap-2">
        {(["bug", "suggestion", "other"] as const).map(t => (
          <button key={t} onClick={() => setType(t)} className={`px-2 py-1 rounded text-xs transition-colors ${type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {t === "bug" ? "Bug" : t === "suggestion" ? "Suggestion" : "Autre"}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Decrivez..." className="w-full h-20 p-2 text-sm border rounded bg-background resize-none" />
      {sent ? (
        <p className="text-sm text-green-500">Merci pour votre retour !</p>
      ) : (
        <button onClick={submit} className="w-full py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">Envoyer</button>
      )}
    </div>
  );
}
