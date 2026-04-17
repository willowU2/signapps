"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutTemplate,
  Plus,
  MoreVertical,
  Trash2,
  FilePlus,
  Users,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — stored client-side in localStorage (no backend for templates yet)
// ---------------------------------------------------------------------------

export interface SignatureField {
  id: string;
  signerIndex: number;
  /** Label shown above the field */
  label: string;
  /** Relative position (0..1) on the page */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnvelopeTemplate {
  id: string;
  name: string;
  description?: string;
  /** Number of signers in the template */
  signerCount: number;
  fields: SignatureField[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "signapps.signature_templates";

function loadTemplates(): EnvelopeTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EnvelopeTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: EnvelopeTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// ---------------------------------------------------------------------------
// Field colors per signer index
// ---------------------------------------------------------------------------

const SIGNER_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-700",
  "bg-green-100 border-green-300 text-green-700",
  "bg-purple-100 border-purple-300 text-purple-700",
  "bg-orange-100 border-orange-300 text-orange-700",
];

// ---------------------------------------------------------------------------
// Create Template Dialog
// ---------------------------------------------------------------------------

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tpl: EnvelopeTemplate) => void;
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [signerCount, setSignerCount] = useState(1);
  const [fields, setFields] = useState<SignatureField[]>([]);

  const addField = () => {
    const newField: SignatureField = {
      id: crypto.randomUUID(),
      signerIndex: Math.min(signerCount - 1, fields.length),
      label: `Signature ${fields.length + 1}`,
      x: 0.1 + fields.length * 0.05,
      y: 0.7,
      width: 0.3,
      height: 0.08,
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((f) => f.id !== id));

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Le nom du modèle est requis");
      return;
    }
    const tpl: EnvelopeTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      signerCount,
      fields,
      createdAt: new Date().toISOString(),
    };
    const existing = loadTemplates();
    saveTemplates([...existing, tpl]);
    onCreated(tpl);
    setName("");
    setDescription("");
    setSignerCount(1);
    setFields([]);
    onOpenChange(false);
    toast.success("Modèle créé");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un modèle de signature</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nom du modèle</Label>
            <Input
              id="tpl-name"
              placeholder="Contrat standard, NDA, etc."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description (optionnel)</Label>
            <Input
              id="tpl-desc"
              placeholder="Description courte..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-signers">Nombre de signataires</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSignerCount((n) => Math.max(1, n - 1))}
                disabled={signerCount <= 1}
              >
                –
              </Button>
              <span className="text-lg font-semibold w-8 text-center">
                {signerCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSignerCount((n) => Math.min(10, n + 1))}
                disabled={signerCount >= 10}
              >
                +
              </Button>
            </div>
          </div>

          {/* Fields preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Zones de signature</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addField}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Aucune zone définie
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div
                    key={field.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border",
                      SIGNER_COLORS[field.signerIndex % SIGNER_COLORS.length],
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 opacity-40" />
                    <span className="flex-1 text-sm font-medium">
                      {field.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Signataire {field.signerIndex + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeField(field.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>Créer le modèle</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Template Manager (main export)
// ---------------------------------------------------------------------------

interface TemplateManagerProps {
  /** Called when user selects a template to use for a new envelope */
  onUseTemplate?: (template: EnvelopeTemplate) => void;
  className?: string;
}

export function TemplateManager({
  onUseTemplate,
  className,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<EnvelopeTemplate[]>(loadTemplates);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleDelete = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
    toast.success("Modèle supprimé");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Modèles de signature</h3>
          <Badge variant="secondary" className="text-xs">
            {templates.length}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 py-12 gap-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setCreateOpen(true)}
        >
          <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Aucun modèle</p>
            <p className="text-xs text-muted-foreground mt-1">
              Créez un modèle pour accélérer la création d'enveloppes
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate">
                      {tpl.name}
                    </CardTitle>
                    {tpl.description && (
                      <CardDescription className="text-xs mt-0.5 truncate">
                        {tpl.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Plus d'actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onUseTemplate && (
                        <DropdownMenuItem onClick={() => onUseTemplate(tpl)}>
                          <FilePlus className="h-4 w-4 mr-2" />
                          Utiliser ce modèle
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(tpl.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {tpl.signerCount} signataire{tpl.signerCount > 1 ? "s" : ""}
                  </span>
                  <span>
                    {tpl.fields.length} zone{tpl.fields.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {onUseTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 gap-2 text-xs"
                    onClick={() => onUseTemplate(tpl)}
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                    Utiliser
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(tpl) => {
          setTemplates((prev) => [...prev, tpl]);
        }}
      />
    </div>
  );
}
