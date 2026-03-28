"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Table2, Presentation, Clock } from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  sheet: Table2,
  slide: Presentation,
};

const TYPE_LABELS: Record<string, string> = {
  text: "Doc",
  sheet: "Classeur",
  slide: "Présentation",
};

interface RecentDoc {
  id: string;
  name: string;
  kind: string;
  lastOpenedAt: string;
  href: string;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function RecentFiles() {
  const [docs, setDocs] = useState<RecentDoc[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("signapps_recent_docs");
      if (raw) {
        setDocs(JSON.parse(raw).slice(0, 8));
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Fichiers récents
          {docs.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{docs.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun fichier récent</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ouvrez un document, classeur ou une présentation pour le voir ici.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {docs.map((doc) => {
              const Icon = TYPE_ICONS[doc.kind] || FileText;
              const label = TYPE_LABELS[doc.kind] || "Fichier";
              return (
                <li key={doc.id || doc.href}>
                  <Link
                    href={doc.href || '#'}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-[13px]">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {label} &middot; {timeAgo(doc.lastOpenedAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
