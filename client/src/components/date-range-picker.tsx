"use client";

import { useState } from "react";

interface DateRangePickerProps {
  onChange: (from: string, to: string) => void;
}

const PRESETS = [
  { label: "7j", days: 7 },
  { label: "30j", days: 30 },
  { label: "90j", days: 90 },
  { label: "1an", days: 365 },
];

export function DateRangePicker({ onChange }: DateRangePickerProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const f = start.toISOString().slice(0, 10);
    const t = end.toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
    onChange(f, t);
  }

  function handleChange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    if (f && t) onChange(f, t);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.days)} className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground hover:bg-accent transition-colors">
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <input type="date" value={from} onChange={e => handleChange(e.target.value, to)} className="px-2 py-1 rounded border bg-background text-sm" />
        <span className="text-muted-foreground">→</span>
        <input type="date" value={to} onChange={e => handleChange(from, e.target.value)} className="px-2 py-1 rounded border bg-background text-sm" />
      </div>
    </div>
  );
}
