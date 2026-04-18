"use client";

/**
 * Editor panel for the "Choix d'image" (ImageChoice) field type.
 * Lets the creator add/remove/reorder image options with label + image URL
 * or uploaded file (stored as base64 data URL for simplicity).
 */

import { useRef } from "react";
import type { FormField } from "@/lib/api/forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Plus, Trash2, Link as LinkIcon, Image as ImageIcon } from "lucide-react";

interface ImageChoiceEditorProps {
  field: FormField;
  onUpdate: (patch: Partial<FormField>) => void;
}

interface ImageOption {
  label: string;
  imageUrl: string;
}

export function ImageChoiceEditor({ field, onUpdate }: ImageChoiceEditorProps) {
  const options: ImageOption[] = field.settings?.imageOptions || [];
  const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  const patch = (next: ImageOption[]) => {
    onUpdate({
      settings: { ...(field.settings || {}), imageOptions: next },
    });
  };

  const addOption = () => {
    patch([
      ...options,
      { label: `Option ${options.length + 1}`, imageUrl: "" },
    ]);
  };

  const updateOption = (i: number, k: keyof ImageOption, v: string) => {
    const next = [...options];
    next[i] = { ...next[i], [k]: v };
    patch(next);
  };

  const removeOption = (i: number) => {
    patch(options.filter((_, idx) => idx !== i));
  };

  const handleUpload = (i: number, file: File) => {
    if (file.size > 1024 * 1024) {
      alert("Image trop grande (max 1 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateOption(i, "imageUrl", ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 mb-4 bg-muted/20 p-3 rounded-md border">
      <div className="flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Images sélectionnables
        </Label>
      </div>

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-3">
          Aucune image. Ajoute-en pour proposer un choix visuel.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt, i) => (
          <div
            key={i}
            className="rounded-md border bg-background p-2 space-y-2"
          >
            {/* Preview */}
            <div className="relative aspect-video rounded bg-muted/40 overflow-hidden flex items-center justify-center">
              {opt.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={opt.imageUrl}
                  alt={opt.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-[10px]">Aucune image</span>
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removeOption(i)}
                title="Supprimer cette option"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* Label */}
            <Input
              className="h-8 text-xs"
              value={opt.label}
              onChange={(e) => updateOption(i, "label", e.target.value)}
              placeholder="Libellé (ex: Rouge)"
            />

            {/* URL + upload */}
            <div className="flex gap-1">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  className="h-7 text-[10px] pl-7"
                  value={opt.imageUrl}
                  onChange={(e) =>
                    updateOption(i, "imageUrl", e.target.value)
                  }
                  placeholder="URL de l'image..."
                />
              </div>
              <input
                ref={(el) => {
                  fileInputsRef.current[i] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(i, f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => fileInputsRef.current[i]?.click()}
                title="Uploader une image"
              >
                <Upload className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs border-dashed"
        onClick={addOption}
      >
        <Plus className="h-3 w-3 mr-1" /> Ajouter une image
      </Button>
    </div>
  );
}
