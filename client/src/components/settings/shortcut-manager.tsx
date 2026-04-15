"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, RotateCcw, Keyboard } from "lucide-react";
import { toast } from "sonner";

interface Shortcut {
  id: string;
  name: string;
  category: string;
  keys: string[];
  default: string[];
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    id: "1",
    name: "Nouvelle conversation",
    category: "Chat",
    keys: ["Ctrl", "N"],
    default: ["Ctrl", "N"],
  },
  {
    id: "2",
    name: "Recherche",
    category: "Navigation",
    keys: ["Ctrl", "K"],
    default: ["Ctrl", "K"],
  },
  {
    id: "3",
    name: "Enregistrer",
    category: "Édition",
    keys: ["Ctrl", "S"],
    default: ["Ctrl", "S"],
  },
  {
    id: "4",
    name: "Annuler",
    category: "Édition",
    keys: ["Ctrl", "Z"],
    default: ["Ctrl", "Z"],
  },
  {
    id: "5",
    name: "Refaire",
    category: "Édition",
    keys: ["Ctrl", "Shift", "Z"],
    default: ["Ctrl", "Shift", "Z"],
  },
];

export function ShortcutManager() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("shortcuts");
    if (stored) {
      try {
        setShortcuts(JSON.parse(stored));
      } catch {
        // Fallback to defaults on parse error
      }
    }
  }, []);

  const handleEditClick = (id: string) => {
    setEditingId(id);
    setRecordedKeys([]);
    setIsDialogOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const keys: string[] = [];
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    if (!["Control", "Shift", "Alt"].includes(e.key)) {
      keys.push(e.key.toUpperCase());
    }
    setRecordedKeys(keys.length > 0 ? keys : recordedKeys);
  };

  const handleSaveShortcut = () => {
    if (editingId && recordedKeys.length > 0) {
      const updated = shortcuts.map((s) =>
        s.id === editingId ? { ...s, keys: recordedKeys } : s,
      );
      setShortcuts(updated);
      localStorage.setItem("shortcuts", JSON.stringify(updated));
      toast.success("Raccourci mis à jour");
      setIsDialogOpen(false);
      setEditingId(null);
    }
  };

  const handleReset = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    localStorage.setItem("shortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
    toast.success("Raccourcis réinitialisés");
  };

  const categories = [...new Set(shortcuts.map((s) => s.category))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Raccourcis personnalisés</CardTitle>
            <CardDescription>
              Configurez les raccourcis clavier pour accélérer votre
              productivité.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{shortcut.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {shortcut.keys.join(" + ")}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(shortcut.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier le raccourci</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editingId && shortcuts.find((s) => s.id === editingId)?.name}
            </p>
            <div
              onKeyDown={handleKeyDown}
              className="p-6 rounded-lg border-2 border-dashed bg-muted/30 text-center focus:outline-none focus:border-primary transition-colors"
              tabIndex={0}
            >
              {recordedKeys.length > 0 ? (
                <div className="flex items-center justify-center gap-1">
                  <Keyboard className="w-5 h-5 text-primary" />
                  <span className="font-mono font-semibold text-primary">
                    {recordedKeys.join(" + ")}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Appuyez sur les touches...
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveShortcut}
              disabled={recordedKeys.length === 0}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
