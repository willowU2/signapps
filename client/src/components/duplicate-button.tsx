"use client";

interface DuplicateButtonProps {
  onDuplicate: () => void;
  label?: string;
  size?: "sm" | "md";
}

export function DuplicateButton({ onDuplicate, label = "Dupliquer", size = "sm" }: DuplicateButtonProps) {
  return (
    <button
      onClick={onDuplicate}
      className={`inline-flex items-center gap-1 rounded border bg-background hover:bg-accent transition-colors ${
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
      }`}
      title={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width={size === "sm" ? 12 : 14} height={size === "sm" ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {label}
    </button>
  );
}
