"use client";

import { useState, useEffect, useCallback } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Trash2,
  Copy,
  FlipHorizontal,
  FlipVertical,
  MoveUp,
  MoveDown,
} from "lucide-react";
import { FONT_FAMILIES } from "./types";
import type * as fabric from "fabric";

/** fabric.Object extended with text, shape, and id runtime properties accessed in this panel */
interface FabricObjectWithProps extends fabric.Object {
  id?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  textAlign?: string;
  lineHeight?: number;
  charSpacing?: number;
  rx?: number;
  ry?: number;
  filters?: fabric.filters.BaseFilter<string>[];
  applyFilters?: () => void;
}

interface DesignPropertyPanelProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

interface ObjectProperties {
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  // Text specific
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  textAlign?: string;
  lineHeight?: number;
  charSpacing?: number;
  // Shape specific
  rx?: number;
  ry?: number;
}

export default function DesignPropertyPanel({
  fabricCanvasRef,
}: DesignPropertyPanelProps) {
  const { selectedObjectIds, updateObject, removeObject, pushUndo } =
    useDesignStore();
  const [props, setProps] = useState<ObjectProperties | null>(null);

  const refreshProps = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || selectedObjectIds.length === 0) {
      setProps(null);
      return;
    }
    const obj = canvas.getActiveObject() as FabricObjectWithProps | null;
    if (!obj) {
      setProps(null);
      return;
    }
    setProps({
      type: obj.type || "object",
      left: Math.round(obj.left || 0),
      top: Math.round(obj.top || 0),
      width: Math.round((obj.width || 0) * (obj.scaleX || 1)),
      height: Math.round((obj.height || 0) * (obj.scaleY || 1)),
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      angle: Math.round(obj.angle || 0),
      opacity: Math.round((obj.opacity || 1) * 100),
      fill: typeof obj.fill === "string" ? obj.fill : "#000000",
      stroke: (typeof obj.stroke === "string" ? obj.stroke : "") || "",
      strokeWidth: obj.strokeWidth || 0,
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      fontWeight: obj.fontWeight,
      fontStyle: obj.fontStyle,
      underline: obj.underline,
      textAlign: obj.textAlign,
      lineHeight: obj.lineHeight,
      charSpacing: obj.charSpacing,
      rx: obj.rx,
      ry: obj.ry,
    });
  }, [fabricCanvasRef, selectedObjectIds]);

  useEffect(() => {
    refreshProps();
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const handler = () => refreshProps();
    canvas.on("object:modified", handler);
    canvas.on("object:scaling", handler);
    canvas.on("object:moving", handler);
    canvas.on("object:rotating", handler);
    canvas.on("selection:created", handler);
    canvas.on("selection:updated", handler);
    return () => {
      canvas.off("object:modified", handler);
      canvas.off("object:scaling", handler);
      canvas.off("object:moving", handler);
      canvas.off("object:rotating", handler);
      canvas.off("selection:created", handler);
      canvas.off("selection:updated", handler);
    };
  }, [refreshProps, fabricCanvasRef]);

  const setProp = useCallback(
    (key: string, value: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const obj = canvas.getActiveObject();
      if (!obj) return;
      obj.set(key, value);
      obj.setCoords();
      canvas.requestRenderAll();
      const objWithId = obj as FabricObjectWithProps;
      if (objWithId.id) {
        updateObject(objWithId.id, { fabricData: obj.toObject(["id"]) });
      }
      refreshProps();
    },
    [fabricCanvasRef, updateObject, refreshProps],
  );

  const handleDelete = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    pushUndo();
    const active = canvas.getActiveObjects();
    active.forEach((obj) => {
      const objWithId = obj as FabricObjectWithProps;
      if (objWithId.id) removeObject(objWithId.id);
      canvas.remove(obj);
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  };

  const handleDuplicate = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    pushUndo();
    const cloned = await obj.clone(["id"]);
    (cloned as FabricObjectWithProps).id = crypto.randomUUID();
    cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
  };

  const handleFlipH = () => setProp("flipX", !props?.scaleX);
  const handleFlipV = () => setProp("flipY", !props?.scaleY);

  const handleBringForward = () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (canvas && obj) {
      canvas.bringObjectForward(obj);
      canvas.requestRenderAll();
    }
  };
  const handleSendBackward = () => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (canvas && obj) {
      canvas.sendObjectBackwards(obj);
      canvas.requestRenderAll();
    }
  };

  if (!props || selectedObjectIds.length === 0) {
    return (
      <div className="w-64 border-l bg-background/95 p-4 overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center py-16">
          <p>Select an element to edit its properties</p>
        </div>
      </div>
    );
  }

  const isText =
    props.type === "textbox" ||
    props.type === "i-text" ||
    props.type === "text";

  return (
    <div className="w-64 border-l bg-background/95 p-3 overflow-y-auto space-y-4 text-sm">
      {/* Quick actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDuplicate}
          title="Dupliquer"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDelete}
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleBringForward}
          title="Avancer"
        >
          <MoveUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSendBackward}
          title="Reculer"
        >
          <MoveDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleFlipH}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleFlipV}
          title="Flip Vertical"
        >
          <FlipVertical className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator />

      {/* Position & Size */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Position
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">X</Label>
            <Input
              type="number"
              value={props.left}
              onChange={(e) => setProp("left", Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Y</Label>
            <Input
              type="number"
              value={props.top}
              onChange={(e) => setProp("top", Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">W</Label>
            <Input
              type="number"
              value={props.width}
              onChange={(e) => {
                const newW = Number(e.target.value);
                const canvas = fabricCanvasRef.current;
                const obj = canvas?.getActiveObject();
                if (obj) {
                  const newScale = newW / (obj.width || 1);
                  setProp("scaleX", newScale);
                }
              }}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">H</Label>
            <Input
              type="number"
              value={props.height}
              onChange={(e) => {
                const newH = Number(e.target.value);
                const canvas = fabricCanvasRef.current;
                const obj = canvas?.getActiveObject();
                if (obj) {
                  const newScale = newH / (obj.height || 1);
                  setProp("scaleY", newScale);
                }
              }}
              className="h-7 text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Rotation
            </Label>
            <Input
              type="number"
              value={props.angle}
              onChange={(e) => setProp("angle", Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Opacity</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[props.opacity]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setProp("opacity", v / 100)}
                className="flex-1"
              />
              <span className="text-[10px] w-7 text-right tabular-nums">
                {props.opacity}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Fill & Stroke */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Appearance
        </p>
        {!isText && (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground w-10">
              Fill
            </Label>
            <input
              type="color"
              value={props.fill}
              onChange={(e) => setProp("fill", e.target.value)}
              className="h-7 w-7 rounded border cursor-pointer"
            />
            <Input
              value={props.fill}
              onChange={(e) => setProp("fill", e.target.value)}
              className="h-7 text-xs flex-1"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground w-10">
            Stroke
          </Label>
          <input
            type="color"
            value={props.stroke || "#000000"}
            onChange={(e) => setProp("stroke", e.target.value)}
            className="h-7 w-7 rounded border cursor-pointer"
          />
          <Input
            type="number"
            value={props.strokeWidth}
            onChange={(e) => setProp("strokeWidth", Number(e.target.value))}
            className="h-7 text-xs w-16"
            min={0}
            max={50}
          />
        </div>
        {props.rx !== undefined && (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground w-10">
              Radius
            </Label>
            <Slider
              value={[props.rx || 0]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => {
                setProp("rx", v);
                setProp("ry", v);
              }}
              className="flex-1"
            />
            <span className="text-[10px] w-7 tabular-nums">
              {props.rx || 0}
            </span>
          </div>
        )}
      </div>

      {/* Text properties */}
      {isText && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Typography
            </p>

            {/* Font family */}
            <select
              value={props.fontFamily || "Inter"}
              onChange={(e) => setProp("fontFamily", e.target.value)}
              className="w-full h-7 text-xs rounded border bg-background px-2"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Font size */}
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground w-10">
                Size
              </Label>
              <Input
                type="number"
                value={props.fontSize || 18}
                onChange={(e) => setProp("fontSize", Number(e.target.value))}
                className="h-7 text-xs flex-1"
                min={8}
                max={200}
              />
            </div>

            {/* Color */}
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground w-10">
                Color
              </Label>
              <input
                type="color"
                value={props.fill}
                onChange={(e) => setProp("fill", e.target.value)}
                className="h-7 w-7 rounded border cursor-pointer"
              />
              <Input
                value={props.fill}
                onChange={(e) => setProp("fill", e.target.value)}
                className="h-7 text-xs flex-1"
              />
            </div>

            {/* Style toggles */}
            <div className="flex items-center gap-1">
              <Button
                variant={props.fontWeight === "bold" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setProp(
                    "fontWeight",
                    props.fontWeight === "bold" ? "normal" : "bold",
                  )
                }
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={props.fontStyle === "italic" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setProp(
                    "fontStyle",
                    props.fontStyle === "italic" ? "normal" : "italic",
                  )
                }
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={props.underline ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setProp("underline", !props.underline)}
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button
                variant={props.textAlign === "left" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setProp("textAlign", "left")}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={props.textAlign === "center" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setProp("textAlign", "center")}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={props.textAlign === "right" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setProp("textAlign", "right")}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={props.textAlign === "justify" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setProp("textAlign", "justify")}
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Line height & letter spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  Line Height
                </Label>
                <Slider
                  value={[(props.lineHeight || 1.2) * 100]}
                  min={80}
                  max={300}
                  step={5}
                  onValueChange={([v]) => setProp("lineHeight", v / 100)}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  Spacing
                </Label>
                <Slider
                  value={[props.charSpacing || 0]}
                  min={-200}
                  max={800}
                  step={10}
                  onValueChange={([v]) => setProp("charSpacing", v)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
