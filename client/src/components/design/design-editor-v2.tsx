"use client";

import { useRef, useState, useEffect } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Layers,
  FileStack,
  Shapes,
  Type,
  Image,
  Palette,
  History,
  Sparkles,
  Crop,
  ChevronLeft,
  MousePointer2,
  Keyboard,
} from "lucide-react";

import DesignCanvas from "./design-canvas";
import DesignToolbar from "./design-toolbar";
import DesignPropertyPanel from "./design-property-panel";
import DesignLayersPanel from "./design-layers-panel";
import DesignPagesPanel from "./design-pages-panel";
import DesignExportDialog from "./design-export-dialog";
import DesignResizeDialog from "./design-resize-dialog";
import DesignShapesLibrary from "./design-shapes-library";
import DesignTextStyles from "./design-text-styles";
import DesignStockPhotos from "./design-stock-photos";
import DesignBrandKit from "./design-brand-kit";
import DesignPhotoFilters from "./design-photo-filters";
import DesignHistoryPanel from "./design-history-panel";
import DesignFontsLibrary from "./design-fonts-library";
import DesignLayerEffects from "./design-effects-v2";
import DesignGradientEditor from "./design-gradient-editor";
import DesignImageCrop from "./design-image-crop";

// ─── Canva-style left rail tools ───
const RAIL_TOOLS: {
  id: string;
  label: string;
  icon: React.ElementType;
  tint: string;
}[] = [
  { id: "layers", label: "Calques", icon: Layers, tint: "text-violet-500" },
  { id: "pages", label: "Pages", icon: FileStack, tint: "text-indigo-500" },
  { id: "shapes", label: "Formes", icon: Shapes, tint: "text-sky-500" },
  { id: "text", label: "Texte", icon: Type, tint: "text-amber-500" },
  { id: "photos", label: "Photos", icon: Image, tint: "text-emerald-500" },
  { id: "brand", label: "Marque", icon: Palette, tint: "text-pink-500" },
  { id: "history", label: "Historique", icon: History, tint: "text-slate-500" },
];

