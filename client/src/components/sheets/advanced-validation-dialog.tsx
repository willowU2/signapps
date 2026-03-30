"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

export type AdvancedValidation =
    | { type: 'list'; values: string[] }
    | { type: 'boolean' }
    | { type: 'number_range'; min: number; max: number; message?: string }
    | { type: 'date_range'; minDate: string; maxDate: string; message?: string }
    | { type: 'regex'; pattern: string; message?: string }
    | { type: 'custom_formula'; formula: string; message?: string }

interface AdvancedValidationDialogProps {
    current?: AdvancedValidation
    onApply: (v: AdvancedValidation | undefined) => void
    onClose: () => void
}

export function AdvancedValidationDialog({ current, onApply, onClose }: AdvancedValidationDialogProps) {
    const [type, setType] = useState<AdvancedValidation['type']>(current?.type || 'list')
    const [listValues, setListValues] = useState(current?.type === 'list' ? current.values.join(', ') : '')
    const [numMin, setNumMin] = useState(current?.type === 'number_range' ? String(current.min) : '')
    const [numMax, setNumMax] = useState(current?.type === 'number_range' ? String(current.max) : '')
    const [dateMin, setDateMin] = useState(current?.type === 'date_range' ? current.minDate : '')
    const [dateMax, setDateMax] = useState(current?.type === 'date_range' ? current.maxDate : '')
    const [regexPattern, setRegexPattern] = useState(current?.type === 'regex' ? current.pattern : '')
    const [formula, setFormula] = useState(current?.type === 'custom_formula' ? current.formula : '')
    const [message, setMessage] = useState((current as { message?: string } | undefined)?.message || '')

    const handleApply = () => {
        let v: AdvancedValidation | undefined
        switch (type) {
            case 'list':
                if (!listValues.trim()) { toast.error('Entrez au moins une valeur'); return }
                v = { type: 'list', values: listValues.split(',').map(s => s.trim()).filter(Boolean) }
                break
            case 'boolean':
                v = { type: 'boolean' }
                break
            case 'number_range':
                if (isNaN(Number(numMin)) || isNaN(Number(numMax))) { toast.error('Valeurs numériques requises'); return }
                v = { type: 'number_range', min: Number(numMin), max: Number(numMax), message: message || undefined }
                break
            case 'date_range':
                if (!dateMin || !dateMax) { toast.error('Dates requises'); return }
                v = { type: 'date_range', minDate: dateMin, maxDate: dateMax, message: message || undefined }
                break
            case 'regex':
                try { new RegExp(regexPattern) } catch { toast.error('Regex invalide'); return }
                v = { type: 'regex', pattern: regexPattern, message: message || undefined }
                break
            case 'custom_formula':
                if (!formula.startsWith('=')) { toast.error('La formule doit commencer par ='); return }
                v = { type: 'custom_formula', formula, message: message || undefined }
                break
        }
        onApply(v)
        onClose()
        toast.success('Validation appliquée')
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4 w-[400px]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-sm">Validation des données</span>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Type de critère</label>
                        <select
                            className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                            value={type}
                            onChange={e => setType(e.target.value as AdvancedValidation['type'])}
                        >
                            <option value="list">Liste de valeurs</option>
                            <option value="boolean">Case à cocher</option>
                            <option value="number_range">Plage numérique</option>
                            <option value="date_range">Plage de dates</option>
                            <option value="regex">Expression régulière</option>
                            <option value="custom_formula">Formule personnalisée</option>
                        </select>
                    </div>

                    {type === 'list' && (
                        <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Valeurs (séparées par des virgules)</label>
                            <input className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" placeholder="Oui, Non, En attente" value={listValues} onChange={e => setListValues(e.target.value)} />
                        </div>
                    )}

                    {type === 'number_range' && (
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[11px] text-muted-foreground mb-1 block">Minimum</label>
                                <input type="number" className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" value={numMin} onChange={e => setNumMin(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[11px] text-muted-foreground mb-1 block">Maximum</label>
                                <input type="number" className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" value={numMax} onChange={e => setNumMax(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {type === 'date_range' && (
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[11px] text-muted-foreground mb-1 block">Depuis</label>
                                <input type="date" className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" value={dateMin} onChange={e => setDateMin(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[11px] text-muted-foreground mb-1 block">Jusqu'au</label>
                                <input type="date" className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" value={dateMax} onChange={e => setDateMax(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {type === 'regex' && (
                        <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Pattern (regex)</label>
                            <input className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none font-mono" placeholder="^\d{5}$" value={regexPattern} onChange={e => setRegexPattern(e.target.value)} />
                        </div>
                    )}

                    {type === 'custom_formula' && (
                        <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Formule (doit retourner VRAI/FAUX)</label>
                            <input className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none font-mono" placeholder="=AND(A1>0,A1<100)" value={formula} onChange={e => setFormula(e.target.value)} />
                        </div>
                    )}

                    {type !== 'boolean' && type !== 'list' && (
                        <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Message d'erreur (optionnel)</label>
                            <input className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" placeholder="Valeur invalide" value={message} onChange={e => setMessage(e.target.value)} />
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button onClick={() => { onApply(undefined); onClose(); toast.info('Validation supprimée') }} className="flex-1 h-8 border border-[#dadce0] dark:border-[#5f6368] rounded text-[12px] hover:bg-muted">
                            Supprimer
                        </button>
                        <button onClick={handleApply} className="flex-1 h-8 bg-[#1a73e8] text-white rounded text-[12px] font-medium hover:bg-[#1557b0]">
                            Appliquer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
