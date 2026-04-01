"use client"
// Feature 29: CRM → export deals with contact info CSV

import { useState } from "react"
import { Download, FileDown, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportDealsWithContactsCsv } from "@/lib/api/interop"
import { toast } from "sonner"

interface Contact {
  id: string
  name: string
  email: string
  company?: string
}

interface Props {
  contacts: Contact[]
  compact?: boolean
}

export function DealsExportCsv({ contacts, compact = false }: Props) {
  const [exported, setExported] = useState(false)

  const handleExport = async () => {
    const csv = await exportDealsWithContactsCsv(contacts)
    if (!csv.trim() || csv.split("\n").length <= 1) {
      toast.error("Aucun deal à exporter.")
      return
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `deals-contacts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setExported(true)
    toast.success("Deals exportés avec infos contact.")
    setTimeout(() => setExported(false), 3000)
  }

  if (compact) {
    return (
      <Button size="sm" variant="outline" onClick={handleExport} className="h-8 text-xs">
        <Download className="h-3.5 w-3.5 mr-1" />
        Export Deals+Contacts
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <FileDown className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Export Deals avec contacts</p>
          <p className="text-xs text-muted-foreground">
            CSV incluant : titre, société, contact, email, valeur, étape, probabilité, clôture
          </p>
        </div>
      </div>
      <Button onClick={handleExport} className="w-full h-8 text-sm">
        {exported
          ? <><CheckCircle className="h-4 w-4 mr-2" /> Exporté</>
          : <><Download className="h-4 w-4 mr-2" /> Télécharger CSV</>
        }
      </Button>
    </div>
  )
}
