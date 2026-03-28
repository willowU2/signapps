"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Table2, Presentation, Clock } from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, any> = {
  text: FileText,
  sheet: Table2,
  slide: Presentation,
};

interface RecentDoc {
  id: string;
  name: string;
  kind: string;
  lastOpenedAt: string;
  href: string;
}

export function RecentFiles() {
  const docs: RecentDoc[] = (() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("signapps_recent_docs") || "[]").slice(0, 8);
    } catch {
      return [];
    }
  })();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Fichiers récents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun fichier récent</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => {
              const Icon = TYPE_ICONS[doc.kind] || FileText;
              return (
                <li key={doc.id}>
                  <Link
                    href={doc.href}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{doc.name}</span>
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
