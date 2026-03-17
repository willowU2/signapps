/**
 * Recent Files Widget
 *
 * Affiche les fichiers récemment consultés.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Image,
  FileSpreadsheet,
  FileCode,
  File,
  Folder,
  Video,
  Music,
  Archive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { storageApi } from "@/lib/api/storage";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface FileItem {
  id: string;
  name: string;
  key: string;
  bucket: string;
  mime_type?: string;
  size?: number;
  is_directory?: boolean;
  updated_at?: string;
  thumbnail_url?: string;
}

function getFileIcon(mimeType?: string, isDirectory?: boolean) {
  if (isDirectory) return Folder;
  if (!mimeType) return File;

  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  if (
    mimeType.includes("text/") ||
    mimeType.includes("javascript") ||
    mimeType.includes("json")
  )
    return FileCode;
  if (mimeType.includes("pdf") || mimeType.includes("document"))
    return FileText;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return Archive;

  return File;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  const units = ["o", "Ko", "Mo", "Go"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function WidgetRecentFiles({ widget }: WidgetRenderProps) {
  const config = widget.config as {
    limit?: number;
    showThumbnails?: boolean;
  };
  const limit = config.limit || 8;
  const showThumbnails = config.showThumbnails !== false;

  const { data: files, isLoading } = useQuery({
    queryKey: ["widget-files", limit],
    queryFn: async () => {
      const response = await storageApi.listFiles("default", "", {
        limit,
        sort: "updated_at",
        order: "desc",
      });
      return (response.data.files || []) as FileItem[];
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Fichiers Récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
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
          <FileText className="h-4 w-4 text-primary" />
          Fichiers Récents
          {files && files.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {files.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {!files || files.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Aucun fichier récent
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {files.map((file) => {
                const FileIcon = getFileIcon(file.mime_type, file.is_directory);
                const isImage =
                  showThumbnails &&
                  file.mime_type?.startsWith("image/") &&
                  file.thumbnail_url;

                return (
                  <div
                    key={file.id || file.key}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {isImage ? (
                      <div
                        className="w-8 h-8 rounded bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url(${file.thumbnail_url})` }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {file.name || file.key?.split("/").pop()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatFileSize(file.size)}
                        {file.updated_at && (
                          <span className="ml-1">
                            •{" "}
                            {formatDistanceToNow(new Date(file.updated_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
