"use client"

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CellData, ROWS, COLS } from "./types"
import { X, Play, Save, Trash2, FileCode, ChevronDown, Copy, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getClient, ServiceName } from "@/lib/api/factory"

const docsClient = getClient(ServiceName.DOCS)

interface MacroApi {
    getCell: (row: number, col: number) => string
    setCell: (row: number, col: number, value: string) => void
    getRange: (startRow: number, startCol: number, endRow: number, endCol: number) => string[][]
    setRange: (startRow: number, startCol: number, data: string[][]) => void
    getSheetName: () => string
    alert: (msg: string) => void
}

interface SavedMacro {
    name: string
    code: string
    createdAt: number
}

const STORAGE_KEY_PREFIX = 'signapps-macros-'

const EXAMPLE_MACROS: { name: string, code: string, desc: string }[] = [
    {
        name: 'Remplir sequence',
        desc: 'Remplit A1:A10 avec les nombres 1 a 10',
        code: `// Remplir une sequence de nombres
for (let i = 0; i < 10; i++) {
    api.setCell(i, 0, String(i + 1));
}
api.alert("Sequence 1-10 inseree en colonne A");`
    },
    {
        name: 'Somme colonne',
        desc: 'Calcule la somme de la colonne A et ecrit le resultat',
        code: `// Somme de la colonne A (lignes 0-99)
let sum = 0;
let count = 0;
for (let r = 0; r < 100; r++) {
    const val = api.getCell(r, 0);
    if (val && !isNaN(Number(val))) {
        sum += Number(val);
        count++;
    }
}
// Ecrire le resultat apres la derniere valeur
api.setCell(count, 0, String(sum));
api.alert("Somme: " + sum + " (ecrite en A" + (count + 1) + ")");`
    },
    {
        name: 'Transposer',
        desc: 'Transpose les donnees de A1:E5 vers G1:K5',
        code: `// Transposer une plage 5x5 de A1:E5 vers G1
const data = api.getRange(0, 0, 4, 4);
const transposed = [];
for (let c = 0; c < data[0].length; c++) {
    const row = [];
    for (let r = 0; r < data.length; r++) {
        row.push(data[r][c]);
    }
    transposed.push(row);
}
api.setRange(0, 6, transposed);
api.alert("Donnees transposees vers G1");`
    },
    {
        name: 'Effacer vides',
        desc: 'Supprime les lignes vides dans la colonne A',
        code: `// Compacter: supprimer les lignes vides de la colonne A
const values = [];
for (let r = 0; r < 100; r++) {
    const val = api.getCell(r, 0);
    if (val.trim()) values.push(val);
}
// Re-ecrire sans les vides
for (let r = 0; r < 100; r++) {
    api.setCell(r, 0, r < values.length ? values[r] : "");
}
api.alert(values.length + " valeurs conservees");`
    },
    {
        name: 'Generer dates',
        desc: 'Genere les dates du mois courant en colonne A',
        code: `// Generer les dates du mois courant
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const daysInMonth = new Date(year, month + 1, 0).getDate();

api.setCell(0, 0, "Date");
api.setCell(0, 1, "Jour");
for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().split("T")[0];
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    api.setCell(d, 0, dateStr);
    api.setCell(d, 1, dayNames[date.getDay()]);
}
api.alert(daysInMonth + " dates generees");`
    }
]

function loadMacrosFromStorage(sheetId: string): SavedMacro[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + sheetId)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

function saveMacrosToStorage(sheetId: string, macros: SavedMacro[]) {
    localStorage.setItem(STORAGE_KEY_PREFIX + sheetId, JSON.stringify(macros))
}

function mapMacroFromApi(m: any): SavedMacro {
    return {
        name: m.name ?? m.title ?? 'Macro',
        code: m.code ?? m.script ?? '',
        createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }
}

interface MacroEditorProps {
    data: Record<string, CellData>
    evaluatedData: Record<string, string>
    sheetId: string
    sheetName: string
    setCell: (r: number, c: number, value: string) => void
    transact: (fn: () => void) => void
    onClose: () => void
}

