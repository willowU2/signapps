/**
 * Unread Emails Widget (AQ-DASHWID)
 *
 * Shows the unread email count with a badge and a direct link to /mail.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Mail, ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { statsApi } from "@/lib/api-mail";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

export function WidgetUnreadEmails({ widget }: WidgetRenderProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["widget-unread-emails"],
    queryFn: () => statsApi.get(),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Emails non lus
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  const unreadCount = stats?.unread_count ?? 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Emails non lus
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-bold leading-none">{unreadCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {unreadCount === 0
                ? "Boîte vide"
                : unreadCount === 1
                ? "message non lu"
                : "messages non lus"}
            </div>
          </div>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="text-xs h-5 px-1.5 rounded-full"
            >
              {unreadCount > 999 ? "999+" : unreadCount}
            </Badge>
          )}
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
          <Link href="/mail">
            Ouvrir
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
