"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Version {
  id: string;
  timestamp: string;
  author: string;
  size: number;
  content: string;
}

const STORAGE_KEY = "signapps-doc-versions";
const MAX_VERSIONS = 10;

function getVersions(docId: string): Version[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[docId] || [];
  } catch {
    return [];
  }
}

function saveVersion(docId: string, content: string, author: string = "admin") {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const versions: Version[] = all[docId] || [];
    // Don't save if content is the same as the last version
    if (versions.length > 0 && versions[0].content === content) return;
    versions.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      author,
      size: new Blob([content]).size,
      content,
    });
    all[docId] = versions.slice(0, MAX_VERSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export { saveVersion };

export function VersionHistoryPanel({
  open,
  onClose,
  docId,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  docId: string;
  onRestore: (content: string) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setVersions(getVersions(docId));
  }, [open, docId]);

  const handleRestore = useCallback(
    (v: Version) => {
      onRestore(v.content);
      toast.success("Version restaurée");
      onClose();
    },
    [onRestore, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <h3 className="font-semibold">Historique des versions</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {versions.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune version sauvegardée</p>
            <p className="text-xs mt-1">
              Les versions sont créées automatiquement toutes les 5 minutes
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {versions.map((v, i) => (
              <div
                key={v.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${selected === v.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                onClick={() => setSelected(selected === v.id ? null : v.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {i === 0
                      ? "Version actuelle"
                      : `Version ${versions.length - i}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(v.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(v.timestamp), {
                    addSuffix: true,
                    locale: fr,
                  })}
                  {" par "}
                  {v.author}
                </div>
                {selected === v.id && i > 0 && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => handleRestore(v)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurer cette version
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
