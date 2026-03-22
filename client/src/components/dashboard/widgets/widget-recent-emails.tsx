/**
 * Recent Emails Widget
 *
 * Affiche les emails récents de l'utilisateur.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Star, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface EmailItem {
  id: string;
  subject: string;
  from: string;
  received_at: string;
  is_read: boolean;
  has_attachment?: boolean;
  is_starred?: boolean;
}

export function WidgetRecentEmails({ widget }: WidgetRenderProps) {
  const config = widget.config as {
    limit?: number;
    unreadOnly?: boolean;
  };
  const limit = config.limit || 6;
  const unreadOnly = config.unreadOnly || false;

  const { data: emails, isLoading } = useQuery({
    queryKey: ["widget-emails", limit, unreadOnly],
    queryFn: async () => {
      // Mock data - in production this would call mailApi.listEmails()
      const mockEmails: EmailItem[] = [
        {
          id: "1",
          subject: "Réunion équipe demain à 10h",
          from: "manager@company.com",
          received_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          is_read: false,
          is_starred: true,
        },
        {
          id: "2",
          subject: "Document partagé: Propositions Q1",
          from: "colleague@company.com",
          received_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          is_read: false,
        },
        {
          id: "3",
          subject: "Notification: Accès accordé au projet",
          from: "admin@company.com",
          received_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          is_read: true,
        },
        {
          id: "4",
          subject: "Fwd: Présentation client",
          from: "sales@company.com",
          received_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          is_read: true,
          has_attachment: true,
        },
      ];

      let items = mockEmails;
      if (unreadOnly) {
        items = items.filter((e) => !e.is_read);
      }
      return items.slice(0, limit);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Emails Récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-4 w-4 rounded-full mt-1" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Emails Récents
          {emails && emails.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {emails.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {!emails || emails.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Aucun email
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`p-2 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                    !email.is_read
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {email.is_starred && (
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {email.subject}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {email.from.split("@")[0]}
                        {email.has_attachment && (
                          <span className="ml-1">📎</span>
                        )}
                      </div>
                    </div>
                    {!email.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 ml-4">
                    {formatDistanceToNow(new Date(email.received_at), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
