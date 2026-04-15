"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

export function WorkspaceHeader() {
  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 w-[200px] shrink-0 pl-0">
        <div className="flex items-center gap-2 px-2 select-none cursor-pointer">
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
      </div>

      {/* Central Search Bar */}
      <div className="flex-1 max-w-[720px] mx-6 relative hidden md:block group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-muted/60 rounded-full cursor-pointer transition-colors">
          <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary" />
        </div>
        <Input
          placeholder="Rechercher dans les messages"
          className="w-full pl-14 pr-14 h-12 bg-muted dark:bg-[#1f1f1f] border-transparent hover:bg-background hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] focus-visible:bg-background focus-visible:ring-0 focus-visible:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all duration-200 rounded-full text-base dark:hover:bg-[#28292a] dark:focus-visible:bg-[#28292a] text-foreground placeholder:text-muted-foreground"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-muted/60 rounded-full cursor-pointer transition-colors">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Right action area removed — the global AppHeader already provides
          notifications, help, settings, app grid, and avatar. Keeping them
          here created visual duplicates on the Mail page. */}
    </header>
  );
}
