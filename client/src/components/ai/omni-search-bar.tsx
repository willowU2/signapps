"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useOmniSearch } from "@/lib/store/omni-search"
import { usePageContext } from "@/lib/store/page-context"
import { Search, Bot, FileText, Calendar, Server, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

export function OmniSearchBar() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const omniStore = useOmniSearch()
  const pageContext = usePageContext()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        omniStore.toggle()
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [omniStore])

  const runCommand = React.useCallback((command: () => unknown) => {
    omniStore.close()
    command()
  }, [omniStore])

  const executeAIAction = async () => {
    omniStore.close()
    setIsExecuting(true)
    const loadingToast = toast.loading(`Executing: "${query}"...`)
    try {
      const res = await fetch('/api/v1/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: query,
          context_id: pageContext.activeContext
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Action Success (${Math.round(data.confidence * 100)}% confident)`, {
          description: data.result_message,
          id: loadingToast
        })
      } else {
        toast.error('Action Failed', {
          description: data.result_message,
          id: loadingToast
        })
      }
    } catch (e) {
      toast.error('Error', { description: 'Failed to contact AI orchestrator', id: loadingToast })
    } finally {
      setIsExecuting(false)
      setQuery("")
    }
  }

  if (!mounted) return null;

  return (
    <CommandDialog open={omniStore.isOpen} onOpenChange={omniStore.close}>
      <CommandInput 
        placeholder="Ask the AI Assistant or search everything..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {query.length > 3 && (
            <>
              <CommandGroup heading="SignApps Autopilot">
                <CommandItem onSelect={executeAIAction} disabled={isExecuting}>
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  Execute Action: "{query}"
                </CommandItem>
              </CommandGroup>
              
              <CommandGroup heading="AI Assistant (RAG)">
                <CommandItem onSelect={() => runCommand(() => router.push(`/ai/chat?q=${encodeURIComponent(query)}`))}>
                  <Bot className="mr-2 h-4 w-4 text-primary" />
                  Ask AI about "{query}"
                </CommandItem>
              </CommandGroup>
            </>
        )}
        
        <CommandSeparator />

        <CommandGroup heading="Quick Links">
          <CommandItem onSelect={() => runCommand(() => router.push("/containers"))}>
            <Server className="mr-2 h-4 w-4" />
            Go to Containers
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/calendar"))}>
            <Calendar className="mr-2 h-4 w-4" />
            Go to Calendar
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/storage/drive"))}>
            <FileText className="mr-2 h-4 w-4" />
            Go to Documents
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
