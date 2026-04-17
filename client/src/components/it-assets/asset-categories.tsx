"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Tag,
} from "lucide-react";

export interface AssetCategory {
  id: string;
  name: string;
  parent_id?: string;
  color?: string;
  children?: AssetCategory[];
}

const COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

function CategoryNode({
  cat,
  onDelete,
  depth = 0,
}: {
  cat: AssetCategory;
  onDelete: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (cat.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 ${depth > 0 ? "ml-5" : ""}`}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded((e) => !e)} className="w-4">
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : null}
          </button>
          <span
            className={`h-2.5 w-2.5 rounded-full ${cat.color ?? "bg-blue-500"}`}
          />
          <span className="text-sm font-medium">{cat.name}</span>
          {hasChildren && (
            <Badge variant="secondary" className="text-xs py-0 px-1">
              {cat.children!.length}
            </Badge>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={() => onDelete(cat.id)}
          aria-label="Supprimer"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
      {expanded && hasChildren && (
        <div>
          {cat.children!.map((child) => (
            <CategoryNode
              key={child.id}
              cat={child}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssetCategories() {
  const [categories, setCategories] = useState<AssetCategory[]>([
    {
      id: "1",
      name: "Hardware",
      color: "bg-blue-500",
      children: [
        { id: "1-1", name: "Computers", parent_id: "1", color: "bg-blue-400" },
        {
          id: "1-2",
          name: "Peripherals",
          parent_id: "1",
          color: "bg-blue-300",
        },
      ],
    },
    {
      id: "2",
      name: "Network",
      color: "bg-purple-500",
      children: [
        { id: "2-1", name: "Switches", parent_id: "2", color: "bg-purple-400" },
      ],
    },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    parent_id: "",
    color: COLORS[0],
  });

  const flatList = useMemo(() => {
    const flat: AssetCategory[] = [];
    const traverse = (cats: AssetCategory[]) =>
      cats.forEach((c) => {
        flat.push(c);
        if (c.children) traverse(c.children);
      });
    traverse(categories);
    return flat;
  }, [categories]);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const newCat: AssetCategory = {
      id: Date.now().toString(),
      name: form.name,
      parent_id: form.parent_id || undefined,
      color: form.color,
    };
    if (!form.parent_id) {
      setCategories((c) => [...c, { ...newCat, children: [] }]);
    } else {
      const addToParent = (cats: AssetCategory[]): AssetCategory[] =>
        cats.map((c) =>
          c.id === form.parent_id
            ? { ...c, children: [...(c.children ?? []), newCat] }
            : { ...c, children: addToParent(c.children ?? []) },
        );
      setCategories(addToParent);
    }
    setForm({ name: "", parent_id: "", color: COLORS[0] });
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const remove = (cats: AssetCategory[]): AssetCategory[] =>
      cats
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, children: remove(c.children ?? []) }));
    setCategories(remove);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-500" />
          Asset Categories
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Category
        </Button>
      </CardHeader>
      <CardContent>
        <div className="group space-y-0.5">
          {categories.map((cat) => (
            <CategoryNode key={cat.id} cat={cat} onDelete={handleDelete} />
          ))}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="Category name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Parent (optional)</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.parent_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parent_id: e.target.value }))
                }
              >
                <option value="">Root category</option>
                {flatList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-6 w-6 rounded-full ${c} ring-2 ${form.color === c ? "ring-primary ring-offset-2" : "ring-transparent"}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
