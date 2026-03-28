"use client"

// Mail Advanced Features page — 261–268

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AtSign, Inbox, RepeatIcon, ShieldCheck, Eye, Sparkles, Database, Undo2 } from "lucide-react"
import { EmailAliases } from "@/components/mail/email-aliases"
import { UnifiedInbox } from "@/components/mail/unified-inbox"
import { RecurringEmailManager } from "@/components/mail/recurring-email"
import { EmailDelegation } from "@/components/mail/email-delegation"
import { ReadTrackingDashboard } from "@/components/mail/read-tracking-dashboard"
import { AiCategorizerPanel } from "@/components/mail/ai-categorizer"
import { CrmTemplateVariables } from "@/components/mail/crm-template-variables"
import { UndoSendSettings } from "@/components/mail/undo-send"
import { toast } from "sonner"

export default function MailAdvancedPage() {
  const [undoEnabled, setUndoEnabled] = useState(true)
  const [undoDelay, setUndoDelay] = useState(30)
  const [crmBody, setCrmBody] = useState("")

  async function saveUndoSettings(enabled: boolean, delay: number) {
    try {
      await fetch("/api/mail/settings/undo-send", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, delay_seconds: delay }),
      })
      toast.success("Paramètres d'annulation enregistrés")
    } catch {
      toast.error("Échec de l'enregistrement des paramètres")
    }
  }

  return (
    <div className="w-full space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Advanced Mail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aliases, unified inbox, recurring emails, delegation, tracking, AI categorization, CRM variables, and undo send.
          </p>
        </div>

        <Tabs defaultValue="aliases">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="aliases" className="gap-1 text-xs">
              <AtSign className="h-3.5 w-3.5" /> Aliases
            </TabsTrigger>
            <TabsTrigger value="unified" className="gap-1 text-xs">
              <Inbox className="h-3.5 w-3.5" /> Unified
            </TabsTrigger>
            <TabsTrigger value="recurring" className="gap-1 text-xs">
              <RepeatIcon className="h-3.5 w-3.5" /> Recurring
            </TabsTrigger>
            <TabsTrigger value="delegation" className="gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Delegation
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-1 text-xs">
              <Eye className="h-3.5 w-3.5" /> Tracking
            </TabsTrigger>
            <TabsTrigger value="ai-cat" className="gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> AI Sort
            </TabsTrigger>
            <TabsTrigger value="crm-vars" className="gap-1 text-xs">
              <Database className="h-3.5 w-3.5" /> CRM Vars
            </TabsTrigger>
            <TabsTrigger value="undo" className="gap-1 text-xs">
              <Undo2 className="h-3.5 w-3.5" /> Undo Send
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="aliases">
              <EmailAliases accountId="current" accountEmail="me@example.com" />
            </TabsContent>

            <TabsContent value="unified">
              <div className="border rounded-lg overflow-hidden h-[500px]">
                <UnifiedInbox />
              </div>
            </TabsContent>

            <TabsContent value="recurring">
              <RecurringEmailManager />
            </TabsContent>

            <TabsContent value="delegation">
              <EmailDelegation accountId="current" />
            </TabsContent>

            <TabsContent value="tracking">
              <ReadTrackingDashboard />
            </TabsContent>

            <TabsContent value="ai-cat">
              <AiCategorizerPanel />
            </TabsContent>

            <TabsContent value="crm-vars">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Compose with CRM merge fields. Variables resolve when a contact email is set.
                </p>
                <CrmTemplateVariables
                  body={crmBody}
                  onBodyChange={setCrmBody}
                />
              </div>
            </TabsContent>

            <TabsContent value="undo">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure a grace period after clicking Send to allow cancellation.
                </p>
                <UndoSendSettings
                  enabled={undoEnabled}
                  delaySeconds={undoDelay}
                  onToggle={v => { setUndoEnabled(v); saveUndoSettings(v, undoDelay) }}
                  onDelayChange={v => { setUndoDelay(v); saveUndoSettings(undoEnabled, v) }}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
  )
}
