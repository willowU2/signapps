"use client";

// IDEA-050: Custom category colors — user-defined categories with custom colors for events

import { useState, useCallback, createContext, useContext } from "react";
import { Plus, Trash2, Tag, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface EventCategory {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

const STORAGE_KEY = "calendar_categories";

const PRESET_COLORS = [
  { bg: "#1a73e8", text: "#ffffff", label: "Blue" },
  { bg: "#0b8043", text: "#ffffff", label: "Green" },
  { bg: "#e67c73", text: "#ffffff", label: "Red" },
  { bg: "#8e24aa", text: "#ffffff", label: "Purple" },
  { bg: "#f6bf26", text: "#1f1f1f", label: "Yellow" },
  { bg: "#e67c00", text: "#ffffff", label: "Orange" },
  { bg: "#039be5", text: "#ffffff", label: "Cyan" },
  { bg: "#33b679", text: "#ffffff", label: "Sage" },
  { bg: "#616161", text: "#ffffff", label: "Graphite" },
  { bg: "#d50000", text: "#ffffff", label: "Tomato" },
  { bg: "#c0ca33", text: "#1f1f1f", label: "Lime" },
  { bg: "#ad1457", text: "#ffffff", label: "Pink" },
];

function getDefaultCategories(): EventCategory[] {
  return [
    { id: "work", name: "Work", color: "#1a73e8", textColor: "#ffffff" },
    {
      id: "personal",
      name: "Personal",
      color: "#33b679",
      textColor: "#ffffff",
    },
    { id: "focus", name: "Focus", color: "#8e24aa", textColor: "#ffffff" },
    {
      id: "external",
      name: "External",
      color: "#e67c73",
      textColor: "#ffffff",
    },
  ];
}

function loadCategories(): EventCategory[] {
  if (typeof window === "undefined") return getDefaultCategories();
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : getDefaultCategories();
  } catch {
    return getDefaultCategories();
  }
}

function persistCategories(cats: EventCategory[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  }
}

// Context for sharing categories across the app
interface CategoryContextValue {
  categories: EventCategory[];
  getCategoryById: (id: string) => EventCategory | undefined;
  getCategoryByName: (name: string) => EventCategory | undefined;
}

const CategoryContext = createContext<CategoryContextValue>({
  categories: getDefaultCategories(),
  getCategoryById: () => undefined,
  getCategoryByName: () => undefined,
});

export function useCategoryContext() {
  return useContext(CategoryContext);
}

// Color swatch
function ColorSwatch({
  color,
  label,
  selected,
  onClick,
}: {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-7 h-7 rounded-full border-2 transition-all",
        selected
          ? "border-foreground scale-110"
          : "border-transparent hover:scale-105",
      )}
      style={{ background: color }}
      title={label}
      onClick={onClick}
    />
  );
}

// Category badge
export function CategoryBadge({
  category,
  size = "sm",
}: {
  category: EventCategory;
  size?: "xs" | "sm";
}) {
  const padding =
    size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding}`}
      style={{ background: category.color, color: category.textColor }}
    >
      <Tag className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {category.name}
    </span>
  );
}

// Category picker (for EventForm)
interface CategoryPickerProps {
  value?: string;
  onChange: (categoryId: string | undefined) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [categories] = useState<EventCategory[]>(loadCategories);
  const [open, setOpen] = useState(false);

  const selected = categories.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-sm">
          {selected ? (
            <>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: selected.color }}
              />
              {selected.name}
            </>
          ) : (
            <>
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              No category
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted text-muted-foreground"
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
        >
          <span className="w-3 h-3 rounded-full border border-muted-foreground/40" />
          None
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted",
              value === cat.id && "bg-muted",
            )}
            onClick={() => {
              onChange(cat.id);
              setOpen(false);
            }}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: cat.color }}
            />
            {cat.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Category manager (settings page)
export function CategoryManager() {
  const [categories, setCategories] = useState<EventCategory[]>(loadCategories);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<EventCategory> | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(PRESET_COLORS[0]);

  const update = (updated: EventCategory[]) => {
    setCategories(updated);
    persistCategories(updated);
  };

  const openCreate = () => {
    setEditing({
      name: "",
      color: PRESET_COLORS[0].bg,
      textColor: PRESET_COLORS[0].text,
    });
    setSelectedPreset(PRESET_COLORS[0]);
    setEditOpen(true);
  };

  const openEdit = (cat: EventCategory) => {
    setEditing({ ...cat });
    const preset =
      PRESET_COLORS.find((p) => p.bg === cat.color) || PRESET_COLORS[0];
    setSelectedPreset(preset);
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!editing?.name?.trim()) {
      toast.error("Nom requis");
      return;
    }
    const cat: EventCategory = {
      id: editing.id || `cat_${Date.now()}`,
      name: editing.name!,
      color: editing.color || "#1a73e8",
      textColor: editing.textColor || "#ffffff",
    };
    const updated = editing.id
      ? categories.map((c) => (c.id === editing.id ? cat : c))
      : [...categories, cat];
    update(updated);
    setEditOpen(false);
    setEditing(null);
    toast.success(editing.id ? "Category updated" : "Category created");
  };

  const handleDelete = (id: string) => {
    update(categories.filter((c) => c.id !== id));
    toast.success("Catégorie supprimée");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-semibold">Event Categories</Label>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={openCreate}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New category
        </Button>
      </div>

      <div className="space-y-1.5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors group"
          >
            <span
              className="w-5 h-5 rounded-full shrink-0 border border-white/30"
              style={{ background: cat.color }}
            />
            <span className="flex-1 text-sm font-medium">{cat.name}</span>
            <CategoryBadge category={cat} size="xs" />
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => openEdit(cat)}
              >
                <Palette className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:text-red-500"
                onClick={() => handleDelete(cat.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Category name</Label>
                <Input
                  className="h-9"
                  value={editing.name || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. Personal, Work, Focus..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <ColorSwatch
                      key={preset.bg}
                      color={preset.bg}
                      label={preset.label}
                      selected={editing.color === preset.bg}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setEditing({
                          ...editing,
                          color: preset.bg,
                          textColor: preset.text,
                        });
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-xs text-muted-foreground">
                    Custom:
                  </Label>
                  <Input
                    type="color"
                    className="h-7 w-16 p-0.5"
                    value={editing.color || "#1a73e8"}
                    onChange={(e) =>
                      setEditing({ ...editing, color: e.target.value })
                    }
                  />
                  {editing.color && editing.name && (
                    <CategoryBadge
                      category={{
                        id: "preview",
                        name: editing.name,
                        color: editing.color,
                        textColor: editing.textColor || "#fff",
                      }}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
