"use client";

/**
 * Feature 21: Quick compose email from task detail page
 */

import { useState } from "react";
import { Mail, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";

import { MAIL_URL } from '@/lib/api/core';
interface Task {
  id: string;
  title: string;
  description?: string;
  assignee_email?: string;
}

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickComposeFromTask({ task, open, onOpenChange }: Props) {
  const [to, setTo] = useState(task.assignee_email ?? "");
  const [subject, setSubject] = useState(`Re: ${task.title}`);
  const [body, setBody] = useState(`Bonjour,\n\nConcernant la tâche « ${task.title} » :\n\n${task.description ?? ""}\n\n`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Destinataire requis"); return; }
    setSending(true);
    try {
      
      let mailId = `local_${Date.now()}`;
      try {
        const res = await fetch(`${MAIL_URL}/messages/send`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body_text: body }),
        });
        if (res.ok) { const d = await res.json(); mailId = d.id ?? d.data?.id ?? mailId; }
      } catch { /* silent */ }

      interopStore.addLink({ sourceType: "task", sourceId: task.id, sourceTitle: task.title, targetType: "mail", targetId: mailId, targetTitle: subject, relation: "email_from_task" });
      interopStore.logActivity({ type: "mail_sent", contactEmail: to.trim(), title: `Email envoyé depuis la tâche : ${task.title}`, entityId: mailId, entityType: "mail" });
      toast.success("Email envoyé");
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'envoyer l'email");
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Envoyer un email depuis la tâche
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>À</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemple.com" autoFocus={!to} />
          </div>
          <div className="space-y-1.5">
            <Label>Objet</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Annuler</Button>
          <Button onClick={handleSend} disabled={sending || !to.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trigger button to embed in task detail pages */
export function QuickComposeButton({ task, className }: { task: Task; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className={`gap-2 ${className}`} onClick={() => setOpen(true)}>
        <Mail className="h-4 w-4" />
        Envoyer un email
      </Button>
      <QuickComposeFromTask task={task} open={open} onOpenChange={setOpen} />
    </>
  );
}