export default function DesignEditor() {
  const fabricCanvasRef = useRef<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const { currentDesign, rightPanel, selectedObjectIds, saveDesign } =
    useDesignStore();

  // Auto-save debounced 3s on design changes
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentDesign) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDesign();
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDesign]);

  const [leftTab, setLeftTab] = useState<string | null>("layers");
  const [rightTab, setRightTab] = useState("properties");

  if (!currentDesign) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Aucun design chargé
      </div>
    );
  }

  const activeTool = RAIL_TOOLS.find((t) => t.id === leftTab);

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Toolbar */}
      <DesignToolbar
        fabricCanvasRef={fabricCanvasRef}
        onOpenExport={() => setExportOpen(true)}
        onOpenResize={() => setResizeOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Canva-style left rail — thick, icons + labels */}
        <div className="w-[84px] border-r bg-background/95 backdrop-blur-sm shrink-0 flex flex-col py-2 gap-1 overflow-y-auto">
          {RAIL_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = leftTab === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setLeftTab(active ? null : tool.id)}
                className={cn(
                  "mx-2 group flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all duration-200",
                  active ? "bg-muted/80 shadow-sm" : "hover:bg-muted/50",
                )}
                title={tool.label}
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-lg transition-colors",
                    active ? "bg-background shadow-sm" : "bg-transparent",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 transition-colors",
                      active
                        ? tool.tint
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                    style={{ width: 18, height: 18 }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors leading-none",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary panel — slides in when a rail tool is active */}
        {leftTab && (
          <div className="w-72 border-r bg-background flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left-2 fade-in duration-200">
            <div className="flex items-center justify-between px-4 h-11 border-b">
              <div className="flex items-center gap-2">
                {activeTool && (
                  <>
                    <activeTool.icon
                      className={cn("h-4 w-4", activeTool.tint)}
                    />
                    <span className="text-sm font-semibold">
                      {activeTool.label}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => setLeftTab(null)}
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Fermer le panneau"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Tabs value={leftTab} className="h-full">
                <TabsContent value="layers" className="m-0 h-full">
                  <DesignLayersPanel fabricCanvasRef={fabricCanvasRef} />
                </TabsContent>
                <TabsContent value="history" className="m-0 h-full">
                  <DesignHistoryPanel fabricCanvasRef={fabricCanvasRef} />
                </TabsContent>
                <TabsContent value="pages" className="m-0 h-full">
                  <DesignPagesPanel />
                </TabsContent>
                <TabsContent value="shapes" className="m-0 p-3">
                  <DesignShapesLibrary fabricCanvasRef={fabricCanvasRef} />
                </TabsContent>
                <TabsContent value="text" className="m-0 h-full">
                  <Tabs defaultValue="styles" className="flex flex-col h-full">
                    <TabsList className="grid grid-cols-2 rounded-none border-b bg-transparent h-9 mx-3 mt-2">
                      <TabsTrigger
                        value="styles"
                        className="text-xs h-7 data-[state=active]:bg-muted rounded-md"
                      >
                        Styles
                      </TabsTrigger>
                      <TabsTrigger
                        value="fonts"
                        className="text-xs h-7 data-[state=active]:bg-muted rounded-md"
                      >
                        Polices
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="styles" className="m-0 p-3 flex-1">
                      <DesignTextStyles fabricCanvasRef={fabricCanvasRef} />
                    </TabsContent>
                    <TabsContent
                      value="fonts"
                      className="m-0 flex-1 overflow-hidden"
                    >
                      <DesignFontsLibrary fabricCanvasRef={fabricCanvasRef} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="photos" className="m-0 p-3">
                  <DesignStockPhotos fabricCanvasRef={fabricCanvasRef} />
                </TabsContent>
                <TabsContent value="brand" className="m-0 p-3">
                  <DesignBrandKit />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Canvas area */}
        <DesignCanvas fabricCanvasRef={fabricCanvasRef} />

        {/* Right Sidebar — Properties / effects / etc when object selected */}
        {rightPanel && (
          <div className="w-72 border-l bg-background shrink-0 overflow-hidden">
            {selectedObjectIds.length > 0 ? (
              <Tabs
                value={rightTab}
                onValueChange={setRightTab}
                className="flex flex-col h-full"
              >
                <div className="border-b px-3 py-2">
                  <TabsList className="grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-1 h-8 w-full">
                    <TabsTrigger
                      value="properties"
                      className="h-6 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                      title="Propriétés"
                    >
                      Props
                    </TabsTrigger>
                    <TabsTrigger
                      value="effects"
                      className="h-6 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                      title="Effets"
                    >
                      <Sparkles className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="gradient"
                      className="h-6 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                      title="Dégradé"
                    >
                      <Palette className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="crop"
                      className="h-6 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                      title="Rogner"
                    >
                      <Crop className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="filters"
                      className="h-6 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                      title="Filtres"
                    >
                      Filtre
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TabsContent value="properties" className="m-0">
                    <DesignPropertyPanel fabricCanvasRef={fabricCanvasRef} />
                  </TabsContent>
                  <TabsContent value="effects" className="m-0">
                    <DesignLayerEffects fabricCanvasRef={fabricCanvasRef} />
                  </TabsContent>
                  <TabsContent value="gradient" className="m-0">
                    <DesignGradientEditor fabricCanvasRef={fabricCanvasRef} />
                  </TabsContent>
                  <TabsContent value="crop" className="m-0">
                    <DesignImageCrop fabricCanvasRef={fabricCanvasRef} />
                  </TabsContent>
                  <TabsContent value="filters" className="m-0 p-3">
                    <DesignPhotoFilters fabricCanvasRef={fabricCanvasRef} />
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <EmptyRightPanel />
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DesignExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        fabricCanvasRef={fabricCanvasRef}
      />
      <DesignResizeDialog open={resizeOpen} onOpenChange={setResizeOpen} />
    </div>
  );
}

// ─── Empty state: Figma-style helper panel when nothing is selected ───
function EmptyRightPanel() {
  return (
    <div className="h-full flex flex-col items-center text-center px-6 py-8 gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-xl rounded-full" />
        <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg">
          <MousePointer2 className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Aucun élément sélectionné
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sélectionne un objet du canevas pour voir et modifier ses propriétés.
        </p>
      </div>
      <div className="w-full border-t pt-5">
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wide">
            Raccourcis
          </span>
        </div>
        <div className="space-y-2">
          {[
            { keys: ["V"], label: "Sélectionner" },
            { keys: ["T"], label: "Texte" },
            { keys: ["R"], label: "Rectangle" },
            { keys: ["O"], label: "Cercle" },
            { keys: ["Ctrl", "Z"], label: "Annuler" },
            { keys: ["Ctrl", "D"], label: "Dupliquer" },
          ].map((sc) => (
            <div
              key={sc.label}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-muted-foreground">{sc.label}</span>
              <div className="flex items-center gap-1">
                {sc.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-1.5 py-0.5 rounded-md border bg-muted/50 font-mono text-[10px] font-medium text-foreground shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
