"use client";

import React, { useState } from "react";
import { Send, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RecipientGroup = "Tous" | "RH" | "IT" | "Direction";

interface Newsletter {
  id: string;
  title: string;
  sentAt: Date;
  recipients: RecipientGroup[];
  openRate: number;
}

interface NewsletterEditorProps {
  onSend?: (data: {
    title: string;
    body: string;
    recipients: RecipientGroup[];
    scheduledFor?: Date;
  }) => void;
  initialNewsletters?: Newsletter[];
}

const groupColors: Record<RecipientGroup, string> = {
  Tous: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RH: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  IT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Direction: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function NewsletterEditor({
  onSend,
  initialNewsletters = [],
}: NewsletterEditorProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientGroup[]>(
    []
  );
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newsletters, setNewsletters] = useState<Newsletter[]>(
    initialNewsletters
  );

  const handleRecipientToggle = (group: RecipientGroup) => {
    setSelectedRecipients((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleSendNow = () => {
    if (!title.trim() || !body.trim() || selectedRecipients.length === 0) {
      toast.error("Veuillez remplir le titre, le contenu et sélectionner des destinataires");
      return;
    }

    onSend?.({
      title,
      body,
      recipients: selectedRecipients,
    });

    const newNewsletter: Newsletter = {
      id: Date.now().toString(),
      title,
      sentAt: new Date(),
      recipients: selectedRecipients,
      openRate: Math.round(Math.random() * 100),
    };

    setNewsletters((prev) => [newNewsletter, ...prev]);
    resetForm();
    toast.success("Newsletter envoyée avec succès");
  };

  const handleSchedule = () => {
    if (!title.trim() || !body.trim() || selectedRecipients.length === 0) {
      toast.error("Veuillez remplir le titre, le contenu et sélectionner des destinataires");
      return;
    }

    if (!scheduledDate) {
      toast.error("Veuillez sélectionner une date d'envoi");
      return;
    }

    onSend?.({
      title,
      body,
      recipients: selectedRecipients,
      scheduledFor: scheduledDate,
    });

    toast.success(
      `Newsletter programmée pour ${scheduledDate.toLocaleDateString("fr-FR")}`
    );
    resetForm();
    setShowDatePicker(false);
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSelectedRecipients([]);
    setScheduledDate(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle Newsletter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              placeholder="Ex: Mise à jour importante"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="body">Contenu</Label>
            <Textarea
              id="body"
              placeholder="Écrivez votre message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 min-h-32"
            />
          </div>

          <div>
            <Label>Destinataires</Label>
            <div className="mt-2 space-y-2 p-3 border rounded-md bg-muted/30">
              {(["Tous", "RH", "IT", "Direction"] as RecipientGroup[]).map(
                (group) => (
                  <div key={group} className="flex items-center gap-2">
                    <Checkbox
                      id={`recipient-${group}`}
                      checked={selectedRecipients.includes(group)}
                      onCheckedChange={() => handleRecipientToggle(group)}
                    />
                    <label
                      htmlFor={`recipient-${group}`}
                      className="cursor-pointer flex-1 text-sm"
                    >
                      {group}
                    </label>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSendNow} className="flex-1">
              <Send className="mr-2 h-4 w-4" />
              Envoyer maintenant
            </Button>

            <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Clock className="mr-2 h-4 w-4" />
                  Programmer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Programmer l'envoi</DialogTitle>
                  <DialogDescription>
                    Sélectionnez une date d'envoi pour votre newsletter
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                  <Button onClick={handleSchedule} className="w-full">
                    Confirmer la programmation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Past Newsletters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des newsletters</CardTitle>
        </CardHeader>
        <CardContent>
          {newsletters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune newsletter envoyée pour le moment
            </p>
          ) : (
            <div className="space-y-3">
              {newsletters.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{newsletter.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {newsletter.sentAt.toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {newsletter.openRate}%
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newsletter.recipients.map((group) => (
                      <Badge
                        key={group}
                        className={cn("text-xs", groupColors[group])}
                      >
                        {group}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
