"use client";

import { useDesignStore } from "@/stores/design-store";
import { TEXT_STYLES } from "./types";
import type { DesignObject } from "./types";

interface DesignTextStylesProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

export default function DesignTextStyles({ fabricCanvasRef }: DesignTextStylesProps) {
  const { addObject, pushUndo } = useDesignStore();

  const handleAddText = async (style: typeof TEXT_STYLES[0]) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    const textbox = new fabricModule.Textbox("Your text here", {
      left: 100,
      top: 100,
      width: 400,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      fill: "#000000",
      editable: true,
    } as any);
    (textbox as any).id = crypto.randomUUID();
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: (textbox as any).id,
      type: "text",
      name: style.name,
      fabricData: textbox.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Text Styles</p>
      <div className="space-y-1.5">
        {TEXT_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => handleAddText(style)}
            className="w-full text-left rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 p-3 transition-all group"
          >
            <span
              style={{
                fontSize: Math.min(style.fontSize / 3, 22),
                fontWeight: style.fontWeight as any,
                fontFamily: style.fontFamily,
              }}
              className="block truncate group-hover:text-primary transition-colors"
            >
              {style.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {style.fontFamily} - {style.fontSize}px
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
