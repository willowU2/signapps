"use client";

/**
 * Feature 27: Remote File Browser
 * Tree view of a remote endpoint's filesystem, using agent file-transfer endpoints.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Folder,
  FolderOpen,
  File,
  Download,
  Upload,
  FolderPlus,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronRight,
  ChevronDown,
  Home,
  ArrowLeft,
} from "lucide-react";
import { itAssetsApi, FileTransfer } from "@/lib/api/it-assets";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RemoteFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string;
}

interface BreadcrumbPart {
  name: string;
  path: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes > 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function buildBreadcrumb(path: string): BreadcrumbPart[] {
  const parts = path.split("/").filter(Boolean);
  const crumbs: BreadcrumbPart[] = [{ name: "Root", path: "/" }];
  let built = "";
  for (const p of parts) {
    built = `${built}/${p}`;
    crumbs.push({ name: p, path: built });
  }
  return crumbs;
}

// ─── File browser component ───────────────────────────────────────────────────

interface RemoteFileBrowserProps {
  hardwareId: string;
  agentId: string;
}

export function RemoteFileBrowser({
  hardwareId,
  agentId,
}: RemoteFileBrowserProps) {
  const qc = useQueryClient();
  const [currentPath, setCurrentPath] = useState("/");
  const [selected, setSelected] = useState<RemoteFileEntry | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // ─── Fetch directory listing ──────────────────────────────────────────────

  const {
    data: entries = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remote-files", agentId, currentPath],
    queryFn: async () => {
      const resp = await itAssetsApi.listRemoteFiles(agentId, currentPath);
      return resp.data;
    },
    retry: false,
  });

  // ─── Navigate ────────────────────────────────────────────────────────────

  function navigate(entry: RemoteFileEntry) {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
      setSelected(null);
    } else {
      setSelected(selected?.path === entry.path ? null : entry);
    }
  }

  function navigateTo(path: string) {
    setCurrentPath(path);
    setSelected(null);
  }

  function goUp() {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    navigateTo(parent);
  }

  // ─── Download file ────────────────────────────────────────────────────────

  const downloadMut = useMutation({
    mutationFn: (entry: RemoteFileEntry) =>
      itAssetsApi.pushFile({
        hardware_id: hardwareId,
        filename: entry.name,
        target_path: entry.path,
      }),
    onSuccess: () => {
      // In a real implementation this would trigger browser download
    },
  });

  // ─── Upload file ──────────────────────────────────────────────────────────

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const b64 = btoa(String.fromCharCode(...bytes));
      return itAssetsApi.pushFile({
        hardware_id: hardwareId,
        filename: file.name,
        target_path: `${currentPath}/${file.name}`.replace("//", "/"),
        content_base64: b64,
        size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
      });
    },
    onSuccess: () => {
      setUploadFile(null);
      refetch();
    },
  });

  // ─── Create folder ────────────────────────────────────────────────────────

  const mkdirMut = useMutation({
    mutationFn: (name: string) =>
      itAssetsApi.agentCommand(agentId, {
        action: "mkdir",
        path: `${currentPath}/${name}`.replace("//", "/"),
      }),
    onSuccess: () => {
      setShowNewFolder(false);
      setNewFolderName("");
      refetch();
    },
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: (entry: RemoteFileEntry) =>
      itAssetsApi.agentCommand(agentId, {
        action: "delete",
        path: entry.path,
      }),
    onSuccess: () => {
      setSelected(null);
      refetch();
    },
  });

  const breadcrumb = buildBreadcrumb(currentPath);
  const isRoot = currentPath === "/";

  return (
    <div className="flex flex-col h-full min-h-96 border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isRoot}
          onClick={goUp}
          title="Go up"
          aria-label="Dossier parent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigateTo("/")}
          title="Home"
          aria-label="Racine"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm flex-1 overflow-hidden">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
              <button
                className="hover:underline text-blue-600 truncate max-w-[120px]"
                onClick={() => navigateTo(crumb.path)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => refetch()}
          title="Refresh"
          aria-label="Actualiser"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            aria-hidden="true"
          />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowNewFolder(!showNewFolder)}
          title="New folder"
          aria-label="Nouveau dossier"
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <label
          className="cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          title="Upload file"
        >
          <Upload className="h-3.5 w-3.5" />
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setUploadFile(f);
                uploadMut.mutate(f);
              }
            }}
          />
        </label>
      </div>

      {/* New folder row */}
      {showNewFolder && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-yellow-50">
          <Input
            className="h-7 text-sm flex-1"
            placeholder="New folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim())
                mkdirMut.mutate(newFolderName.trim());
              if (e.key === "Escape") setShowNewFolder(false);
            }}
            autoFocus
          />
          <Button
            size="sm"
            onClick={() =>
              newFolderName.trim() && mkdirMut.mutate(newFolderName.trim())
            }
            disabled={mkdirMut.isPending || !newFolderName.trim()}
          >
            Create
          </Button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto divide-y">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Directory is empty
          </div>
        ) : (
          entries.map((entry) => {
            const isSelected = selected?.path === entry.path;
            return (
              <div
                key={entry.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors",
                  isSelected && "bg-blue-100",
                )}
                onClick={() => navigate(entry)}
                onDoubleClick={() => entry.is_dir && navigate(entry)}
              >
                {entry.is_dir ? (
                  isSelected ? (
                    <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )
                ) : (
                  <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}

                <span className="text-sm flex-1 truncate">{entry.name}</span>

                {!entry.is_dir && (
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {formatSize(entry.size)}
                  </span>
                )}

                {entry.modified && (
                  <span className="text-xs text-gray-400 w-24 text-right hidden md:block">
                    {new Date(entry.modified).toLocaleDateString()}
                  </span>
                )}

                {/* Actions on hover */}
                {isSelected && !entry.is_dir && (
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMut.mutate(entry);
                      }}
                      title="Download"
                      aria-label={`Télécharger ${entry.name}`}
                    >
                      <Download className="h-3 w-3" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMut.mutate(entry);
                      }}
                      title="Delete"
                      aria-label={`Supprimer ${entry.name}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t bg-gray-50 text-xs text-gray-500 flex items-center gap-2">
        <span>{entries.length} items</span>
        {selected && (
          <>
            <span>·</span>
            <span className="font-medium">{selected.name}</span>
            {selected.size !== undefined && (
              <span>({formatSize(selected.size)})</span>
            )}
          </>
        )}
        {(uploadMut.isPending || mkdirMut.isPending) && (
          <span className="ml-auto flex items-center gap-1 text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            {uploadMut.isPending ? "Uploading…" : "Creating…"}
          </span>
        )}
      </div>
    </div>
  );
}
