"use client";

interface HeatmapData {
  day: number; // 0-6 (Mon-Sun)
  hour: number; // 0-23
  value: number;
}

export function ActivityHeatmap({ data, label = "Activite" }: { data: HeatmapData[]; label?: string }) {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxVal = Math.max(...data.map(d => d.value), 1);

  function getColor(val: number): string {
    const intensity = val / maxVal;
    if (intensity === 0) return "bg-muted/30";
    if (intensity < 0.25) return "bg-green-900/40";
    if (intensity < 0.5) return "bg-green-700/60";
    if (intensity < 0.75) return "bg-green-500/80";
    return "bg-green-400";
  }

  function getValue(day: number, hour: number): number {
    return data.find(d => d.day === day && d.hour === hour)?.value || 0;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 text-[9px] text-muted-foreground pr-1">
          {days.map(d => <div key={d} className="h-3 flex items-center">{d}</div>)}
        </div>
        <div className="flex flex-col gap-1">
          {days.map((_, di) => (
            <div key={di} className="flex gap-[2px]">
              {hours.map(h => (
                <div key={h} className={`w-3 h-3 rounded-[2px] ${getColor(getValue(di, h))}`} title={`${days[di]} ${h}h: ${getValue(di, h)}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
