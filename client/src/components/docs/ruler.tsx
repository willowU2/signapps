"use client";

import { useMemo } from "react";

interface RulerProps {
  width: number;
  unitInPixels?: number; // How many pixels represent 1 unit (e.g., 1 inch = 96px, 1 cm = 37.8px)
}

export function Ruler({ width, unitInPixels = 37.8 }: RulerProps) {
  // default 37.8px ~ 1 cm
  const ticks = useMemo(() => {
    const result = [];
    const numUnits = Math.ceil(width / unitInPixels);

    for (let i = 0; i < numUnits; i++) {
      // Major tick (number)
      result.push({
        x: i * unitInPixels,
        type: "major",
        value: i,
      });

      // Minor ticks (quarters)
      if (i < numUnits - 1) {
        for (let j = 1; j < 4; j++) {
          result.push({
            x: i * unitInPixels + j * Math.round(unitInPixels / 4),
            type: j === 2 ? "half" : "minor",
          });
        }
      }
    }
    return result;
  }, [width, unitInPixels]);

  return (
    <div
      className="h-7 bg-background dark:bg-gray-900 border-b border-border dark:border-gray-700 relative overflow-hidden flex shrink-0 shadow-sm z-10"
      style={{ width: `${width}px`, marginLeft: "auto", marginRight: "auto" }}
    >
      {/* Left Margin Indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[96px] bg-muted dark:bg-gray-800/80 border-r border-gray-400 dark:border-gray-600 opacity-80"
        title="Left Margin"
      />

      {/* Right Margin Indicator */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[96px] bg-muted dark:bg-gray-800/80 border-l border-gray-400 dark:border-gray-600 opacity-80"
        title="Right Margin"
      />

      {/* Ticks */}
      {ticks.map((tick, index) => (
        <div
          key={index}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${tick.x}px`, transform: "translateX(-50%)" }}
        >
          {tick.type === "major" && (
            <>
              <span className="text-[9px] font-medium text-muted-foreground dark:text-gray-400 select-none mt-0.5">
                {tick.value}
              </span>
              <div className="w-px h-2.5 bg-gray-400 dark:bg-gray-600 absolute bottom-0"></div>
            </>
          )}
          {tick.type === "half" && (
            <div className="w-px h-1.5 bg-gray-300 dark:bg-gray-700 absolute bottom-0"></div>
          )}
          {tick.type === "minor" && (
            <div className="w-px h-1 bg-gray-200 dark:bg-gray-800 absolute bottom-0"></div>
          )}
        </div>
      ))}

      {/* Active indentation markers (visual mockups) */}
      <div className="absolute top-0 bottom-0 w-3 left-[90px] cursor-ew-resize flex items-center justify-center group">
        <div className="w-[1px] h-full bg-blue-500 opacity-0 group-hover:opacity-100 absolute -top-12 h-[2000px] z-0 pointer-events-none"></div>
        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-blue-600 absolute bottom-0 z-10"></div>
        <div className="w-2.5 h-1.5 bg-blue-600 absolute -top-0.5 rounded-sm z-10"></div>
      </div>

      <div className="absolute top-0 bottom-0 w-3 right-[90px] cursor-ew-resize flex items-center justify-center group">
        <div className="w-[1px] h-full bg-blue-500 opacity-0 group-hover:opacity-100 absolute -top-12 h-[2000px] z-0 pointer-events-none"></div>
        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-blue-600 absolute bottom-0 z-10"></div>
      </div>
    </div>
  );
}
