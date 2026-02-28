"use client"

import React from "react"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOmniSearch } from "@/lib/store/omni-search"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ContextAssistant() {
  const omniStore = useOmniSearch()

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => omniStore.open()}
              size="icon"
              className="h-14 w-14 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all bg-primary/90 backdrop-blur-sm"
              aria-label="Ask AI Assistant"
            >
              <Bot className="h-6 w-6 text-primary-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="font-semibold px-4 py-2">
            Ask AI Assistant (Ctrl+K)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
