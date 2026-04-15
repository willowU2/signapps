"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Star,
  FileText,
  Folder,
  Globe,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface WidgetProps {
  widget: { config: Record<string, unknown> };
  isEditing: boolean;
}

interface FavoriteItem {
  id: string;
  name: string;
  type: "file" | "folder" | "link";
  path: string;
}

const DEFAULT_FAVORITES: FavoriteItem[] = [
  {
    id: "1",
    name: "Rapport trimestriel Q1",
    type: "file",
    path: "/documents/rapports/q1-2026.pdf",
  },
  {
    id: "2",
    name: "Dossier Marketing",
    type: "folder",
    path: "/documents/marketing",
  },
  {
    id: "3",
    name: "Dashboard Analytics",
    type: "link",
    path: "/admin/monitoring",
  },
  {
    id: "4",
    name: "Budget previsionnel",
    type: "file",
    path: "/documents/finance/budget-2026.xlsx",
  },
  { id: "5", name: "Wiki equipe", type: "link", path: "/wiki" },
];

const typeIcons: Record<string, React.ElementType> = {
  file: FileText,
  folder: Folder,
  link: Globe,
};

export function WidgetFavorites({ widget, isEditing }: WidgetProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(DEFAULT_FAVORITES);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  const addFavorite = () => {
    if (!newName.trim()) return;
    setFavorites((prev) => [
      ...prev,
      { id: `fav-${Date.now()}`, name: newName, type: "link", path: "#" },
    ]);
    setNewName("");
    setAdding(false);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Favoris
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setAdding(!adding)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {adding && (
          <div className="flex gap-1 mb-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du favori..."
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") addFavorite();
              }}
            />
            <Button
              size="sm"
              className="h-7 text-xs px-2"
              onClick={addFavorite}
            >
              OK
            </Button>
          </div>
        )}
        {favorites.map((fav) => {
          const Icon = typeIcons[fav.type] || Globe;
          return (
            <div
              key={fav.id}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{fav.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFavorite(fav.id)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}
        {favorites.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun favori. Cliquez + pour en ajouter.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
