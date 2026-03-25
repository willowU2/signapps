"use client";

import { useRef, useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, FileStack, Shapes, Type, Image, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
import DesignTemplateGallery from "./design-template-gallery";

export default function DesignEditor() {
  const fabricCanvasRef = useRef<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const {
    currentDesign,
    leftPanel,
    rightPanel,
    setLeftPanel,
    setRightPanel,
    selectedObjectIds,
  } = useDesignStore();

  const [leftTab, setLeftTab] = useState("layers");

  if (!currentDesign) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No design loaded
      </div>
    );
  }

  // Check if the selected object is an image (for filters panel)
  const isImageSelected = false; // Will be dynamic based on fabric selection

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <DesignToolbar
        fabricCanvasRef={fabricCanvasRef}
        onOpenExport={() => setExportOpen(true)}
        onOpenResize={() => setResizeOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-56 border-r bg-background/95 flex flex-col shrink-0 overflow-hidden">
          <Tabs value={leftTab} onValueChange={setLeftTab} className="flex flex-col h-full">
            <TabsList className="grid grid-cols-6 gap-0 rounded-none border-b bg-transparent h-9 px-1">
              <TabsTrigger value="layers" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Layers">
                <Layers className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="pages" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Pages">
                <FileStack className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="shapes" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Shapes">
                <Shapes className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="text" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Text">
                <Type className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="photos" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Photos">
                <Image className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="brand" className="h-7 px-0 data-[state=active]:bg-muted rounded-md" title="Brand Kit">
                <Palette className="h-3.5 w-3.5" />
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="layers" className="m-0 h-full">
                <DesignLayersPanel fabricCanvasRef={fabricCanvasRef} />
              </TabsContent>
              <TabsContent value="pages" className="m-0 h-full">
                <DesignPagesPanel />
              </TabsContent>
              <TabsContent value="shapes" className="m-0 p-3">
                <DesignShapesLibrary fabricCanvasRef={fabricCanvasRef} />
              </TabsContent>
              <TabsContent value="text" className="m-0 p-3">
                <DesignTextStyles fabricCanvasRef={fabricCanvasRef} />
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

        {/* Right Sidebar - Property Panel */}
        {rightPanel && (
          <div className="shrink-0 overflow-hidden">
            {selectedObjectIds.length > 0 ? (
              <Tabs defaultValue="properties" className="flex flex-col h-full w-64">
                <TabsList className="grid grid-cols-2 gap-0 rounded-none border-b bg-transparent h-9 px-1">
                  <TabsTrigger value="properties" className="h-7 text-xs data-[state=active]:bg-muted rounded-md">
                    Properties
                  </TabsTrigger>
                  <TabsTrigger value="filters" className="h-7 text-xs data-[state=active]:bg-muted rounded-md">
                    Filters
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-y-auto">
                  <TabsContent value="properties" className="m-0">
                    <DesignPropertyPanel fabricCanvasRef={fabricCanvasRef} />
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
      <DesignResizeDialog
        open={resizeOpen}
        onOpenChange={setResizeOpen}
      />
    </div>
  );
}
