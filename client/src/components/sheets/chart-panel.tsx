"use client";

import React, { useRef, useCallback, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { X, Move, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartType = "bar" | "line" | "pie" | "scatter" | "area";

const CHART_COLORS = [
  "#4a86e8",
  "#ea4335",
  "#fbbc04",
  "#34a853",
  "#ff6d01",
  "#46bdc6",
  "#9334e6",
  "#d81b60",
];

interface FloatingChartProps {
  id: string;
  type: ChartType;
  title: string;
  chartData: Record<string, string | number>[];
  seriesNames: string[];
  colors: string[];
  showLegend: boolean;
  xLabel?: string;
  yLabel?: string;
  onRemove: (id: string) => void;
}

export function FloatingChart({
  id,
  type,
  title,
  chartData,
  seriesNames,
  colors,
  showLegend,
  xLabel,
  yLabel,
  onRemove,
}: FloatingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 100,
  });
  const [size, setSize] = useState({ w: 420, h: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPos({
          x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
        });
      };
      const handleUp = () => {
        setIsDragging(false);
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [pos],
  );

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setSize({ w: 420, h: 300 });
    } else {
      setSize({ w: 700, h: 480 });
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const chartStyle = { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-[150] bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl flex flex-col",
        isDragging && "cursor-grabbing shadow-2xl",
      )}
      style={chartStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-[#e3e3e3] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#3c4043] rounded-t-lg cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        <Move className="w-3.5 h-3.5 text-[#5f6368]" />
        <span className="flex-1 text-[12px] font-medium truncate">
          {title || "Graphique"}
        </span>
        <button
          onClick={toggleExpand}
          className="p-0.5 hover:bg-[#e3e3e3] dark:hover:bg-[#5f6368] rounded"
        >
          {isExpanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => onRemove(id)}
          className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded hover:text-red-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chart content */}
      <div className="flex-1 p-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {seriesNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {seriesNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          ) : type === "pie" ? (
            <PieChart>
              <Tooltip />
              {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              <Pie
                data={chartData.map((d) => ({
                  name: d.label,
                  value: d[seriesNames[0] ?? ""] as number,
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                label={{ fontSize: 10 }}
              >
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : type === "scatter" ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} />
              <YAxis dataKey="y" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Scatter
                name={seriesNames[0] || "Data"}
                data={chartData.map((d, i) => ({
                  x: (d[seriesNames[0] ?? ""] as number) ?? 0,
                  y: (d[seriesNames[1] ?? seriesNames[0] ?? ""] as number) ?? 0,
                }))}
                fill={colors[0] || CHART_COLORS[0]}
              />
            </ScatterChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {seriesNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  fill={colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                  stroke={colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
