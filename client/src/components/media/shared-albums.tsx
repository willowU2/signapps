"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Plus,
  Image,
  Trash2,
  Upload,
  X,
  FolderPlus,
  ChevronRight,
} from "lucide-react";

interface AlbumFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: "image" | "video" | "audio";
}

interface Album {
  id: string;
  name: string;
  description?: string;
  files: AlbumFile[];
  created_at: string;
}

export function SharedAlbums() {
  const [albums, setAlbums] = useState<Album[]>([
    {
      id: "1",
      name: "Team Photos",
      description: "Company events",
      files: [],
      created_at: new Date().toISOString(),
    },
  ]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const createAlbum = () => {
    if (!form.name.trim()) return;
    const album: Album = {
      id: Date.now().toString(),
      name: form.name,
      description: form.description || undefined,
      files: [],
      created_at: new Date().toISOString(),
    };
    setAlbums((a) => [...a, album]);
    setForm({ name: "", description: "" });
    setCreateOpen(false);
  };

  const deleteAlbum = (id: string) => {
    setAlbums((a) => a.filter((x) => x.id !== id));
    if (selectedAlbum?.id === id) setSelectedAlbum(null);
  };

  const addFilesToAlbum = (albumId: string, files: FileList | null) => {
    if (!files) return;
    const newFiles: AlbumFile[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}`,
      name: f.name,
      url: URL.createObjectURL(f),
      size: f.size,
      type: f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("video/")
          ? "video"
          : "audio",
    }));
    setAlbums((a) =>
      a.map((album) =>
        album.id === albumId
          ? { ...album, files: [...album.files, ...newFiles] }
          : album,
      ),
    );
    setSelectedAlbum((album) =>
      album?.id === albumId
        ? { ...album!, files: [...album!.files, ...newFiles] }
        : album,
    );
  };

  const removeFile = (albumId: string, fileId: string) => {
    setAlbums((a) =>
      a.map((album) =>
        album.id === albumId
          ? { ...album, files: album.files.filter((f) => f.id !== fileId) }
          : album,
      ),
    );
    setSelectedAlbum((album) =>
      album?.id === albumId
        ? { ...album!, files: album!.files.filter((f) => f.id !== fileId) }
        : album,
    );
  };

  if (selectedAlbum) {
    const album =
      albums.find((a) => a.id === selectedAlbum.id) ?? selectedAlbum;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <button
              onClick={() => setSelectedAlbum(null)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
            >
              Albums <ChevronRight className="h-3 w-3" />
            </button>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-amber-500" />
              {album.name}
              <Badge variant="secondary">{album.files.length} files</Badge>
            </CardTitle>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => addFilesToAlbum(album.id, e.target.files)}
            />
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Add Files
              </span>
            </Button>
          </label>
        </CardHeader>
        <CardContent>
          {album.files.length === 0 ? (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                className="hidden"
                onChange={(e) => addFilesToAlbum(album.id, e.target.files)}
              />
              <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop files here or click to upload
                </p>
              </div>
            </label>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {album.files.map((file) => (
                <div
                  key={file.id}
                  className="relative group aspect-square rounded-lg border overflow-hidden bg-muted"
                >
                  {file.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mt-1 px-2 text-center truncate">
                        {file.name}
                      </p>
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 right-1 h-6 w-6 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(album.id, file.id)}
                    aria-label="Fermer"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            Shared Albums
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1" />
            New Album
          </Button>
        </CardHeader>
        <CardContent>
          {albums.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No albums yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 cursor-pointer group"
                  onClick={() => setSelectedAlbum(album)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{album.name}</p>
                      {album.description && (
                        <p className="text-xs text-muted-foreground">
                          {album.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {album.files.length} file
                        {album.files.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAlbum(album.id);
                      }}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Create Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Album name *</Label>
              <Input
                placeholder="e.g. Team Photos"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={createAlbum} disabled={!form.name.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
