"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DESIGN_FORMATS, type DesignFormat } from "./types";

interface DesignResizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DesignResizeDialog({
  open,
  onOpenChange,
}: DesignResizeDialogProps) {
  const { currentDesign, resizeDesign, saveDesign } = useDesignStore();
  const [selectedFormat, setSelectedFormat] = useState<DesignFormat | null>(
    null,
  );
  const [customW, setCustomW] = useState(1080);
  const [customH, setCustomH] = useState(1080);
  const [isCustom, setIsCustom] = useState(false);

  if (!currentDesign) return null;

  const currentW = currentDesign.format.width;
  const currentH = currentDesign.format.height;

  const categories = [...new Set(DESIGN_FORMATS.map((f) => f.category))];

  const handleApply = () => {
    let format: DesignFormat;
    if (isCustom) {
      format = {
        id: "custom",
        name: `Custom ${customW}x${customH}`,
        category: "Custom",
        width: customW,
        height: customH,
      };
    } else if (selectedFormat) {
      format = selectedFormat;
    } else {
      return;
    }
    resizeDesign(format);
    saveDesign();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Maximize className="h-5 w-5" />
            Magic Resize
          </DialogTitle>
          <DialogDescription>
            Current size: {currentW} x {currentH} ({currentDesign.format.name})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preset categories */}
          {categories.map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {cat}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {DESIGN_FORMATS.filter((f) => f.category === cat).map((fmt) => {
                  const isActive = !isCustom && selectedFormat?.id === fmt.id;
                  const isCurrent =
                    fmt.width === currentW && fmt.height === currentH;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => {
                        setSelectedFormat(fmt);
                        setIsCustom(false);
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-md border p-2 transition-all text-left",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30",
                        isCurrent && "ring-1 ring-primary/30",
                      )}
                    >
                      <span className="text-xs font-medium truncate w-full">
                        {fmt.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {fmt.width} x {fmt.height}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Custom size */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setIsCustom(true);
                setSelectedFormat(null);
              }}
              className={cn(
                "w-full text-left rounded-md border p-2 transition-all",
                isCustom
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              <span className="text-xs font-medium">Custom Size</span>
            </button>
            {isCustom && (
              <div className="grid grid-cols-2 gap-2 pl-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Width (px)
                  </Label>
                  <Input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="h-8 text-xs"
                    min={100}
                    max={10000}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Height (px)
                  </Label>
                  <Input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="h-8 text-xs"
                    min={100}
                    max={10000}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {(selectedFormat || isCustom) && (
            <div className="flex items-center justify-center gap-3 bg-muted/30 rounded-lg p-3 text-xs">
              <span className="text-muted-foreground">
                {currentW} x {currentH}
              </span>
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">
                {isCustom
                  ? `${customW} x ${customH}`
                  : `${selectedFormat!.width} x ${selectedFormat!.height}`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedFormat && !isCustom}
            className="gap-2"
          >
            <Maximize className="h-4 w-4" />
            Apply Resize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
