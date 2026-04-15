"use client";

export function WorkspaceHeader() {
  return (
    <header className="h-16 shrink-0 flex items-center px-4">
      <div className="flex items-center gap-2 px-2 select-none">
        <div className="w-8 h-8 rounded shrink-0 bg-background flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="2"
              fill="hsl(var(--primary))"
            />
            <polyline
              points="2,7 12,14 22,7"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <span className="text-[22px] font-normal text-foreground/70 tracking-tight">
          Mail
        </span>
      </div>
    </header>
  );
}
