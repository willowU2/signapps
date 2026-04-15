import * as fabric from "fabric";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Settings2,
  Hexagon,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
} from "lucide-react";

/** fabric.Object extended with IText/shape/custom runtime properties accessed in this panel */
interface FabricObjectWithProps extends fabric.Object {
  id?: string;
  text?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  fontSize?: number;
  textAlign?: string;
  rx?: number;
  isSmartChip?: boolean;
  chipType?: string;
}

interface SlidePropertyPanelProps {
  activeObject: fabric.Object | null;
  updateObjectRemotely: (id: string, updates: Record<string, unknown>) => void;
  canvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

export function SlidePropertyPanel({
  activeObject,
  updateObjectRemotely,
  canvasRef,
}: SlidePropertyPanelProps) {
  if (!activeObject) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-muted/30 h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
        <Settings2 className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm">
          Select an object or layout to edit its properties.
        </p>
      </div>
    );
  }

  const objType = activeObject.type;
  const activeObjWithProps = activeObject as FabricObjectWithProps;
  const isSmartChip = !!activeObjWithProps.isSmartChip;
  const chipType = activeObjWithProps.chipType;

  const isText = activeObject.type === "i-text" || activeObject.type === "text";
  const isShape =
    activeObject.type === "rect" ||
    activeObject.type === "circle" ||
    activeObject.type === "triangle";
  const isImage = activeObject.type === "image";

  const handlePropertyChange = (key: string, value: unknown) => {
    if (!canvasRef.current || !activeObject) return;
    activeObject.set(key, value);

    // Ensure standard object geometry updates with style change
    if (
      key === "fontSize" ||
      key === "fontWeight" ||
      key === "fontStyle" ||
      key === "text"
    ) {
      activeObject.setCoords();
    }

    canvasRef.current.requestRenderAll();
    updateObjectRemotely(
      activeObject.get("id") as string,
      activeObject.toObject(),
    );
  };

  const toggleListStyle = (styleType: "bullet" | "number" | "check") => {
    if (!canvasRef.current || !activeObject || !isText) return;

    const currentText = activeObjWithProps.text ?? "";
    if (!currentText) return;

    const lines = currentText.split("\n");

    // Check if the current block is already the requested style
    const isCurrentlyBullet = lines[0]?.startsWith("• ");
    const isCurrentlyCheck =
      lines[0]?.startsWith("☐ ") || lines[0]?.startsWith("✅ ");
    const isCurrentlyNum = /^\d+\./.test(lines[0] || "");

    const isDisabling =
      (styleType === "bullet" && isCurrentlyBullet) ||
      (styleType === "check" && isCurrentlyCheck) ||
      (styleType === "number" && isCurrentlyNum);

    const newText = lines
      .map((line, index) => {
        // Strip existing prefixes
        let cleanLine = line.replace(/^(• |☐ |✅ |\d+\. )/, "");

        if (isDisabling) {
          return cleanLine;
        }

        // Apply new prefix
        if (styleType === "bullet") return `• ${cleanLine}`;
        if (styleType === "check") return `☐ ${cleanLine}`;
        if (styleType === "number") return `${index + 1}. ${cleanLine}`;

        return cleanLine;
      })
      .join("\n");

    activeObject.set("text", newText);
    activeObject.setCoords();
    canvasRef.current.requestRenderAll();
    updateObjectRemotely(
      activeObject.get("id") as string,
      activeObject.toObject(),
    );
  };

  const handleSmartChipChange = (color: string, label?: string) => {
    if (!canvasRef.current || !activeObject || !isSmartChip) return;

    const group = activeObject as import("fabric").Group;
    const bg = group.getObjects()[0] as import("fabric").Rect;
    const text = group.getObjects()[1] as import("fabric").IText;

    // Update colors
    bg.set("fill", color);

    // Update label
    if (label !== undefined) {
      text.set("text", label);

      // Recompute background width logic
      const paddingX = 24;
      const paddingY = 12;
      const width = (text.width || 50) + paddingX;
      const height = (text.height || 20) + paddingY;

      bg.set({ width, height });

      // Adjust group overall bounding box
      group.setCoords();
    }

    canvasRef.current.requestRenderAll();

    // Push full state natively replacing the object over Yjs network
    const groupWithId = group as FabricObjectWithProps;
    if (groupWithId.id) {
      updateObjectRemotely(
        groupWithId.id,
        (
          group as FabricObjectWithProps & {
            toObject(): Record<string, unknown>;
          }
        ).toObject(),
      );
    }
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-background h-full flex flex-col overflow-y-auto custom-scrollbar shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
      <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-background/80 backdrop-blur-md z-10 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">Design</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-muted px-2 py-0.5 rounded-full">
          {activeObject.type}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* --------------------- TEXT PROPERTIES --------------------- */}
        {isText && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Text Style
              </label>
              <select
                className="w-full bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-shadow outline-none"
                value=""
                onChange={(e) => {
                  const style = e.target.value;
                  let fontSize = 20;
                  let fontWeight = "normal";
                  if (style === "Title") {
                    fontSize = 48;
                    fontWeight = "bold";
                  } else if (style === "Heading 1") {
                    fontSize = 36;
                    fontWeight = "bold";
                  } else if (style === "Heading 2") {
                    fontSize = 28;
                    fontWeight = "bold";
                  } else if (style === "Subtitle") {
                    fontSize = 24;
                    fontWeight = "normal";
                  } else if (style === "Normal Text") {
                    fontSize = 20;
                    fontWeight = "normal";
                  }

                  if (!canvasRef.current || !activeObject) return;
                  activeObject.set("fontSize", fontSize);
                  activeObject.set("fontWeight", fontWeight);
                  activeObject.setCoords();
                  canvasRef.current.requestRenderAll();
                  updateObjectRemotely(
                    activeObject.get("id") as string,
                    activeObject.toObject(),
                  );
                }}
              >
                <option value="" disabled>
                  Apply style...
                </option>
                <option value="Title">Title</option>
                <option value="Heading 1">Heading 1</option>
                <option value="Heading 2">Heading 2</option>
                <option value="Subtitle">Subtitle</option>
                <option value="Normal Text">Normal Text</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Font Family
              </label>
              <select
                className="w-full bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-shadow outline-none"
                value={activeObjWithProps.fontFamily || "Inter"}
                onChange={(e) =>
                  handlePropertyChange("fontFamily", e.target.value)
                }
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Outfit, sans-serif">Outfit</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5 flex flex-col justify-end h-full">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide opacity-0 h-0">
                  Styles
                </label>
                <div className="flex bg-muted p-1 rounded-lg border border-border">
                  <button
                    onClick={() =>
                      handlePropertyChange(
                        "fontWeight",
                        activeObjWithProps.fontWeight === "bold"
                          ? "normal"
                          : "bold",
                      )
                    }
                    className={`flex - 1 flex justify - center py - 1.5 rounded - md transition - colors ${activeObjWithProps.fontWeight === "bold" ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handlePropertyChange(
                        "fontStyle",
                        activeObjWithProps.fontStyle === "italic"
                          ? "normal"
                          : "italic",
                      )
                    }
                    className={`flex - 1 flex justify - center py - 1.5 rounded - md transition - colors ${activeObjWithProps.fontStyle === "italic" ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Italic"
                  >
                    <Italic className="w-4 h-4 ml-1 mr-1" />
                  </button>
                  <button
                    onClick={() =>
                      handlePropertyChange(
                        "underline",
                        !activeObjWithProps.underline,
                      )
                    }
                    className={`flex - 1 flex justify - center py - 1.5 rounded - md transition - colors ${activeObjWithProps.underline ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Underline"
                  >
                    <Underline className="w-4 h-4 ml-1 mr-1" />
                  </button>
                  <button
                    onClick={() =>
                      handlePropertyChange(
                        "linethrough",
                        !activeObjWithProps.linethrough,
                      )
                    }
                    className={`flex - 1 flex justify - center py - 1.5 rounded - md transition - colors ${activeObjWithProps.linethrough ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Strikethrough"
                  >
                    <Strikethrough className="w-4 h-4 ml-1 mr-1" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 w-20">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center block">
                  Size
                </label>
                <input
                  type="number"
                  className="w-full bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2 text-center outline-none"
                  value={activeObjWithProps.fontSize || 20}
                  onChange={(e) =>
                    handlePropertyChange("fontSize", parseInt(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col pt-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Paragraph
              </label>
              <div className="flex gap-2 w-full">
                <div className="flex bg-muted p-1 rounded-lg border border-border flex-1">
                  {["left", "center", "right", "justify"].map((align) => {
                    const isActive = activeObjWithProps.textAlign === align;
                    const Icon =
                      align === "left"
                        ? AlignLeft
                        : align === "center"
                          ? AlignCenter
                          : align === "right"
                            ? AlignRight
                            : AlignJustify;
                    return (
                      <button
                        key={align}
                        onClick={() => handlePropertyChange("textAlign", align)}
                        className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${isActive ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                        title={`Align ${align}`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>

                <div className="flex bg-muted p-1 rounded-lg border border-border">
                  <button
                    onClick={() => toggleListStyle("bullet")}
                    className={`w-8 h-8 flex justify-center items-center rounded-md transition-colors ${(activeObjWithProps.text || "").startsWith("• ") ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Bulleted List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleListStyle("check")}
                    className={`w-8 h-8 flex justify-center items-center rounded-md transition-colors ${(activeObjWithProps.text || "").startsWith("☐ ") || (activeObjWithProps.text || "").startsWith("✅ ") ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Checklist"
                  >
                    <CheckSquare className="w-4 h-4 ml-0.5 mr-0.5" />
                  </button>
                  <button
                    onClick={() => toggleListStyle("number")}
                    className={`w-8 h-8 flex justify-center items-center rounded-md transition-colors ${/^\d+\./.test(activeObjWithProps.text || "") ? "bg-background shadow-sm text-indigo-600" : "text-gray-400 hover:text-muted-foreground"} `}
                    title="Numbered List"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --------------------- SHAPE SETTINGS (Only for Rect, Circle, Triangle) --------------------- */}
        {(objType === "rect" ||
          objType === "circle" ||
          objType === "triangle") &&
          !isSmartChip && (
            <div
              className="flex flex-col gap-4 pt-4 border-t border-gray-100 animate-fade-in"
              style={{ animationDelay: "50ms" }}
            >
              <div className="flex items-center gap-2">
                <Hexagon className="w-4 h-4 rounded text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                  Shape
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fill Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    value={(activeObject.fill as string) || "#ffffff"}
                    onChange={(e) =>
                      handlePropertyChange("fill", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="flex-1 bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 block p-2 outline-none font-mono"
                    value={(activeObject.fill as string) || "#ffffff"}
                    onChange={(e) =>
                      handlePropertyChange("fill", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Stroke (Border)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    value={(activeObject.stroke as string) || "#transparent"}
                    onChange={(e) =>
                      handlePropertyChange("stroke", e.target.value)
                    }
                  />
                  <input
                    type="range"
                    min="0"
                    max="10"
                    className="flex-1 accent-indigo-500"
                    value={activeObject.strokeWidth || 0}
                    onChange={(e) =>
                      handlePropertyChange(
                        "strokeWidth",
                        parseInt(e.target.value),
                      )
                    }
                  />
                  <span className="text-xs text-gray-400 font-mono w-4 text-right">
                    {activeObject.strokeWidth || 0}
                  </span>
                </div>
              </div>

              {objType === "rect" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Corner Radius
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-full accent-indigo-500"
                    value={activeObjWithProps.rx || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      handlePropertyChange("rx", val);
                      handlePropertyChange("ry", val);
                    }}
                  />
                </div>
              )}
            </div>
          )}

        {/* --------------------- IMAGE PROPERTIES --------------------- */}
        {isImage && (
          <div
            className="flex flex-col gap-4 pt-4 border-t border-gray-100 animate-fade-in"
            style={{ animationDelay: "50ms" }}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 rounded text-muted-foreground" />
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Image settings
              </h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex justify-between">
                Opacity{" "}
                <span>{Math.round((activeObject.opacity ?? 1) * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                className="w-full accent-indigo-500"
                value={Math.round((activeObject.opacity ?? 1) * 100)}
                onChange={(e) =>
                  handlePropertyChange(
                    "opacity",
                    parseInt(e.target.value) / 100,
                  )
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Corner Radius
              </label>
              <input
                type="range"
                min="0"
                max="100"
                className="w-full accent-indigo-500"
                value={activeObjWithProps.rx || 0}
                onChange={(e) => {
                  handlePropertyChange("rx", parseInt(e.target.value));
                  handlePropertyChange("ry", parseInt(e.target.value));
                }}
              />
            </div>
          </div>
        )}

        {/* --------------------- SMART CHIP INTERACTION PANEL --------------------- */}
        {isSmartChip && (
          <div
            className="flex flex-col gap-4 pt-4 border-t border-gray-100 animate-fade-in bg-indigo-50/50 p-4 rounded-xl mt-4"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Hexagon className="w-4 h-4 rounded text-indigo-500" />
              <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-widest">
                Smart Chip
              </h4>
            </div>

            {chipType === "status" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status Preset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSmartChipChange("#10b981", "✓ Done")}
                    className="px-2 py-1.5 text-xs font-medium text-white bg-emerald-500 rounded hover:bg-emerald-600 transition-colors"
                  >
                    ✓ Done
                  </button>
                  <button
                    onClick={() => handleSmartChipChange("#6b7280", "○ To Do")}
                    className="px-2 py-1.5 text-xs font-medium text-white bg-gray-500 rounded hover:bg-gray-600 transition-colors"
                  >
                    ○ To Do
                  </button>
                  <button
                    onClick={() =>
                      handleSmartChipChange("#f59e0b", "⏳ Review")
                    }
                    className="px-2 py-1.5 text-xs font-medium text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors"
                  >
                    ⏳ Review
                  </button>
                  <button
                    onClick={() =>
                      handleSmartChipChange("#f43f5e", "⚠️ Urgent")
                    }
                    className="px-2 py-1.5 text-xs font-medium text-white bg-rose-500 rounded hover:bg-rose-600 transition-colors"
                  >
                    ⚠️ Urgent
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Custom Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  value={
                    ((activeObject as import("fabric").Group).getObjects()[0]
                      .fill as string) || "#ffffff"
                  }
                  onChange={(e) => handleSmartChipChange(e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 bg-background border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 block p-2 outline-none font-mono"
                  value={
                    ((activeObject as import("fabric").Group).getObjects()[0]
                      .fill as string) || "#ffffff"
                  }
                  onChange={(e) => handleSmartChipChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* --------------------- TRANSFORM / POSITION --------------------- */}
        <div
          className="flex flex-col gap-4 pt-4 border-t border-gray-100 animate-fade-in"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex gap-2">
            <div className="space-y-1.5 w-1/2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                X
              </label>
              <input
                type="number"
                className="w-full bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 block p-2 outline-none font-mono"
                value={Math.round(activeObject.left || 0)}
                onChange={(e) =>
                  handlePropertyChange("left", parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-1.5 w-1/2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Y
              </label>
              <input
                type="number"
                className="w-full bg-muted border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 block p-2 outline-none font-mono"
                value={Math.round(activeObject.top || 0)}
                onChange={(e) =>
                  handlePropertyChange("top", parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