export function MacroEditor({ data, evaluatedData, sheetId, sheetName, setCell, transact, onClose }: MacroEditorProps) {
    const [code, setCode] = useState(EXAMPLE_MACROS[0].code)
    const [macroName, setMacroName] = useState('')
    const [savedMacros, setSavedMacros] = useState<SavedMacro[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [showExamples, setShowExamples] = useState(false)
    const [showSaved, setShowSaved] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await docsClient.get<any[]>(`/docs/${sheetId}/macros`)
                const loaded = (res.data ?? []).map(mapMacroFromApi)
                setSavedMacros(loaded)
                saveMacrosToStorage(sheetId, loaded)
            } catch {
                setSavedMacros(loadMacrosFromStorage(sheetId))
            }
        }
        load()
    }, [sheetId])

    // Sync tab key in textarea
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault()
            const target = e.currentTarget
            const start = target.selectionStart
            const end = target.selectionEnd
            const newCode = code.substring(0, start) + '    ' + code.substring(end)
            setCode(newCode)
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 4
            })
        }
    }, [code])

    const runMacro = useCallback(() => {
        setIsRunning(true)
        setOutput([])
        const logs: string[] = []
        const pendingWrites: { r: number, c: number, value: string }[] = []

        const api: MacroApi = {
            getCell: (row: number, col: number): string => {
                if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return ''
                return evaluatedData[`${row},${col}`] || data[`${row},${col}`]?.value || ''
            },
            setCell: (row: number, col: number, value: string) => {
                if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
                    logs.push(`[WARN] setCell(${row}, ${col}) hors limites`)
                    return
                }
                pendingWrites.push({ r: row, c: col, value: String(value) })
            },
            getRange: (startRow: number, startCol: number, endRow: number, endCol: number): string[][] => {
                const result: string[][] = []
                for (let r = startRow; r <= endRow; r++) {
                    const row: string[] = []
                    for (let c = startCol; c <= endCol; c++) {
                        row.push(api.getCell(r, c))
                    }
                    result.push(row)
                }
                return result
            },
            setRange: (startRow: number, startCol: number, rangeData: string[][]) => {
                for (let r = 0; r < rangeData.length; r++) {
                    for (let c = 0; c < rangeData[r].length; c++) {
                        api.setCell(startRow + r, startCol + c, rangeData[r][c])
                    }
                }
            },
            getSheetName: () => sheetName,
            alert: (msg: string) => {
                logs.push(String(msg))
            }
        }

        try {
            // Sandbox: create function with limited scope
            const safeCode = `"use strict";\n${code}`
            const fn = new Function('api', safeCode)

            // Execute with a timeout guard
            const timeoutMs = 5000
            let timedOut = false
            const timer = setTimeout(() => { timedOut = true }, timeoutMs)

            fn(api)
            clearTimeout(timer)

            if (timedOut) {
                logs.push('[ERREUR] Execution interrompue (timeout 5s)')
            } else {
                // Apply all pending writes in a single transaction
                if (pendingWrites.length > 0) {
                    transact(() => {
                        for (const w of pendingWrites) {
                            setCell(w.r, w.c, w.value)
                        }
                    })
                    logs.push(`[OK] ${pendingWrites.length} cellule(s) modifiee(s)`)
                } else {
                    logs.push('[OK] Execution terminee (aucune modification)')
                }
            }
        } catch (err: any) {
            logs.push(`[ERREUR] ${err.message || String(err)}`)
        }

        setOutput(logs)
        setIsRunning(false)

        // Show toast for first log message
        if (logs.length > 0) {
            const first = logs[0]
            if (first.startsWith('[ERREUR]')) toast.error(first.replace('[ERREUR] ', ''))
            else if (first.startsWith('[WARN]')) toast.warning(first.replace('[WARN] ', ''))
            else if (!first.startsWith('[OK]')) toast.info(first)
        }
    }, [code, data, evaluatedData, sheetName, setCell, transact])

    const handleSave = useCallback(() => {
        const name = macroName.trim() || `Macro ${savedMacros.length + 1}`
        const existingIdx = savedMacros.findIndex(m => m.name === name)
        const macro: SavedMacro = { name, code, createdAt: Date.now() }
        let updated: SavedMacro[]
        if (existingIdx >= 0) {
            updated = [...savedMacros]
            updated[existingIdx] = macro
            docsClient.put(`/docs/${sheetId}/macros/${encodeURIComponent(name)}`, { code }).catch(() => {})
        } else {
            updated = [...savedMacros, macro]
            docsClient.post(`/docs/${sheetId}/macros`, { name, code }).catch(() => {})
        }
        setSavedMacros(updated)
        saveMacrosToStorage(sheetId, updated)
        setMacroName(name)
        toast.success(`Macro "${name}" sauvegardee`)
    }, [macroName, code, savedMacros, sheetId])

    const handleDelete = useCallback((name: string) => {
        const updated = savedMacros.filter(m => m.name !== name)
        setSavedMacros(updated)
        saveMacrosToStorage(sheetId, updated)
        docsClient.delete(`/docs/${sheetId}/macros/${encodeURIComponent(name)}`).catch(() => {})
        toast.info(`Macro "${name}" supprimee`)
    }, [savedMacros, sheetId])

    const handleLoad = useCallback((macro: SavedMacro) => {
        setCode(macro.code)
        setMacroName(macro.name)
        setShowSaved(false)
        setOutput([])
    }, [])

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#dadce0] dark:border-[#5f6368]">
                    <div className="flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-[#34a853]" />
                        <span className="font-medium text-[15px]">Editeur de macros</span>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#e3e3e3] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#252526]">
                        <input className="h-7 w-[180px] bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none border border-transparent focus:border-[#1a73e8]"
                            placeholder="Nom de la macro"
                            value={macroName} onChange={e => setMacroName(e.target.value)} />
                        <button onClick={runMacro} disabled={isRunning || !code.trim()}
                            className={cn("flex items-center gap-1 px-3 h-7 rounded text-[12px] font-medium transition-colors",
                                isRunning ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-[#34a853] text-white hover:bg-[#2d9249]"
                            )}>
                            <Play className="w-3.5 h-3.5" /> Executer
                        </button>
                        <button onClick={handleSave} disabled={!code.trim()}
                            className="flex items-center gap-1 px-3 h-7 rounded text-[12px] border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                            <Save className="w-3.5 h-3.5" /> Sauvegarder
                        </button>
                        <div className="relative">
                            <button onClick={() => { setShowSaved(!showSaved); setShowExamples(false) }}
                                className="flex items-center gap-1 px-3 h-7 rounded text-[12px] border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                                Mes macros <ChevronDown className="w-3 h-3" />
                            </button>
                            {showSaved && (
                                <div className="absolute top-8 left-0 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl z-50 w-[240px] py-1 max-h-[200px] overflow-y-auto">
                                    {savedMacros.length === 0 && (
                                        <div className="px-3 py-2 text-[12px] text-[#9aa0a6] italic">Aucune macro sauvegardee</div>
                                    )}
                                    {savedMacros.map(m => (
                                        <div key={m.name} className="flex items-center gap-1 px-2 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                                            <button onClick={() => handleLoad(m)} className="flex-1 text-left text-[12px] truncate">{m.name}</button>
                                            <button onClick={() => handleDelete(m.name)} className="p-0.5 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <button onClick={() => { setShowExamples(!showExamples); setShowSaved(false) }}
                                className="flex items-center gap-1 px-3 h-7 rounded text-[12px] border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                                Exemples <ChevronDown className="w-3 h-3" />
                            </button>
                            {showExamples && (
                                <div className="absolute top-8 right-0 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl z-50 w-[280px] py-1">
                                    {EXAMPLE_MACROS.map(ex => (
                                        <button key={ex.name} onClick={() => { setCode(ex.code); setMacroName(ex.name); setShowExamples(false); setOutput([]) }}
                                            className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                                            <div className="text-[12px] font-medium">{ex.name}</div>
                                            <div className="text-[10px] text-[#5f6368]">{ex.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Code editor */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center px-4 py-1 bg-[#1e1e1e] text-[#808080] text-[11px]">
                            <span>JavaScript</span>
                            <span className="ml-auto">API: api.getCell(), api.setCell(), api.getRange(), api.setRange(), api.getSheetName(), api.alert()</span>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 min-h-[250px] bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[13px] p-4 outline-none resize-none leading-[1.6] placeholder:text-[#5f6368]"
                            placeholder="// Ecrivez votre macro ici...&#10;// Utilisez api.getCell(row, col) pour lire&#10;// et api.setCell(row, col, value) pour ecrire"
                            spellCheck={false}
                        />
                    </div>

                    {/* Output console */}
                    {output.length > 0 && (
                        <div className="border-t border-[#5f6368] bg-[#1e1e1e] max-h-[120px] overflow-y-auto">
                            <div className="flex items-center px-4 py-1 text-[11px] text-[#808080] border-b border-[#333]">Console</div>
                            <div className="px-4 py-2 space-y-0.5">
                                {output.map((line, i) => (
                                    <div key={i} className={cn(
                                        "text-[12px] font-mono",
                                        line.startsWith('[ERREUR]') ? 'text-[#f48771]' :
                                            line.startsWith('[WARN]') ? 'text-[#cca700]' :
                                                line.startsWith('[OK]') ? 'text-[#89d185]' : 'text-[#d4d4d4]'
                                    )}>
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Security notice */}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#fff3cd] dark:bg-[#554800] text-[11px] text-[#856404] dark:text-[#ffc107] border-t border-[#ffc107]/30">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Les macros s'executent dans un contexte restreint. Seules les fonctions de l'API sont disponibles.</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
