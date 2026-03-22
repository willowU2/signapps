"use client";

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { storageApi } from "@/lib/api";
import { FEATURES } from "@/lib/features";
import { Clock, RotateCcw, Download } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  size: number;
  content_type: string;
  storage_key: string;
  created_at: string;
}

interface VersionHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  onVersionRestored?: () => void;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function VersionHistorySheet({
  open,
  onOpenChange,
  fileId,
  fileName,
  onVersionRestored,
}: VersionHistorySheetProps) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (open && fileId) {
      loadVersions();
    }
  }, [open, fileId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await storageApi.getFileVersions(fileId);
      setVersions(response.data);
    } catch (error) {
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: FileVersion) => {
    if (
      !confirm(
        `Are you sure you want to restore Version ${version.version_number}? Current file contents will become a new version.`
      )
    )
      return;

    try {
      setRestoringId(version.id);
      await storageApi.restoreFileVersion(fileId, version.id);
      toast.success(`Successfully restored Version ${version.version_number}`);
      onVersionRestored?.();
      onOpenChange(false);
    } catch (error: any) {
      // Note: Current backend returns 501 Not Implemented
      if (error?.response?.status === 501) {
        toast.error(
          "Version restoration is not fully implemented on the server yet.",
          { duration: 5000 }
        );
      } else {
        toast.error("Failed to restore version");
      }
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Version History
          </SheetTitle>
          <div className="text-sm text-muted-foreground mt-2 bg-muted/30 p-3 rounded-md border break-all flex flex-col gap-1">
            <span className="font-medium">File:</span>
            <span className="text-foreground">{fileName}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 mt-6 min-h-0 border rounded-md bg-muted/5 overflow-hidden relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No previous versions found.</p>
              <p className="text-xs mt-2 max-w-[250px]">
                When this file is overwritten, its older contents will appear here.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="flex flex-col gap-3 p-4 border rounded-lg bg-card shadow-sm hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          Version {version.version_number}
                        </span>
                        {index === 0 && (
                          <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-semibold">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(version.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 pt-3 border-t">
                      <div className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                        {formatBytes(version.size)} • {version.content_type}
                      </div>

                      {FEATURES.VERSION_RESTORE ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                          disabled={restoringId !== null}
                          onClick={() => handleRestore(version)}
                        >
                          {restoringId === version.id ? (
                            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5 " />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          View only
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end pt-6 mt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
