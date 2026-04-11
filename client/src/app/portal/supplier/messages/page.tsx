"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageTitle } from "@/hooks/use-page-title";
import { portalMessagesApi, type PortalMessage } from "@/lib/api/mailserver";
import { toast } from "sonner";
import {
  Mail,
  MailOpen,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Send,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: fr,
    });
  } catch {
    return dateStr;
  }
}

function getPreview(body: string, maxLen = 100): string {
  const stripped = body.replace(/\n+/g, " ").trim();
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SupplierMessagesPage() {
  usePageTitle("Messages");

  const queryClient = useQueryClient();

  const [selectedMessage, setSelectedMessage] = useState<PortalMessage | null>(
    null,
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portal-supplier-messages"],
    queryFn: async () => {
      const { data } = await portalMessagesApi.list();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: unreadData } = useQuery({
    queryKey: ["portal-supplier-messages-unread"],
    queryFn: async () => {
      const { data } = await portalMessagesApi.unreadCount();
      return data;
    },
  });

  const unreadCount = unreadData?.count ?? 0;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      portalMessagesApi.markRead(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-supplier-messages"] });
      queryClient.invalidateQueries({
        queryKey: ["portal-supplier-messages-unread"],
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      portalMessagesApi.send({
        recipient_email: composeRecipient.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      }),
    onSuccess: () => {
      toast.success("Message envoyé");
      setComposeOpen(false);
      setComposeRecipient("");
      setComposeSubject("");
      setComposeBody("");
      queryClient.invalidateQueries({ queryKey: ["portal-supplier-messages"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSelectMessage = async (msg: PortalMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      markReadMutation.mutate(msg.id);
    }
  };

  const handleSend = () => {
    if (
      !composeRecipient.trim() ||
      !composeSubject.trim() ||
      !composeBody.trim()
    )
      return;
    sendMutation.mutate();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            Messages
            {unreadCount > 0 && (
              <Badge className="bg-rose-500 text-white border-rose-500">
                {unreadCount} non lu{unreadCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Vos échanges avec l&apos;équipe SignApps
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau message
          </Button>
        </div>
      </div>

      {/* Content */}
      {isError ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Impossible de charger les messages.
            </p>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aucun message pour le moment.
            </p>
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Écrire un message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <button
              key={msg.id}
              className={`w-full text-left rounded-xl border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/30 ${
                !msg.is_read ? "border-primary/20 bg-primary/5" : ""
              }`}
              onClick={() => handleSelectMessage(msg)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {msg.is_read ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className={`text-sm truncate ${!msg.is_read ? "font-semibold" : "font-medium"}`}
                      >
                        {msg.subject || "(sans sujet)"}
                      </p>
                      {!msg.is_read && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs shrink-0">
                          Nouveau
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      De : {msg.from_name ?? msg.from_email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {getPreview(msg.body)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {formatDate(msg.created_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Message Detail Dialog */}
      <Dialog
        open={selectedMessage !== null}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMessage?.subject || "(sans sujet)"}
            </DialogTitle>
            <DialogDescription>
              De : {selectedMessage?.from_name ?? selectedMessage?.from_email}
              {selectedMessage && (
                <span className="ml-2 text-xs">
                  &bull; {formatDate(selectedMessage.created_at)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-lg border bg-muted/30 px-4 py-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {selectedMessage?.body}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
            <DialogDescription>
              Envoyez un message à l&apos;équipe SignApps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="compose-recipient">Destinataire</Label>
              <Input
                id="compose-recipient"
                placeholder="contact@signapps.com"
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compose-subject">Sujet</Label>
              <Input
                id="compose-subject"
                placeholder="Objet de votre message"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                placeholder="Rédigez votre message..."
                rows={6}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                sendMutation.isPending ||
                !composeRecipient.trim() ||
                !composeSubject.trim() ||
                !composeBody.trim()
              }
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
