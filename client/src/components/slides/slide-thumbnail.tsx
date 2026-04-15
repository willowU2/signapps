import { useEffect, useRef } from "react";
import { useSlideObjects } from "./use-slide-objects";

interface SlideThumbnailProps {
  slideId: string;
  presentationId: string;
}

export function SlideThumbnail({
  slideId,
  presentationId,
}: SlideThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);

  // Listen directly to this specific slide's data from Yjs
  const objects = useSlideObjects(presentationId, slideId);

  useEffect(() => {
    let disposed = false;

    import("fabric").then((fabricModule) => {
      if (disposed || !canvasRef.current) return;

      // Dispose any previous canvas on this element (React Strict Mode double-mount)
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      // We use StaticCanvas for extreme performance (no interactivity, no DOM event listeners)
      const canvas = new fabricModule.StaticCanvas(canvasRef.current, {
        width: 160,
        height: 90, // 16:9 ratio, drastically smaller
        backgroundColor: "#fff",
      });

      fabricCanvasRef.current = canvas;
    });

    return () => {
      disposed = true;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    import("fabric").then((fabricModule) => {
      canvas.clear();
      canvas.backgroundColor = "#fff";

      const objectEntries = Object.entries(objects);
      if (objectEntries.length === 0) {
        canvas.requestRenderAll();
        return;
      }

      const fabricObjectsToEnliven = objectEntries.map(
        ([_, objData]) => objData,
      );

      fabricModule.util
        .enlivenObjects(fabricObjectsToEnliven)
        .then((enlivenedObjects) => {
          // The main canvas is 800x450. Thumbnail is 160x90. Scale factor is 160/800 = 0.2
          const SCALE_FACTOR = 0.2;

          enlivenedObjects.forEach((obj: any) => {
            // Apply scale to object position and size to fit miniature
            obj.scaleX = (obj.scaleX || 1) * SCALE_FACTOR;
            obj.scaleY = (obj.scaleY || 1) * SCALE_FACTOR;
            obj.left = (obj.left || 0) * SCALE_FACTOR;
            obj.top = (obj.top || 0) * SCALE_FACTOR;

            // For text, adjust font size manually if needed, but scaling the object usually suffices in Fabric

            canvas.add(obj);
          });
          canvas.requestRenderAll();
        });
    });
  }, [objects]);

  return (
    <div className="w-full h-full relative pointer-events-none overflow-hidden rounded-lg bg-background">
      <canvas ref={canvasRef} />
      {Object.keys(objects).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-300">
          Empty
        </div>
      )}
    </div>
  );
}
