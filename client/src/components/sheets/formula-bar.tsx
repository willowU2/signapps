"use client";

import { useState } from "react";

interface FormulaBarProps {
  cellRef: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function FormulaBar({ cellRef, value, onChange, onSubmit }: FormulaBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex items-center gap-2 border-b px-2 py-1 bg-muted/30">
      <span className="text-xs font-mono font-bold text-muted-foreground w-12 text-center shrink-0">
        {cellRef || "A1"}
      </span>
      <div className="w-px h-5 bg-border" />
      <span className="text-xs text-muted-foreground shrink-0">fx</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === "Enter") onSubmit(); }}
        className={`flex-1 text-sm bg-transparent outline-none font-mono ${focused ? "text-foreground" : "text-muted-foreground"}`}
        placeholder="Entrez une valeur ou formule..."
      />
    </div>
  );
}
