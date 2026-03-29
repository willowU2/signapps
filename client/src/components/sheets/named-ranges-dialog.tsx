"use client"

import { useState } from "react"
import { X, Plus, Trash2, Edit2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface NamedRange {
    name: string
    range: string // e.g. "A1:B10" or "Sheet2!C3:D5"
}

interface NamedRangesDialogProps {
    namedRanges: NamedRange[]
    onAdd: (nr: NamedRange) => void
    onRemove: (name: string) => void
    onUpdate: (oldName: string, nr: NamedRange) => void
    onClose: () => void
}

export function NamedRangesDialog({ namedRanges, onAdd, onRemove, onUpdate, onClose }: NamedRangesDialogProps) {
    const [newName, setNewName] = useState("")
    const [newRange, setNewRange] = useState("")
    const [editingName, setEditingName] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editRange, setEditRange] = useState("")

    const validateName = (n: string) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(n)

    const handleAdd = () => {
        const name = newName.trim()
        const range = newRange.trim().toUpperCase()
        if (!name) { toast.error("Le nom est requis"); return }
        if (!validateName(name)) { toast.error("Nom invalide — lettres, chiffres et _ uniquement, commence par une lettre"); return }
        if (!range) { toast.error("La plage est requise"); return }
        if (namedRanges.some(nr => nr.name === name)) { toast.error("Ce nom existe déjà"); return }
        onAdd({ name, range })
        setNewName("")
        setNewRange("")
        toast.success(`Plage nommée "${name}" créée`)
    }

    const handleUpdate = () => {
        if (!editingName) return
        const name = editName.trim()
        const range = editRange.trim().toUpperCase()
        if (!name || !validateName(name)) { toast.error("Nom invalide"); return }
        if (!range) { toast.error("Plage requise"); return }
        onUpdate(editingName, { name, range })
        setEditingName(null)
        toast.success("Plage nommée mise à jour")
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4 w-[480px] max-h-[70vh] overflow-y-auto flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Plages nommées</span>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>

                {/* List */}
                <div className="flex-1 space-y-1 max-h-[280px] overflow-y-auto">
                    {namedRanges.length === 0 && (
                        <p className="text-[12px] text-muted-foreground px-2 py-3 text-center">Aucune plage nommée</p>
                    )}
                    {namedRanges.map(nr => (
                        <div key={nr.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                            {editingName === nr.name ? (
                                <>
                                    <input className="flex-1 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none font-mono" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nom" />
                                    <input className="flex-1 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none font-mono uppercase" value={editRange} onChange={e => setEditRange(e.target.value.toUpperCase())} placeholder="A1:B10" />
                                    <button onClick={handleUpdate} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingName(null)} className="p-1 hover:bg-muted dark:hover:bg-[#3c4043] rounded"><X className="w-4 h-4" /></button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-[12px] font-semibold text-[#1a73e8]">{nr.name}</span>
                                    <span className="flex-1 text-[12px] font-mono text-muted-foreground">{nr.range}</span>
                                    <button onClick={() => { setEditingName(nr.name); setEditName(nr.name); setEditRange(nr.range) }} className="p-1 hover:bg-muted dark:hover:bg-[#3c4043] rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => { onRemove(nr.name); toast.info(`"${nr.name}" supprimé`) }} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new */}
                <div className="border-t pt-3 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Nouvelle plage nommée</p>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                            placeholder="Nom (ex: Ventes)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                        />
                        <input
                            className="flex-1 h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none font-mono"
                            placeholder="Plage (ex: A1:B10)"
                            value={newRange}
                            onChange={e => setNewRange(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                        />
                        <button
                            onClick={handleAdd}
                            className="h-8 px-3 bg-[#1a73e8] text-white rounded text-[12px] font-medium hover:bg-[#1557b0] flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Utilisez les noms dans les formules : <code className="font-mono bg-muted px-1 rounded">=SUM(Ventes)</code>
                    </p>
                </div>
            </div>
        </div>
    )
}
