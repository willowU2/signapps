"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Star,
  MoreVertical,
  Trash2,
  Edit2,
  Folder,
  FileIcon,
} from "lucide-react";
import { favoritesApi } from "@/lib/api";
import { toast } from "sonner";

interface FavoriteItem {
  id: string;
  bucket: string;
  key: string;
  is_folder: boolean;
  display_name?: string;
  color?: string;
  sort_order: number;
  filename: string;
}

export interface FavoritesBarProps {
  maxFavorites?: number;
}

/**
 * FavoritesBar - Affiche les favoris en haut a droite de l'interface.
 * Permet de :
 * - Voir les 4 premiers favoris en grid 2x2
 * - Drag-drop pour reorganiser
 * - Clic pour naviguer
 * - Menu pour ajouter/editer/supprimer
 */
export function FavoritesBar({ maxFavorites = 4 }: FavoritesBarProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Fetch favorites on mount
  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const response = await favoritesApi.list();
      const items = response.data?.favorites || [];
      setFavorites(items.slice(0, maxFavorites));
    } catch {
      toast.error("Impossible de charger les favoris");
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (favorite: FavoriteItem) => {
    if (favorite.is_folder) {
      // Navigate to folder in storage
      router.push(
        `/storage?tab=files&bucket=${favorite.bucket}&path=${encodeURIComponent(favorite.key)}`,
      );
    } else {
      // Navigate to bucket with file selected
      router.push(
        `/storage?tab=files&bucket=${favorite.bucket}&path=${encodeURIComponent(
          favorite.key.substring(0, favorite.key.lastIndexOf("/")),
        )}`,
      );
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      await favoritesApi.remove(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      toast.success("Favori supprime");
    } catch {
      toast.error("Impossible de supprimer le favori");
    }
  };

  const handleUpdateFavorite = async (id: string) => {
    try {
      await favoritesApi.update(id, {
        display_name: editName || undefined,
        color: editColor || undefined,
      });
      setFavorites((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                display_name: editName,
                color: editColor,
              }
            : f,
        ),
      );
      setEditingId(null);
      toast.success("Favori mis a jour");
    } catch {
      toast.error("Impossible de mettre a jour le favori");
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (id: string) => {
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragEnd = async () => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Reorder favorites
    const draggedIdx = favorites.findIndex((f) => f.id === draggedId);
    const overIdx = favorites.findIndex((f) => f.id === dragOverId);

    if (draggedIdx < 0 || overIdx < 0) return;

    const newFavorites = [...favorites];
    const [removed] = newFavorites.splice(draggedIdx, 1);
    newFavorites.splice(overIdx, 0, removed);

    setFavorites(newFavorites);

    try {
      const order = newFavorites.map((f) => f.id);
      await favoritesApi.reorder(order);
      toast.success("Favoris reorganises");
    } catch {
      toast.error("Impossible de reorganiser les favoris");
      // Restore original order on error
      fetchFavorites();
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const colors = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Favoris
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAddDialogOpen(true)}
            title="Ajouter un favori"
            aria-label="Ajouter un favori"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-2 h-32 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-muted rounded-lg" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Aucun favori</p>
            <p className="text-xs mt-1">Cliquez sur le + pour en ajouter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                draggable
                onDragStart={() => handleDragStart(favorite.id)}
                onDragOver={() => handleDragOver(favorite.id)}
                onDragEnd={handleDragEnd}
                className={`
                  relative group p-2 rounded-lg border transition-all cursor-move
                  ${draggedId === favorite.id ? "opacity-50 bg-muted" : ""}
                  ${dragOverId === favorite.id && draggedId !== favorite.id ? "bg-muted border-primary" : "hover:bg-muted"}
                `}
                style={{
                  borderLeftColor: favorite.color,
                  borderLeftWidth: favorite.color ? "3px" : undefined,
                }}
              >
                {/* Icon */}
                <div className="flex items-center gap-1 mb-1">
                  {favorite.is_folder ? (
                    <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>

                {/* Name */}
                <p
                  className="text-xs font-medium truncate cursor-pointer hover:underline"
                  onClick={() => handleNavigate(favorite)}
                  title={favorite.display_name || favorite.filename}
                >
                  {favorite.display_name || favorite.filename}
                </p>

                {/* Menu (shown on hover) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Plus d'actions"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingId(favorite.id);
                        setEditName(favorite.display_name || favorite.filename);
                        setEditColor(favorite.color || "");
                      }}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Renommer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleRemoveFavorite(favorite.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {/* Fill remaining slots with empty state */}
            {favorites.length < maxFavorites &&
              [...Array(maxFavorites - favorites.length)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="p-2 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:border-muted-foreground/60 transition-colors"
                  onClick={() => setAddDialogOpen(true)}
                >
                  +
                </div>
              ))}
          </div>
        )}
      </CardContent>

      {/* Edit Favorite Dialog */}
      {editingId && (
        <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le favori</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom d'affichage</Label>
                <Input
                  placeholder="Nom personnalise"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        editColor === color
                          ? "border-gray-800"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => editingId && handleUpdateFavorite(editingId)}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Favorite Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un favori</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p>
              Naviguez vers un fichier ou dossier dans l'onglet "Fichiers", puis
              utilisez le menu contextuel pour l'ajouter aux favoris.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setAddDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
