"use client";

import { useRef, useState, useEffect } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import DesignLayerEffects from "./design-layer-effects";
import DesignGradientEditor from "./design-gradient-editor";
import DesignImageCrop from "./design-image-crop";

export default function DesignEditor() {
  const fabricCanvasRef = useRef<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const { currentDesign, rightPanel, selectedObjectIds, saveDesign } =
    useDesignStore();

  // DW1: Auto-save debounced 3s on design changes
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

  const [leftTab, setLeftTab] = useState("layers");
  const [rightTab, setRightTab] = useState("properties");

  if (!currentDesign) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No design loaded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <DesignToolbar
        fabricCanvasRef={fabricCanvasRef}
        onOpenExport={() => setExportOpen(true)}
        onOpenResize={() => setResizeOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — 7 tabs */}
        <div className="w-56 border-r bg-background/95 flex flex-col shrink-0 overflow-hidden">
          <Tabs
            value={leftTab}
            onValueChange={setLeftTab}
            className="flex flex-col h-full"
          >
            <TabsList className="grid grid-cols-7 gap-0 rounded-none border-b bg-transparent h-9 px-0.5">
              <TabsTrigger
                value="layers"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Layers"
              >
                <Layers className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="History"
              >
                <History className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="pages"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Pages"
              >
                <FileStack className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="shapes"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Shapes"
              >
                <Shapes className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="text"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Text & Fonts"
              >
                <Type className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Photos"
              >
                <Image className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="brand"
                className="h-7 px-0 data-[state=active]:bg-muted rounded-md"
                title="Brand Kit"
              >
                <Palette className="h-3.5 w-3.5" />
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
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
                  <TabsList className="grid grid-cols-2 gap-0 rounded-none border-b bg-transparent h-8 mx-2 mt-1">
                    <TabsTrigger
                      value="styles"
                      className="text-[10px] h-6 data-[state=active]:bg-muted rounded-md"
                    >
                      Styles
                    </TabsTrigger>
                    <TabsTrigger
                      value="fonts"
                      className="text-[10px] h-6 data-[state=active]:bg-muted rounded-md"
                    >
                      Fonts
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
            </div>
          </Tabs>
        </div>

        {/* Canvas Area */}
        <DesignCanvas fabricCanvasRef={fabricCanvasRef} />

        {/* Right Sidebar — Properties, Filters, Effects, Gradient, Crop */}
        {rightPanel && (
          <div className="shrink-0 overflow-hidden">
            {selectedObjectIds.length > 0 ? (
              <Tabs
                value={rightTab}
                onValueChange={setRightTab}
                className="flex flex-col h-full w-64"
              >
                <TabsList className="grid grid-cols-5 gap-0 rounded-none border-b bg-transparent h-9 px-0.5">
                  <TabsTrigger
                    value="properties"
                    className="h-7 text-[10px] data-[state=active]:bg-muted rounded-md"
                    title="Properties"
                  >
                    Props
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="h-7 text-[10px] data-[state=active]:bg-muted rounded-md"
                    title="Layer Effects"
                  >
                    <Sparkles className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="gradient"
                    className="h-7 text-[10px] data-[state=active]:bg-muted rounded-md"
                    title="Gradient"
                  >
                    <Palette className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="crop"
                    className="h-7 text-[10px] data-[state=active]:bg-muted rounded-md"
                    title="Crop"
                  >
                    <Crop className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="filters"
                    className="h-7 text-[10px] data-[state=active]:bg-muted rounded-md"
                    title="Filters"
                  >
                    Filters
                  </TabsTrigger>
                </TabsList>
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
              <DesignPropertyPanel fabricCanvasRef={fabricCanvasRef} />
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
