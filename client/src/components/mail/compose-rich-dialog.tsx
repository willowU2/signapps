"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Minimize2,
  Maximize2,
  Paperclip,
  CalendarDays,
  ChevronDown,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { CalendarContactSuggestions } from "@/components/interop/CalendarContactSuggestions";
import { interopStore } from "@/lib/interop/store";
import { calendarApi } from "@/lib/api/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailComposer } from "./email-editor";
import { mailApi } from "@/lib/api-mail";
import { aiMailApi } from "@/lib/api/ai-mail";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ComposeEncryptToggle } from "./pgp-indicator";
import { encryptMessage } from "./pgp-settings";

import { CALENDAR_URL } from "@/lib/api/core";
// ─── A2: Tone options ────────────────────────────────────────────────────────
const TONE_OPTIONS = [
  "Plus formel",
  "Plus amical",
  "Plus concis",
  "Plus persuasif",
] as const;

// ─── A6: Coaching feedback types ─────────────────────────────────────────────
interface CoachingResult {
  length: string;
  tone: string;
  clarity: string;
  cta: string;
}

function coachingBadgeVariant(
  value: string,
): "default" | "destructive" | "secondary" | "outline" {
  const bad = /trop|agressif|confuse|pas d'appel/i.test(value);
  const warn = /informel/i.test(value);
  if (bad) return "destructive";
  if (warn) return "secondary";
  return "outline";
}

interface ComposeRichDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  replyTo?: {
    email: string;
    subject: string;
  };
}

