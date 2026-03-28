"use client"

// IDEA-266: Auto-categorize inbox — AI sorts into Primary/Social/Promotions

import { useState, useCallback } from "react"
import { Sparkles, Inbox, Users, Tag, ShoppingBag, AlertCircle, Settings2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { mailApi } from "@/lib/api-mail"
import { toast } from "sonner"

export type EmailCategory = "primary" | "social" | "promotions" | "updates" | "spam"

const CATEGORIES: { id: EmailCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "primary", label: "Primary", icon: <Inbox className="h-4 w-4" />, color: "text-blue-500" },
  { id: "social", label: "Social", icon: <Users className="h-4 w-4" />, color: "text-green-500" },
  { id: "promotions", label: "Promotions", icon: <ShoppingBag className="h-4 w-4" />, color: "text-orange-500" },
  { id: "updates", label: "Updates", icon: <Tag className="h-4 w-4" />, color: "text-purple-500" },
  { id: "spam", label: "Spam", icon: <AlertCircle className="h-4 w-4" />, color: "text-red-500" },
]

interface CategoryStats {
  category: EmailCategory
  count: number
  unread: number
}

interface CategorizerSettings {
  enabled: boolean
  auto_apply: boolean
  confidence_threshold: number
}

export function AiCategorizerPanel() {
  const [settings, setSettings] = useState<CategorizerSettings>({
    enabled: true,
    auto_apply: true,
    confidence_threshold: 0.75,
  })
  const [stats, setStats] = useState<CategoryStats[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeCategory, setActiveCategory] = useState<EmailCategory | null>(null)

  const runCategorization = useCallback(async () => {
    setRunning(true)
    setProgress(0)
    try {
      // Stream progress simulation while actual AI runs
      const interval = setInterval(() => setProgress(p => Math.min(p + 5, 90)), 200)
      const result = await mailApi.categorizeInbox({ settings })
      clearInterval(interval)
      setProgress(100)
      setStats(result.stats)
      toast.success(`Categorized ${result.total} emails`)
    } catch {
      toast.error("Catégorisation échouée")
    } finally {
      setRunning(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }, [settings])

  async function saveSettings(updated: Partial<CategorizerSettings>) {
    const next = { ...settings, ...updated }
    setSettings(next)
    try {
      await mailApi.saveCategorizeSettings(next)
    } catch {
      toast.error("Impossible d'enregistrer settings")
    }
  }

  const totalEmails = stats.reduce((s, c) => s + c.count, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Inbox Categorization
          </CardTitle>
          <Button size="sm" onClick={runCategorization} disabled={running || !settings.enabled}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", running && "animate-spin")} />
            {running ? "Categorizing…" : "Run Now"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {running && progress > 0 && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-enabled" className="text-sm">Enable auto-categorization</Label>
              <Switch id="cat-enabled" checked={settings.enabled} onCheckedChange={v => saveSettings({ enabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-auto" className="text-sm">Auto-apply (no confirmation)</Label>
              <Switch id="cat-auto" checked={settings.auto_apply} onCheckedChange={v => saveSettings({ auto_apply: v })} />
            </div>
          </div>

          {stats.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Distribution ({totalEmails} emails)</p>
              {CATEGORIES.map(cat => {
                const s = stats.find(x => x.category === cat.id)
                if (!s || s.count === 0) return null
                const pct = totalEmails > 0 ? Math.round((s.count / totalEmails) * 100) : 0
                return (
                  <button
                    key={cat.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left",
                      activeCategory === cat.id && "bg-muted"
                    )}
                    onClick={() => setActiveCategory(c => c === cat.id ? null : cat.id)}
                  >
                    <span className={cat.color}>{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{cat.label}</span>
                        <span className="text-muted-foreground">{s.count}</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                    {s.unread > 0 && <Badge variant="secondary" className="text-xs">{s.unread}</Badge>}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
