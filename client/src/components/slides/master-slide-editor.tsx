"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  Check,
  Image,
  Type,
  Hash,
  AlignLeft,
  X,
  Copy,
} from "lucide-react";
import type { SlideLayout } from "./use-slides";
import type * as fabric from "fabric";

/** Fabric object extended with master-slide metadata properties */
interface MasterFabricObject extends fabric.IText {
  _masterFooter?: boolean;
  _masterSlideNumber?: boolean;
  _masterElement?: boolean;
}

/** Minimal fabric module interface used by applyMasterToCanvas */
interface FabricModule {
  IText: new (
    text: string,
    options?: Record<string, unknown>,
  ) => MasterFabricObject;
}

/** Minimal fabric canvas interface used by applyMasterToCanvas */
interface FabricCanvas {
  backgroundColor: string;
  width: number;
  height: number;
  getObjects(): MasterFabricObject[];
  add(obj: MasterFabricObject): void;
  sendObjectToBack(obj: MasterFabricObject): void;
  requestRenderAll(): void;
}

// --- Master Slide Data ---

export interface MasterSlideZone {
  id: string;
  type: "title" | "content" | "image" | "footer" | "slideNumber";
  label: string;
  x: number; // percent of slide width
  y: number; // percent of slide height
  width: number; // percent
  height: number; // percent
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface MasterSlide {
  id: string;
  name: string;
  backgroundColor: string;
  backgroundImage?: string; // data URL or empty
  logoUrl?: string; // data URL or empty
  logoPosition?: { x: number; y: number; width: number; height: number };
  footerText?: string;
  showSlideNumber?: boolean;
  zones: MasterSlideZone[];
}

// --- Default Master Slides ---

export const DEFAULT_MASTERS: MasterSlide[] = [
  {
    id: "master-title",
    name: "Titre",
    backgroundColor: "#ffffff",
    showSlideNumber: false,
    zones: [
      {
        id: "z1",
        type: "title",
        label: "Titre",
        x: 10,
        y: 30,
        width: 80,
        height: 15,
        fontSize: 36,
        fontFamily: "Inter, sans-serif",
        color: "#1e293b",
        align: "center",
      },
      {
        id: "z2",
        type: "content",
        label: "Sous-titre",
        x: 20,
        y: 50,
        width: 60,
        height: 10,
        fontSize: 18,
        fontFamily: "Inter, sans-serif",
        color: "#64748b",
        align: "center",
      },
    ],
  },
  {
    id: "master-content",
    name: "Titre et contenu",
    backgroundColor: "#ffffff",
    showSlideNumber: true,
    footerText: "",
    zones: [
      {
        id: "z1",
        type: "title",
        label: "Titre",
        x: 5,
        y: 3,
        width: 90,
        height: 10,
        fontSize: 28,
        fontFamily: "Inter, sans-serif",
        color: "#1e293b",
        align: "left",
      },
      {
        id: "z2",
        type: "content",
        label: "Contenu",
        x: 5,
        y: 16,
        width: 90,
        height: 70,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        color: "#334155",
        align: "left",
      },
      {
        id: "z3",
        type: "slideNumber",
        label: "#",
        x: 90,
        y: 92,
        width: 8,
        height: 5,
        fontSize: 12,
        color: "#94a3b8",
        align: "right",
      },
    ],
  },
  {
    id: "master-two-col",
    name: "Deux colonnes",
    backgroundColor: "#ffffff",
    showSlideNumber: true,
    zones: [
      {
        id: "z1",
        type: "title",
        label: "Titre",
        x: 5,
        y: 3,
        width: 90,
        height: 10,
        fontSize: 28,
        fontFamily: "Inter, sans-serif",
        color: "#1e293b",
        align: "left",
      },
      {
        id: "z2",
        type: "content",
        label: "Colonne gauche",
        x: 5,
        y: 16,
        width: 42,
        height: 70,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        color: "#334155",
        align: "left",
      },
      {
        id: "z3",
        type: "content",
        label: "Colonne droite",
        x: 52,
        y: 16,
        width: 42,
        height: 70,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        color: "#334155",
        align: "left",
      },
      {
        id: "z4",
        type: "slideNumber",
        label: "#",
        x: 90,
        y: 92,
        width: 8,
        height: 5,
        fontSize: 12,
        color: "#94a3b8",
        align: "right",
      },
    ],
  },
  {
    id: "master-image-left",
    name: "Image + texte",
    backgroundColor: "#ffffff",
    showSlideNumber: true,
    zones: [
      {
        id: "z1",
        type: "title",
        label: "Titre",
        x: 52,
        y: 5,
        width: 44,
        height: 10,
        fontSize: 24,
        fontFamily: "Inter, sans-serif",
        color: "#1e293b",
        align: "left",
      },
      {
        id: "z2",
        type: "image",
        label: "Image",
        x: 3,
        y: 5,
        width: 44,
        height: 85,
        fontSize: 14,
        color: "#94a3b8",
        align: "center",
      },
      {
        id: "z3",
        type: "content",
        label: "Contenu",
        x: 52,
        y: 18,
        width: 44,
        height: 68,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        color: "#334155",
        align: "left",
      },
      {
        id: "z4",
        type: "slideNumber",
        label: "#",
        x: 90,
        y: 92,
        width: 8,
        height: 5,
        fontSize: 12,
        color: "#94a3b8",
        align: "right",
      },
    ],
  },
  {
    id: "master-section",
    name: "Section",
    backgroundColor: "#1e293b",
    showSlideNumber: false,
    zones: [
      {
        id: "z1",
        type: "title",
        label: "Titre de section",
        x: 10,
        y: 40,
        width: 80,
        height: 15,
        fontSize: 36,
        fontFamily: "Inter, sans-serif",
        color: "#ffffff",
        align: "center",
      },
      {
        id: "z2",
        type: "content",
        label: "Description",
        x: 20,
        y: 58,
        width: 60,
        height: 8,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        color: "#94a3b8",
        align: "center",
      },
    ],
  },
  {
    id: "master-blank",
    name: "Vierge",
    backgroundColor: "#ffffff",
    showSlideNumber: false,
    zones: [],
  },
];

// --- Zone Type Icon ---
function ZoneTypeIcon({ type }: { type: MasterSlideZone["type"] }) {
  switch (type) {
    case "title":
      return <Type className="w-3 h-3" />;
    case "content":
      return <AlignLeft className="w-3 h-3" />;
    case "image":
      return <Image className="w-3 h-3" />;
    case "footer":
      return <AlignLeft className="w-3 h-3" />;
    case "slideNumber":
      return <Hash className="w-3 h-3" />;
  }
}

// --- Master Slide Preview ---
function MasterPreview({
  master,
  isActive,
  onClick,
}: {
  master: MasterSlide;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[16/10] rounded-md border overflow-hidden transition-all",
        "hover:ring-2 hover:ring-primary/50",
        isActive ? "ring-2 ring-primary border-primary" : "border-border",
      )}
      style={{ backgroundColor: master.backgroundColor }}
    >
      {/* Render zone placeholders */}
      {master.zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute border border-dashed rounded-sm flex items-center justify-center"
          style={{
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
            borderColor: zone.color ? `${zone.color}40` : "#94a3b840",
          }}
        >
          <span
            className="text-[6px] truncate px-0.5 opacity-60"
            style={{ color: zone.color || "#94a3b8" }}
          >
            {zone.label}
          </span>
        </div>
      ))}

      {/* Active badge */}
      {isActive && (
        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
          <Check className="w-2 h-2" />
        </div>
      )}
    </button>
  );
}

