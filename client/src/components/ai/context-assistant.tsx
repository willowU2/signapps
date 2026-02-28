"use client"

import { useState } from "react"
import { Bot, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOmniSearch } from "@/lib/store/omni-search"
import { usePageContext } from "@/lib/store/page-context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ContextAssistant() {
  const omniStore = useOmniSearch()
  const pageContext = usePageContext()
  const [isExecuting, setIsExecuting] = useState(false)

  // Determine styling based on whether AI has a proactive message
  const isProactive = !!pageContext.proactiveMessage
  const isWarning = pageContext.severity === 'warning' || pageContext.severity === 'error'
  
  const buttonClasses = isProactive
    ? isWarning 
      ? "animate-ai-warning bg-red-500/90 hover:bg-red-600/90 text-white"
      : "animate-ai-breathe bg-blue-500/90 hover:bg-blue-600/90 text-white"
    : "bg-primary/90 hover:shadow-2xl hover:scale-105 text-primary-foreground"

  const tooltipText = isProactive 
    ? pageContext.proactiveMessage 
    : "Ask AI Assistant (Ctrl+K)"

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={async () => {
                if (isProactive) {
                  // Execute the action immediately
                  setIsExecuting(true)
                  try {
                    const res = await fetch('/api/v1/ai/action', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        prompt: "restart the crashed container shown on screen",
                        context_id: pageContext.activeContext
                      })
                    })
                    const data = await res.json()
                    console.log("AI Action Result:", data)
                  } catch (e) {
                    console.error("AI Action Failed:", e)
                  } finally {
                    setIsExecuting(false)
                    pageContext.clearProactive()
                  }
                } else {
                  omniStore.open()
                }
              }}
              size="icon"
              disabled={isExecuting}
              className={`h-14 w-14 rounded-full shadow-xl transition-all backdrop-blur-sm ${buttonClasses}`}
              aria-label="Ask AI Assistant"
            >
              {isExecuting ? <Loader2 className="h-6 w-6 animate-spin" /> :
               isProactive ? <Sparkles className="h-6 w-6" /> : 
               <Bot className="h-6 w-6" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="font-semibold px-4 py-2 max-w-xs text-center border-border shadow-lg">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
