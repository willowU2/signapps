"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useSpreadsheet } from "./use-spreadsheet"
import { evaluateFormula } from "@/lib/sheets/formula"
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Bot, Loader2, Sparkles, Wand2, Type, PaintBucket, Plus } from "lucide-react"

const ROWS = 100
const COLS = 26 // A-Z

// Helper to get column label (0 -> A, 1 -> B, etc.)
const getColLabel = (index: number) => String.fromCharCode(65 + index)

export function Spreadsheet() {
    const { data, setCell, isConnected } = useSpreadsheet("sheet-demo")
    const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null)
    const [editValue, setEditValue] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync edit value when selection changes
    useEffect(() => {
        if (selectedCell) {
            const val = data[`${selectedCell.r},${selectedCell.c}`]?.value || ""
            setEditValue(val)
        }
    }, [selectedCell, data])

    const handleCellClick = (r: number, c: number) => {
        setSelectedCell({ r, c })
        setIsEditing(false) // Stop editing prev cell
    }

    const handleDoubleClick = (r: number, c: number) => {
        setSelectedCell({ r, c })
        setIsEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const commitEdit = () => {
        if (selectedCell) {
            setCell(selectedCell.r, selectedCell.c, editValue)
            setIsEditing(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) {
            if (e.key === 'Enter') {
                commitEdit()
                // Move down
                setSelectedCell(prev => prev ? { r: prev.r + 1, c: prev.c } : null)
            }
            return
        }

        if (!selectedCell) return

        // Navigation
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedCell(prev => prev && prev.r > 0 ? { ...prev, r: prev.r - 1 } : prev)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedCell(prev => prev && prev.r < ROWS - 1 ? { ...prev, r: prev.r + 1 } : prev)
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setSelectedCell(prev => prev && prev.c > 0 ? { ...prev, c: prev.c - 1 } : prev)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            setSelectedCell(prev => prev && prev.c < COLS - 1 ? { ...prev, c: prev.c + 1 } : prev)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            setIsEditing(true)
            setTimeout(() => inputRef.current?.focus(), 0)
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            // Start typing overwrites cell
            setIsEditing(true)
            setEditValue(e.key)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value)
        if (selectedCell) {
            setCell(selectedCell.r, selectedCell.c, e.target.value)
        }
    }

    return (
        <div
            className="w-full h-full flex flex-col bg-white dark:bg-gray-950 outline-none font-sans"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md shrink-0">
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><Bold className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><Italic className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><Type className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><PaintBucket className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><AlignLeft className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><AlignCenter className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"><AlignRight className="w-4 h-4" /></button>

                <div className="ml-auto flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-semibold shadow-sm transition-all">
                        <Bot className="w-3.5 h-3.5" /> AI Assist
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Status</span>
                        <div className={cn("h-2 w-2 rounded-full shadow-sm", isConnected ? "bg-green-500 shadow-green-500/50" : "bg-red-500 shadow-red-500/50")} />
                    </div>
                </div>
            </div>

            {/* Formula Bar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 shrink-0 shadow-sm relative z-10">
                <div className="w-12 font-semibold text-sm text-gray-600 dark:text-gray-400 text-center shrink-0 tracking-wider">
                    {selectedCell ? `${getColLabel(selectedCell.c)}${selectedCell.r + 1}` : ''}
                </div>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="text-gray-400 font-serif italic font-bold shrink-0 select-none">fx</div>
                <input
                    className="flex-1 outline-none text-sm bg-transparent font-mono"
                    value={selectedCell ? editValue : ''}
                    onChange={handleFormulaChange}
                    onFocus={() => {
                        if (selectedCell) setIsEditing(true);
                    }}
                    placeholder={selectedCell ? "Enter value or formula (start with =)" : "Select a cell"}
                    disabled={!selectedCell}
                />
            </div>

            {/* Grid Container */}
            <div className="relative flex-1 overflow-auto bg-gray-50/30 dark:bg-gray-900/10 custom-scrollbar">
                {/* Header Row (A, B, C...) */}
                <div className="flex sticky top-0 z-20">
                    <div className="w-12 h-7 bg-slate-100 dark:bg-slate-800/90 border-r border-b border-slate-200 dark:border-slate-700/60 shrink-0 sticky left-0 z-30" /> {/* Corner */}
                    {Array.from({ length: COLS }).map((_, c) => (
                        <div key={c} className="w-24 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800/90 border-r border-b border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0 shadow-sm">
                            {getColLabel(c)}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                {Array.from({ length: ROWS }).map((_, r) => (
                    <div key={r} className="flex h-7">
                        {/* Row Header (1, 2, 3...) */}
                        <div className="w-12 h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/90 border-r border-b border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0 sticky left-0 z-10 shadow-sm">
                            {r + 1}
                        </div>
                        {/* Cells */}
                        {Array.from({ length: COLS }).map((_, c) => {
                            const isActive = selectedCell?.r === r && selectedCell?.c === c
                            // const cellData = data[`${r},${c}`] // Unused?
                            const rawValue = data[`${r},${c}`]?.value || ""
                            const displayValue = evaluateFormula(rawValue, (r, c) => data[`${r},${c}`]?.value || "0")

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={cn(
                                        "w-24 h-full border-r border-b border-gray-200 dark:border-gray-800 text-[13px] px-1.5 flex items-center cursor-cell relative outline-none bg-white dark:bg-gray-950",
                                        isActive ? "ring-2 ring-blue-500 z-10 bg-blue-50/30 dark:bg-blue-900/20" : "hover:bg-gray-50/50 dark:hover:bg-gray-900/50"
                                    )}
                                    onMouseDown={() => handleCellClick(r, c)}
                                    onDoubleClick={() => handleDoubleClick(r, c)}
                                >
                                    {isActive && isEditing ? (
                                        <input
                                            ref={inputRef}
                                            className="w-full h-full border-none outline-none bg-transparent p-0 m-0 text-[13px]"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={commitEdit}
                                        />
                                    ) : (
                                        <span className={cn("truncate", displayValue && !isNaN(Number(displayValue)) ? "w-full text-right" : "")}>{displayValue}</span>
                                    )}
                                    {/* Active Cell Drag Handle */}
                                    {isActive && !isEditing && (
                                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white dark:border-gray-950 rounded-[1px] cursor-crosshair z-20" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* Bottom Tabs */}
            <div className="flex items-center h-10 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 shrink-0">
                <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 mr-2"><Plus className="w-4 h-4" /></button>
                <div className="px-5 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 border-b-0 rounded-t-lg text-sm font-semibold text-blue-600 dark:text-blue-400 shadow-[0_-2px_4px_rgba(0,0,0,0.02)] -mb-[1px]">Sheet1</div>
                <div className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer transition-colors">Sheet2</div>
            </div>
        </div>
    )
}