export function ComposeRichDialog({
  open,
  onOpenChange,
  accountId,
  replyTo,
}: ComposeRichDialogProps) {
  const router = useRouter();
  const [recipient, setRecipient] = useState(replyTo?.email || "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(
    replyTo?.subject ? `Re: ${replyTo.subject}` : "",
  );
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [recipientPublicKey, setRecipientPublicKey] = useState("");

  // Bug 7: Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Idea 44: Calendar availability
  const [showAvailability, setShowAvailability] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const composerRef = useRef<{ insertText?: (text: string) => void }>(null);

  // Idea 45: Dynamic signature — upcoming meeting reminder chip
  const [meetingReminder, setMeetingReminder] = useState<string | null>(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A2: Tone rewriter
  const [rewritingTone, setRewritingTone] = useState(false);
  const [originalBodyBeforeRewrite, setOriginalBodyBeforeRewrite] = useState<
    string | null
  >(null);
  // We store the rewritten body so the EmailComposer can be re-keyed to pick it up
  const [rewrittenBody, setRewrittenBody] = useState<string | null>(null);

  // A6: Email coaching
  const [coaching, setCoaching] = useState(false);
  const [coachingResult, setCoachingResult] = useState<CoachingResult | null>(
    null,
  );
  const currentBodyRef = useRef<string>("");

  useEffect(() => {
    setReminderDismissed(false);
    setMeetingReminder(null);

    const email = recipient.trim();
    if (!email || !email.includes("@")) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data: cals } = await calendarApi.listCalendars();
        if (!Array.isArray(cals) || cals.length === 0) return;

        const now = new Date();
        const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000);

        for (const cal of cals) {
          const { data: events } = await calendarApi.listEvents(
            cal.id,
            now,
            thirtyDaysOut,
          );
          if (!Array.isArray(events)) continue;

          for (const ev of events) {
            if (ev.is_deleted) continue;
            const attendees: any[] = ev.attendees ?? [];
            const hasRecipient = attendees.some(
              (a: any) => (a.email ?? "").toLowerCase() === email.toLowerCase(),
            );
            if (!hasRecipient) continue;

            const start = new Date(ev.start_time);
            if (start <= now) continue;

            // Format: "lundi à 14h00" or "lundi 7 avril à 14h00"
            const isThisWeek = start.getTime() - now.getTime() < 7 * 86400000;
            const dayLabel = start.toLocaleDateString("fr-FR", {
              weekday: "long",
              ...(isThisWeek ? {} : { day: "numeric", month: "long" }),
            });
            const timeLabel = start.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            setMeetingReminder(
              `PS\u00a0: On se voit ${dayLabel} à ${timeLabel} pour "${ev.title}".`,
            );
            return;
          }
        }
      } catch {
        // Silently ignore — calendar context is optional
      }
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [recipient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    // Reset input so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Idea 44: Load next free slots from calendar
  const loadAvailableSlots = useCallback(async () => {
    setLoadingSlots(true);
    setShowAvailability(true);
    try {
      const API = CALENDAR_URL;
      const calsRes = await fetch(`${API}/calendars`, {
        credentials: "include",
      });
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;
      if (!calId) {
        setAvailableSlots(["Aucun calendrier trouvé."]);
        return;
      }
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 86400000);
      const res = await calendarApi.listEvents(calId, now, weekEnd);
      const events = res.data ?? res;
      // Find gaps in working hours (9h-18h) of the next 5 working days
      const slots: string[] = [];
      let day = new Date(now);
      while (slots.length < 5) {
        day.setDate(day.getDate() + 1);
        if (day.getDay() === 0 || day.getDay() === 6) continue;
        const dayStr = day.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        // Simple: try 10h and 14h slots
        for (const hour of [10, 14]) {
          const slotStart = new Date(day);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + 3600000);
          const busy =
            Array.isArray(events) &&
            events.some((ev) => {
              const startVal =
                ev.start_time ||
                (typeof ev.start === "string"
                  ? ev.start
                  : (ev.start as { dateTime?: string } | undefined)
                      ?.dateTime) ||
                "";
              const endVal =
                ev.end_time ||
                (typeof ev.end === "string"
                  ? ev.end
                  : (ev.end as { dateTime?: string } | undefined)?.dateTime) ||
                "";
              const evStart = new Date(startVal);
              const evEnd = new Date(endVal);
              return evStart < slotEnd && evEnd > slotStart;
            });
          if (!busy && slots.length < 5) {
            slots.push(`${dayStr} ${hour}h–${hour + 1}h`);
          }
        }
      }
      setAvailableSlots(
        slots.length > 0 ? slots : ["Aucun créneau trouvé cette semaine."],
      );
    } catch {
      setAvailableSlots(["Impossible de charger le calendrier."]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const insertAvailability = (slots: string[]) => {
    const text = `\n\nVoici mes disponibilités :\n${slots.map((s) => `- ${s}`).join("\n")}\n`;
    // We store it to be inserted via a textarea event — simplest approach
    setSubject((s) => s); // trigger re-render; we'll add to a pending insert field
    toast.info("Disponibilités copiées dans le presse-papier.", {
      description: text,
    });
    navigator.clipboard.writeText(text).catch(() => {});
    setShowAvailability(false);
  };

  // A2: handle tone rewrite — triggered from toolbar
  const handleToneRewrite = useCallback(async (tone: string) => {
    const body = currentBodyRef.current;
    if (!body.trim()) {
      toast.info("Rédigez d'abord le corps de l'email.");
      return;
    }
    setRewritingTone(true);
    setOriginalBodyBeforeRewrite(body);
    try {
      const res = await aiMailApi.rewriteTone(body, tone);
      const rewritten = res?.data?.answer ?? "";
      if (!rewritten) throw new Error("Réponse vide");
      setRewrittenBody(rewritten);
      toast.success(`Ton "${tone}" appliqué — voir ci-dessous.`);
    } catch {
      toast.error("Impossible de réécrire le ton.");
      setOriginalBodyBeforeRewrite(null);
    } finally {
      setRewritingTone(false);
    }
  }, []);

  // A6: email coaching — triggered from "Verifier" button
  const handleCoach = useCallback(async () => {
    const body = currentBodyRef.current;
    if (!body.trim()) {
      toast.info("Rédigez d'abord le corps de l'email.");
      return;
    }
    setCoaching(true);
    setCoachingResult(null);
    try {
      const res = await aiMailApi.coachDraft(body);
      const raw = res?.data?.answer ?? "";
      // Extract JSON — may be wrapped in markdown code block
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON non trouvé dans la réponse");
      const parsed: CoachingResult = JSON.parse(jsonMatch[0]);
      setCoachingResult(parsed);
    } catch {
      toast.error("Impossible d'analyser l'email.");
    } finally {
      setCoaching(false);
    }
  }, []);

  const handleSave = useCallback(
    async (html: string, design: object) => {
      // Track current body for A2/A6
      currentBodyRef.current = html;
      if (!accountId) {
        toast.error("Sélectionnez d'abord un compte mail");
        return;
      }
      try {
        await mailApi.send({
          account_id: accountId,
          recipient: recipient.trim(),
          subject: subject.trim() || "(Sans objet)",
          body_html: html,
          // Store design as JSON for future editing
          metadata: JSON.stringify({ design }),
        });
        toast.success("Brouillon enregistré");
      } catch {
        toast.error("Erreur lors de l'enregistrement");
      }
    },
    [accountId, recipient, subject],
  );

  const handleSend = useCallback(
    async (html: string, _design: object) => {
      // Track current body for A2/A6
      currentBodyRef.current = html;
      if (!recipient.trim()) {
        toast.error("Veuillez saisir un destinataire");
        return;
      }

      if (!accountId) {
        toast.error("Sélectionnez d'abord un compte mail");
        return;
      }
      setIsSending(true);
      try {
        let bodyHtml = html;

        // Encrypt if enabled and recipient key is provided
        if (encryptEnabled && recipientPublicKey.trim()) {
          try {
            bodyHtml = await encryptMessage(recipientPublicKey, html);
          } catch {
            toast.error(
              "Chiffrement échoué. Vérifiez la clé publique du destinataire.",
            );
            setIsSending(false);
            return;
          }
        } else if (encryptEnabled && !recipientPublicKey.trim()) {
          toast.error(
            "Veuillez fournir la clé publique du destinataire pour chiffrer.",
          );
          setIsSending(false);
          return;
        }

        // Bug 7: encode attachments as base64 and include in metadata
        let attachmentData: {
          name: string;
          type: string;
          size: number;
          data: string;
        }[] = [];
        if (attachments.length > 0) {
          attachmentData = await Promise.all(
            attachments.map(
              (file) =>
                new Promise<{
                  name: string;
                  type: string;
                  size: number;
                  data: string;
                }>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve({
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      data: (reader.result as string).split(",")[1] || "",
                    });
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                }),
            ),
          );
        }

        await mailApi.send({
          account_id: accountId,
          recipient: recipient.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim() || "(Sans objet)",
          body_html: bodyHtml,
          metadata:
            attachmentData.length > 0
              ? JSON.stringify({ attachments: attachmentData })
              : undefined,
        });
        toast.success(
          encryptEnabled ? "Encrypted email sent!" : "Email envoyé !",
          {
            action: {
              label: "Voir",
              onClick: () => router.push("/mail"),
            },
          },
        );
        // Feature 5: auto-log sent email in activity timeline
        interopStore.logActivity({
          type: "mail_sent",
          contactEmail: recipient.trim(),
          title: `Email envoyé : ${subject.trim() || "(Sans objet)"}`,
          description: `À ${recipient.trim()}`,
          entityId: Date.now().toString(),
          entityType: "mail",
        });
        handleReset();
        onOpenChange(false);
      } catch {
        toast.error("Erreur lors de l'envoi");
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accountId,
      recipient,
      cc,
      bcc,
      subject,
      onOpenChange,
      encryptEnabled,
      recipientPublicKey,
      attachments,
    ],
  );

  const handleReset = () => {
    setRecipient("");
    setCc("");
    setBcc("");
    setSubject("");
    setShowCcBcc(false);
    setEncryptEnabled(false);
    setRecipientPublicKey("");
    setAttachments([]);
    setMeetingReminder(null);
    setReminderDismissed(false);
    setRewrittenBody(null);
    setOriginalBodyBeforeRewrite(null);
    setCoachingResult(null);
    currentBodyRef.current = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleReset();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          isFullscreen
            ? "w-screen h-screen max-w-none max-h-none rounded-none"
            : "w-[calc(100vw-2rem)] max-w-4xl h-[85vh] max-h-[calc(100vh-2rem)]",
        )}
        data-testid="mail-compose-dialog"
      >
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-lg font-semibold">
            Nouveau message
          </DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Email fields */}
          <div className="px-4 py-2 space-y-2 border-b bg-muted/30">
            <div className="flex items-center gap-2 relative">
              <Label className="w-12 text-sm text-muted-foreground">À</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="destinataire@exemple.com"
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                data-testid="mail-compose-to"
              />
              {/* Feature 9: Contact suggestions from calendar events */}
              <CalendarContactSuggestions
                query={recipient}
                onSelect={(c) => setRecipient(c.email)}
                className="absolute top-full left-0 right-0 z-50 mt-1"
              />
              {!showCcBcc && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setShowCcBcc(true)}
                >
                  Cc/Cci
                </Button>
              )}
            </div>

            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-12 text-sm text-muted-foreground">
                    Cc
                  </Label>
                  <Input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="copie@exemple.com"
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-12 text-sm text-muted-foreground">
                    Cci
                  </Label>
                  <Input
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="copie-cachee@exemple.com"
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Label className="w-12 text-sm text-muted-foreground">
                Objet
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Objet de l'email"
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
              />
            </div>

            {/* PGP Encryption Toggle */}
            <ComposeEncryptToggle
              accountId={accountId ?? ""}
              enabled={encryptEnabled}
              onToggle={setEncryptEnabled}
              recipientPublicKey={recipientPublicKey}
              onRecipientKeyChange={setRecipientPublicKey}
            />

            {/* Bug 7: Attachment button + Idea 44: Calendar availability + A2: Tone + A6: Verifier */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1.5 px-2 h-7"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Joindre un fichier
              </Button>

              {/* A2: Tone rewriter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-violet-600 dark:text-violet-400 gap-1.5 px-2 h-7"
                    disabled={rewritingTone}
                  >
                    {rewritingTone ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Ton
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {TONE_OPTIONS.map((tone) => (
                    <DropdownMenuItem
                      key={tone}
                      onClick={() => handleToneRewrite(tone)}
                    >
                      {tone}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* A6: Pre-send coaching button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-teal-600 dark:text-teal-400 gap-1.5 px-2 h-7"
                onClick={handleCoach}
                disabled={coaching}
              >
                {coaching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Verifier
              </Button>
              {/* Idea 44: Insert availability */}
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 dark:text-blue-400 gap-1.5 px-2 h-7"
                  onClick={loadAvailableSlots}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Insérer disponibilités
                </Button>
                {showAvailability && (
                  <div className="absolute bottom-8 left-0 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 min-w-[280px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">
                        Créneaux libres
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAvailability(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {loadingSlots ? (
                      <p className="text-xs text-muted-foreground">
                        Chargement…
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {availableSlots.map((slot, i) => (
                          <div
                            key={i}
                            className="text-xs py-0.5 text-foreground"
                          >
                            • {slot}
                          </div>
                        ))}
                        {availableSlots.length > 0 &&
                          !availableSlots[0].startsWith("Aucun") &&
                          !availableSlots[0].startsWith("Impossible") && (
                            <Button
                              type="button"
                              size="sm"
                              className="mt-2 h-6 text-xs px-2 w-full"
                              onClick={() => insertAvailability(availableSlots)}
                            >
                              Copier dans le presse-papier
                            </Button>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {attachments.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 max-w-[200px] truncate"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* A6: Coaching result badges */}
            {coachingResult && (
              <div className="w-full mt-1.5 p-2.5 rounded-lg border border-teal-200/60 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-900/20 flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 mr-1">
                  Analyse :
                </span>
                {(Object.entries(coachingResult) as [string, string][]).map(
                  ([key, value]) => (
                    <Badge
                      key={key}
                      variant={coachingBadgeVariant(value)}
                      className="text-[11px] h-5 px-2"
                    >
                      {value}
                    </Badge>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setCoachingResult(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  title="Fermer l'analyse"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* A2: Tone rewrite result panel */}
            {rewrittenBody && (
              <div className="w-full mt-1.5 p-2.5 rounded-lg border border-violet-200/60 dark:border-violet-800/60 bg-violet-50/60 dark:bg-violet-900/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">
                    Version réécrite :
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline font-medium"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(rewrittenBody)
                          .catch(() => {});
                        toast.success("Copié dans le presse-papier.");
                      }}
                    >
                      Copier
                    </button>
                    {originalBodyBeforeRewrite && (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:underline"
                        onClick={() => {
                          setRewrittenBody(null);
                          setOriginalBodyBeforeRewrite(null);
                        }}
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRewrittenBody(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                  {rewrittenBody}
                </p>
              </div>
            )}

            {/* Idea 45: Dynamic signature — meeting reminder chip */}
            {meetingReminder && !reminderDismissed && (
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1 max-w-full">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span className="truncate">{meetingReminder}</span>
                  <button
                    type="button"
                    onClick={() => setReminderDismissed(true)}
                    className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 shrink-0"
                    title="Masquer ce rappel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Email Editor */}
          <div className="flex-1 overflow-hidden">
            <EmailComposer onSave={handleSave} onSend={handleSend} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComposeRichDialog;
