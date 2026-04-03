"use client";

import {
  Search,
  SlidersHorizontal,
  HelpCircle,
  Settings,
  Grid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnifiedNotificationCenter } from "@/components/interop/UnifiedNotificationCenter";

export function WorkspaceHeader() {
  const user = useAuthStore((s) => s.user);
  const avatarUrl = user?.avatar_url;
  const initials = (user?.display_name || user?.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

      {/* Right action area */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Active Status */}
        <Button
          variant="outline"
          size="sm"
          className="hidden lg:flex h-9 rounded-full border-border font-medium px-4 hover:bg-muted mr-2 gap-2 text-foreground/80"
        >
          <div className="w-2 h-2 rounded-full bg-green-600"></div>
          Actif
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="ml-1 opacity-60"
          >
            <path
              d="M5 6L0 1.05562L1.07143 0L5 3.88876L8.92857 0L10 1.05562L5 6Z"
              fill="currentColor"
            />
          </svg>
        </Button>

        {/* Unified notification center */}
        <UnifiedNotificationCenter className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
            Aide
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
            Paramètres
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted"
            >
              <Grid className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
            Applications SignApps
          </TooltipContent>
        </Tooltip>

        <div className="mx-2 flex items-center justify-center">
          <Avatar className="h-8 w-8 hover:ring-4 ring-border cursor-pointer transition-all">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
