"use client"
// Features 2, 6, 13, 16, 21, 28: CRM deal detail interop panel

import { useState } from "react"
import { FileText, Bell, FolderOpen, StickyNote, Settings2, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DealInvoicesPanel } from "./DealInvoicesPanel"
import { DealStageNotifier } from "./DealStageNotifier"
import { DealDocumentsPanel } from "./DealDocumentsPanel"
import { SharedContactNotes } from "./SharedContactNotes"
import { ContactCustomFieldsCrm } from "./ContactCustomFieldsCrm"
import type { Deal } from "@/lib/api/crm"

interface Props {
  deal: Deal
  onDealUpdate?: (updated: Deal) => void
}

export function DealDetailPanel({ deal, onDealUpdate }: Props) {
  const [currentDeal, setCurrentDeal] = useState(deal)

  const handleUpdate = (updated: Deal) => {
    setCurrentDeal(updated)
    onDealUpdate?.(updated)
  }

  return (
    <div className="space-y-3">
      {/* Stage + Notifications always visible */}
      <DealStageNotifier deal={currentDeal} onUpdate={handleUpdate} />

      <Tabs defaultValue="invoices">
        <TabsList className="flex-wrap h-auto gap-1 w-full justify-start">
          <TabsTrigger value="invoices" className="text-xs h-7 px-2">
            <FileText className="h-3 w-3 mr-1" /> Factures
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs h-7 px-2">
            <FolderOpen className="h-3 w-3 mr-1" /> Documents
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs h-7 px-2">
            <StickyNote className="h-3 w-3 mr-1" /> Notes
          </TabsTrigger>
          <TabsTrigger value="fields" className="text-xs h-7 px-2">
            <Settings2 className="h-3 w-3 mr-1" /> Champs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-3">
          <DealInvoicesPanel dealId={currentDeal.id} />
        </TabsContent>

        <TabsContent value="docs" className="mt-3">
          <DealDocumentsPanel
            entityType="deal"
            entityId={currentDeal.id}
            entityName={currentDeal.title}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          {currentDeal.contactId ? (
            <SharedContactNotes
              contactId={currentDeal.contactId}
              dealId={currentDeal.id}
              source="crm"
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Liez un contact à ce deal pour partager les notes.
            </p>
          )}
        </TabsContent>

        <TabsContent value="fields" className="mt-3">
          <ContactCustomFieldsCrm
            contactId={currentDeal.contactId}
            dealId={currentDeal.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