// --- Master Slide Editor Component ---

interface MasterSlideEditorProps {
  masters: MasterSlide[];
  activeMasterId: string | null;
  onSelectMaster: (masterId: string) => void;
  onUpdateMaster: (master: MasterSlide) => void;
  onAddMaster: (master: MasterSlide) => void;
  onDeleteMaster: (masterId: string) => void;
  onClose: () => void;
}

export function MasterSlideEditor({
  masters,
  activeMasterId,
  onSelectMaster,
  onUpdateMaster,
  onAddMaster,
  onDeleteMaster,
  onClose,
}: MasterSlideEditorProps) {
  const [editingMaster, setEditingMaster] = useState<MasterSlide | null>(null);
  const [editingZone, setEditingZone] = useState<MasterSlideZone | null>(null);

  const activeMaster = masters.find((m) => m.id === activeMasterId);

  const handleStartEdit = (master: MasterSlide) => {
    setEditingMaster({ ...master });
    setEditingZone(null);
  };

  const handleSaveEdit = () => {
    if (editingMaster) {
      onUpdateMaster(editingMaster);
      setEditingMaster(null);
      setEditingZone(null);
    }
  };

  const handleDuplicate = (master: MasterSlide) => {
    const newMaster: MasterSlide = {
      ...master,
      id: `master-${Math.random().toString(36).substr(2, 9)}`,
      name: `${master.name} (copie)`,
      zones: master.zones.map((z) => ({
        ...z,
        id: `z-${Math.random().toString(36).substr(2, 6)}`,
      })),
    };
    onAddMaster(newMaster);
  };

  const handleAddZone = (type: MasterSlideZone["type"]) => {
    if (!editingMaster) return;
    const newZone: MasterSlideZone = {
      id: `z-${Math.random().toString(36).substr(2, 6)}`,
      type,
      label:
        type === "title"
          ? "Titre"
          : type === "content"
            ? "Contenu"
            : type === "image"
              ? "Image"
              : type === "slideNumber"
                ? "#"
                : "Pied de page",
      x: 10,
      y: 10,
      width: 30,
      height: 15,
      fontSize: type === "title" ? 28 : 16,
      fontFamily: "Inter, sans-serif",
      color: "#334155",
      align: "left",
    };
    setEditingMaster({
      ...editingMaster,
      zones: [...editingMaster.zones, newZone],
    });
  };

  const handleUpdateZone = (
    zoneId: string,
    updates: Partial<MasterSlideZone>,
  ) => {
    if (!editingMaster) return;
    setEditingMaster({
      ...editingMaster,
      zones: editingMaster.zones.map((z) =>
        z.id === zoneId ? { ...z, ...updates } : z,
      ),
    });
    if (editingZone && editingZone.id === zoneId) {
      setEditingZone({ ...editingZone, ...updates });
    }
  };

  const handleRemoveZone = (zoneId: string) => {
    if (!editingMaster) return;
    setEditingMaster({
      ...editingMaster,
      zones: editingMaster.zones.filter((z) => z.id !== zoneId),
    });
    if (editingZone?.id === zoneId) setEditingZone(null);
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {editingMaster ? "Modifier le modele" : "Modeles de diapositives"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={editingMaster ? () => setEditingMaster(null) : onClose}
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!editingMaster ? (
          /* Master List View */
          <div className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Choisissez un modele pour structurer vos diapositives. Les
              modifications s'appliquent a toutes les diapositives utilisant ce
              modele.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {masters.map((master) => (
                <div key={master.id} className="space-y-1.5">
                  <MasterPreview
                    master={master}
                    isActive={activeMasterId === master.id}
                    onClick={() => onSelectMaster(master.id)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">
                      {master.name}
                    </span>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleStartEdit(master)}
                        title="Modifier"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleDuplicate(master)}
                        title="Dupliquer"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </Button>
                      {!master.id.startsWith("master-") ||
                      masters.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-destructive"
                          onClick={() => onDeleteMaster(master.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                const newMaster: MasterSlide = {
                  id: `master-${Math.random().toString(36).substr(2, 9)}`,
                  name: "Nouveau modele",
                  backgroundColor: "#ffffff",
                  showSlideNumber: false,
                  zones: [],
                };
                onAddMaster(newMaster);
                handleStartEdit(newMaster);
              }}
            >
              <Plus className="w-4 h-4" />
              Nouveau modele
            </Button>
          </div>
        ) : (
          /* Master Edit View */
          <div className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs">Nom</Label>
              <Input
                value={editingMaster.name}
                onChange={(e) =>
                  setEditingMaster({ ...editingMaster, name: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>

            {/* Background Color */}
            <div className="space-y-1">
              <Label className="text-xs">Couleur de fond</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editingMaster.backgroundColor}
                  onChange={(e) =>
                    setEditingMaster({
                      ...editingMaster,
                      backgroundColor: e.target.value,
                    })
                  }
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={editingMaster.backgroundColor}
                  onChange={(e) =>
                    setEditingMaster({
                      ...editingMaster,
                      backgroundColor: e.target.value,
                    })
                  }
                  className="h-8 text-sm flex-1"
                />
              </div>
            </div>

            {/* Footer Text */}
            <div className="space-y-1">
              <Label className="text-xs">Texte de pied de page</Label>
              <Input
                value={editingMaster.footerText || ""}
                onChange={(e) =>
                  setEditingMaster({
                    ...editingMaster,
                    footerText: e.target.value,
                  })
                }
                className="h-8 text-sm"
                placeholder="Ex: Mon Entreprise - Confidentiel"
              />
            </div>

            {/* Preview */}
            <div className="space-y-1">
              <Label className="text-xs">Apercu</Label>
              <div
                className="w-full aspect-[16/10] rounded-md border relative overflow-hidden"
                style={{ backgroundColor: editingMaster.backgroundColor }}
              >
                {editingMaster.zones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => setEditingZone(zone)}
                    className={cn(
                      "absolute border-2 border-dashed rounded-sm flex items-center justify-center transition-colors cursor-pointer",
                      editingZone?.id === zone.id
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/30 hover:border-primary/50",
                    )}
                    style={{
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      width: `${zone.width}%`,
                      height: `${zone.height}%`,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <ZoneTypeIcon type={zone.type} />
                      <span
                        className="text-[7px] truncate"
                        style={{ color: zone.color || "#94a3b8" }}
                      >
                        {zone.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Add Zone */}
            <div className="space-y-1">
              <Label className="text-xs">Ajouter une zone</Label>
              <div className="flex gap-1 flex-wrap">
                {(
                  [
                    "title",
                    "content",
                    "image",
                    "footer",
                    "slideNumber",
                  ] as MasterSlideZone["type"][]
                ).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleAddZone(type)}
                  >
                    <ZoneTypeIcon type={type} />
                    {type === "title"
                      ? "Titre"
                      : type === "content"
                        ? "Contenu"
                        : type === "image"
                          ? "Image"
                          : type === "footer"
                            ? "Pied"
                            : "#"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Zone List */}
            {editingMaster.zones.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">
                  Zones ({editingMaster.zones.length})
                </Label>
                <div className="space-y-1">
                  {editingMaster.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded text-xs border cursor-pointer transition-colors",
                        editingZone?.id === zone.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted",
                      )}
                      onClick={() => setEditingZone(zone)}
                    >
                      <div className="flex items-center gap-1.5">
                        <ZoneTypeIcon type={zone.type} />
                        <span>{zone.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveZone(zone.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zone Editor */}
            {editingZone && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-semibold">
                  Zone: {editingZone.label}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">X (%)</Label>
                    <Input
                      type="number"
                      value={editingZone.x}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          x: Number(e.target.value),
                        })
                      }
                      className="h-7 text-xs"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Y (%)</Label>
                    <Input
                      type="number"
                      value={editingZone.y}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          y: Number(e.target.value),
                        })
                      }
                      className="h-7 text-xs"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Largeur (%)</Label>
                    <Input
                      type="number"
                      value={editingZone.width}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          width: Number(e.target.value),
                        })
                      }
                      className="h-7 text-xs"
                      min={1}
                      max={100}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Hauteur (%)</Label>
                    <Input
                      type="number"
                      value={editingZone.height}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          height: Number(e.target.value),
                        })
                      }
                      className="h-7 text-xs"
                      min={1}
                      max={100}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Label</Label>
                  <Input
                    value={editingZone.label}
                    onChange={(e) =>
                      handleUpdateZone(editingZone.id, {
                        label: e.target.value,
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Taille police</Label>
                    <Input
                      type="number"
                      value={editingZone.fontSize || 16}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="h-7 text-xs"
                      min={8}
                      max={72}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Couleur</Label>
                    <input
                      type="color"
                      value={editingZone.color || "#334155"}
                      onChange={(e) =>
                        handleUpdateZone(editingZone.id, {
                          color: e.target.value,
                        })
                      }
                      className="w-7 h-7 rounded border cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditingMaster(null)}
              >
                Annuler
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSaveEdit}>
                <Check className="w-4 h-4 mr-1" />
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Utility: Apply master to a fabric canvas ---

export function applyMasterToCanvas(
  canvas: FabricCanvas,
  master: MasterSlide,
  slideIndex: number,
  fabricModule: FabricModule,
) {
  // Set background
  canvas.backgroundColor = master.backgroundColor;

  // Render footer if exists
  if (master.footerText) {
    const footerObj = canvas
      .getObjects()
      .find((o: MasterFabricObject) => o._masterFooter);
    if (footerObj) {
      footerObj.set({ text: master.footerText });
    } else {
      const footer = new fabricModule.IText(master.footerText, {
        left: canvas.width * 0.05,
        top: canvas.height * 0.92,
        fontSize: 10,
        fontFamily: "Inter, sans-serif",
        fill: "#94a3b8",
        selectable: false,
        evented: false,
      });
      footer._masterFooter = true;
      footer._masterElement = true;
      canvas.add(footer);
      canvas.sendObjectToBack(footer);
    }
  }

  // Render slide number if enabled
  if (master.showSlideNumber) {
    const numObj = canvas
      .getObjects()
      .find((o: MasterFabricObject) => o._masterSlideNumber);
    if (numObj) {
      numObj.set({ text: String(slideIndex + 1) });
    } else {
      const num = new fabricModule.IText(String(slideIndex + 1), {
        left: canvas.width * 0.92,
        top: canvas.height * 0.92,
        fontSize: 12,
        fontFamily: "Inter, sans-serif",
        fill: "#94a3b8",
        selectable: false,
        evented: false,
      });
      num._masterSlideNumber = true;
      num._masterElement = true;
      canvas.add(num);
      canvas.sendObjectToBack(num);
    }
  }

  canvas.requestRenderAll();
}

// --- Utility: Get master for a layout type ---

export function getMasterForLayout(
  layout: SlideLayout,
  masters: MasterSlide[],
): MasterSlide | undefined {
  const mapping: Record<SlideLayout, string> = {
    title_slide: "master-title",
    title_and_content: "master-content",
    two_content: "master-two-col",
    section_header: "master-section",
    blank: "master-blank",
    title_only: "master-content",
  };
  return masters.find((m) => m.id === mapping[layout]) || masters[0];
}
