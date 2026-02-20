"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useSpreadsheet } from "./use-spreadsheet"
import { evaluateFormula, indexToCol, colToIndex } from "@/lib/sheets/formula"
import {
    Bold, Italic, AlignLeft, AlignCenter, AlignRight, Bot,
    TextSelect, PaintBucket, Plus, Undo, Redo, Type, FileUp, List, Link, Strikethrough, Loader2
} from "lucide-react"

const ROWS = 200
const COLS = 50

export function Spreadsheet() {
    const { data, setCell, isConnected } = useSpreadsheet("sheet-demo")

    // Selection state
    const [selectedRange, setSelectedRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null)
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Editing state
    const [editValue, setEditValue] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const formulaBarRef = useRef<HTMLInputElement>(null)

    // Formula Evaluation Cache
    const [evaluatedData, setEvaluatedData] = useState<Record<string, string>>({})

    // Active bounds for rendering blue outline
    const selectionBounds = useMemo(() => {
        if (!selectedRange) return null;
        return {
            minR: Math.min(selectedRange.start.r, selectedRange.end.r),
            maxR: Math.max(selectedRange.start.r, selectedRange.end.r),
            minC: Math.min(selectedRange.start.c, selectedRange.end.c),
            maxC: Math.max(selectedRange.start.c, selectedRange.end.c)
        }
    }, [selectedRange]);

    // Recalculate ALL formulas whenever data changes
    useEffect(() => {
        const newData: Record<string, string> = {}
        const getData = (r: number, c: number) => data[`${r},${c}`]?.value || ""

        // This is a naive recalculation of the entire board. 
        // In a pro spreadsheet (React Virtualized + Web Workers), this would build a dependency graph.
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cellRef = `${r},${c}`
                if (data[cellRef]) {
                    newData[cellRef] = evaluateFormula(data[cellRef].value, getData, { r, c }, new Set())
                }
            }
        }
        setEvaluatedData(newData)
    }, [data])

    // Sync edit value when selection changes
    useEffect(() => {
        if (activeCell && !isEditing) {
            const val = data[`${activeCell.r},${activeCell.c}`]?.value || ""
            setEditValue(val)
        }
    }, [activeCell, data, isEditing])

    // ---- Cell Interactions ----

    const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (isEditing) commitEdit()

        setIsEditing(false)
        setIsDragging(true)

        if (e.shiftKey && activeCell) {
            setSelectedRange({ start: activeCell, end: { r, c } })
        } else {
            setActiveCell({ r, c })
            setSelectedRange({ start: { r, c }, end: { r, c } })
        }
    }

    const handleCellMouseEnter = (r: number, c: number) => {
        if (isDragging && selectedRange) {
            setSelectedRange({ ...selectedRange, end: { r, c } })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleDoubleClick = (r: number, c: number) => {
        setActiveCell({ r, c })
        setSelectedRange({ start: { r, c }, end: { r, c } })
        setIsEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    // ---- Global Document Event Listeners ----
    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [])

    // ---- Keyboard Navigation ----

    const commitEdit = () => {
        if (activeCell) {
            setCell(activeCell.r, activeCell.c, editValue)
            setIsEditing(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isEditing) {
            if (e.key === 'Enter') {
                e.preventDefault()
                commitEdit()
                // Move down
                const nextRow = Math.min(ROWS - 1, activeCell!.r + 1)
                setActiveCell({ r: nextRow, c: activeCell!.c })
                setSelectedRange({ start: { r: nextRow, c: activeCell!.c }, end: { r: nextRow, c: activeCell!.c } })
            }
            return
        }

        if (!activeCell) return

        if (e.key === 'ArrowUp') {
            e.preventDefault()
            const nr = Math.max(0, activeCell.r - 1)
            setActiveCell({ ...activeCell, r: nr })
            setSelectedRange({ start: { r: nr, c: activeCell.c }, end: { r: nr, c: activeCell.c } })
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            const nr = Math.min(ROWS - 1, activeCell.r + 1)
            setActiveCell({ ...activeCell, r: nr })
            setSelectedRange({ start: { r: nr, c: activeCell.c }, end: { r: nr, c: activeCell.c } })
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            const nc = Math.max(0, activeCell.c - 1)
            setActiveCell({ ...activeCell, c: nc })
            setSelectedRange({ start: { r: activeCell.r, c: nc }, end: { r: activeCell.r, c: nc } })
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            const nc = Math.min(COLS - 1, activeCell.c + 1)
            setActiveCell({ ...activeCell, c: nc })
            setSelectedRange({ start: { r: activeCell.r, c: nc }, end: { r: activeCell.r, c: nc } })
        } else if (e.key === 'Enter') {
            e.preventDefault()
            setIsEditing(true)
            setTimeout(() => inputRef.current?.focus(), 0)
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            if (selectionBounds) {
                for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++) {
                    for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                        setCell(r, c, "")
                    }
                }
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Start typing overwrites cell
            setIsEditing(true)
            setEditValue(e.key)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value)
        if (activeCell) {
            setCell(activeCell.r, activeCell.c, e.target.value)
        }
    }

    // A4 width roughly 1000px, but Sheets uses 100% width
    return (
        <div
            className="w-full h-full flex flex-col bg-white dark:bg-[#1f1f1f] text-[#202124] dark:text-[#e8eaed] outline-none font-sans text-sm select-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {/* Command Ribbon (Google Sheets Style) */}
            <div className="flex border-b border-[#e3e3e3] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] flex-col shrink-0">
                <div className="flex items-center px-4 py-2 gap-4">
                    <div className="flex flex-col">
                        <div className="text-[18px] text-[#202124] dark:text-[#e8eaed] font-medium leading-[24px]">Untitled Spreadsheet</div>
                        <div className="flex gap-4 text-[13px] text-[#444746] dark:text-[#9aa0a6] mt-0.5">
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">File</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Edit</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">View</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Insert</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Format</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Data</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Tools</span>
                            <span className="hover:bg-[#f1f3f4] dark:hover:bg-[#303134] px-1.5 py-0.5 rounded cursor-pointer">Extensions</span>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-3 py-1.5 bg-[#edf2fa] dark:bg-[#2d2e30] rounded-full mx-4 my-2 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] overflow-x-auto">
                    <button className="p-1.5 px-2 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors" title="Undo"><Undo className="w-4 h-4" /></button>
                    <button className="p-1.5 px-2 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors" title="Redo"><Redo className="w-4 h-4" /></button>

                    <div className="w-px h-5 bg-[#c7c7c7] dark:bg-[#5f6368] mx-1 shrink-0" />

                    <span className="px-2 font-medium text-[13px] text-[#444746] dark:text-[#e3e3e3]">100%</span>

                    <div className="w-px h-5 bg-[#c7c7c7] dark:bg-[#5f6368] mx-1 shrink-0" />

                    <span className="px-3 text-[13px] text-[#444746] dark:text-[#e3e3e3] border border-[#c7c7c7] dark:border-[#5f6368] rounded bg-white dark:bg-[#202124] flex items-center cursor-pointer h-7 w-20">Arial</span>
                    <div className="flex items-center border border-[#c7c7c7] dark:border-[#5f6368] rounded h-7 ml-1 bg-white dark:bg-[#202124]">
                        <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] border-r border-[#c7c7c7] dark:border-[#5f6368] cursor-pointer hover:bg-gray-50">-</span>
                        <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] w-8 text-center">10</span>
                        <span className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] border-l border-[#c7c7c7] dark:border-[#5f6368] cursor-pointer hover:bg-gray-50">+</span>
                    </div>

                    <div className="w-px h-5 bg-[#c7c7c7] dark:bg-[#5f6368] mx-2 shrink-0" />

                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] font-serif font-bold transition-colors">B</button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] font-serif italic transition-colors">I</button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] line-through transition-colors"><Strikethrough className="w-[18px] h-[18px]" /></button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] transition-colors"><Type className="w-[18px] h-[18px]" /></button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] transition-colors"><PaintBucket className="w-[18px] h-[18px]" /></button>

                    <div className="w-px h-5 bg-[#c7c7c7] dark:bg-[#5f6368] mx-2 shrink-0" />

                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] transition-colors"><AlignLeft className="w-[18px] h-[18px]" /></button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] transition-colors"><AlignCenter className="w-[18px] h-[18px]" /></button>
                    <button className="p-1.5 w-8 rounded flex items-center justify-center hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] transition-colors"><AlignRight className="w-[18px] h-[18px]" /></button>

                    <div className="ml-auto flex items-center pr-2 gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 rounded font-medium text-[13px] shadow-sm transition-colors border border-purple-200 dark:border-purple-800">
                            <Sparkles className="w-3.5 h-3.5" /> AI Tools
                        </button>
                    </div>
                </div>
            </div>

            {/* Formula Bar */}
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#e3e3e3] dark:border-[#3c4043] bg-white dark:bg-[#1a1a1a] shrink-0 h-9">
                <div className="w-12 font-medium text-[13px] text-[#202124] dark:text-[#e8eaed] text-center shrink-0 tracking-wide select-text">
                    {activeCell ? `${indexToCol(activeCell.c)}${activeCell.r + 1}` : ''}
                </div>
                <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] shrink-0" />
                <div className="text-[#5f6368] dark:text-[#9aa0a6] font-serif italic font-bold shrink-0 text-lg px-2 opacity-50 select-none">fx</div>
                <input
                    ref={formulaBarRef}
                    className="flex-1 outline-none text-[13px] bg-transparent font-mono text-[#202124] dark:text-[#e8eaed]"
                    value={activeCell ? editValue : ''}
                    onChange={handleFormulaChange}
                    onFocus={() => {
                        if (activeCell) setIsEditing(true);
                    }}
                    placeholder={activeCell ? "" : ""}
                    disabled={!activeCell}
                />
            </div>

            {/* Grid Area - Note: Virtualization highly recommended here for production (>1000 rows) */}
            <div className="relative flex-1 overflow-auto bg-white dark:bg-[#1f1f1f] custom-scrollbar will-change-transform">
                {/* Header Row (A, B, C...) */}
                <div className="flex sticky top-0 z-30 h-[25px] select-none bg-white dark:bg-[#1f1f1f]">
                    <div className="w-[46px] h-full bg-[#f8f9fa] dark:bg-[#202124] border-r border-b border-[#c0c0c0] dark:border-[#5f6368] shrink-0 sticky left-0 z-40 relative">
                        {/* Status corner indicator */}
                        <div className={cn("absolute top-1 left-1 h-1.5 w-1.5 rounded-full shadow-sm", isConnected ? "bg-[#1e8e3e]" : "bg-[#d93025] animate-pulse")} />
                    </div>
                    {Array.from({ length: COLS }).map((_, c) => {
                        const inSelection = selectionBounds && c >= selectionBounds.minC && c <= selectionBounds.maxC;
                        return (
                            <div
                                key={`header-col-${c}`}
                                className={cn(
                                    "w-[100px] h-full flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] text-[#444746] dark:text-[#9aa0a6] shrink-0 font-medium transition-colors",
                                    inSelection ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]" : "bg-[#f8f9fa] dark:bg-[#202124]"
                                )}
                            >
                                {indexToCol(c)}
                            </div>
                        )
                    })}
                </div>

                {/* Rows containing cells */}
                <div className="flex flex-col select-none">
                    {Array.from({ length: ROWS }).map((_, r) => {
                        const inSelectionRow = selectionBounds && r >= selectionBounds.minR && r <= selectionBounds.maxR;

                        return (
                            <div key={`row-${r}`} className="flex h-[21px]">
                                {/* Row Header (1, 2, 3...) */}
                                <div className={cn(
                                    "w-[46px] h-full flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] text-[#444746] dark:text-[#9aa0a6] shrink-0 sticky left-0 z-20 transition-colors",
                                    inSelectionRow ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]" : "bg-[#f8f9fa] dark:bg-[#202124]"
                                )}>
                                    {r + 1}
                                </div>

                                {/* Cells in Row */}
                                {Array.from({ length: COLS }).map((_, c) => {
                                    const isActive = activeCell?.r === r && activeCell?.c === c
                                    const inSelectionRect = selectionBounds &&
                                        r >= selectionBounds.minR && r <= selectionBounds.maxR &&
                                        c >= selectionBounds.minC && c <= selectionBounds.maxC;

                                    const isBottomRight = selectionBounds &&
                                        r === selectionBounds.maxR && c === selectionBounds.maxC;

                                    // Value rendering
                                    const rawValue = data[`${r},${c}`]?.value || ""
                                    const displayValue = evaluatedData[`${r},${c}`] || rawValue
                                    const isError = displayValue.startsWith("#") && displayValue.endsWith("!") || displayValue === "#NAME?"
                                    const isNumber = !isError && !isNaN(Number(displayValue)) && displayValue.trim() !== ""

                                    return (
                                        <div
                                            key={`cell-${r}-${c}`}
                                            className={cn(
                                                "w-[100px] h-full border-r border-b border-[#e3e3e3] dark:border-[#5f6368] text-[13px] px-1 flex items-center outline-none relative bg-white dark:bg-[#1a1a1a]",
                                                (inSelectionRect && !isActive) ? "bg-[#e8f0fe]/80 dark:bg-[#3c4043]/50" : ""
                                            )}
                                            onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                                            onMouseEnter={() => handleCellMouseEnter(r, c)}
                                            onDoubleClick={() => handleDoubleClick(r, c)}
                                        >
                                            {/* Blue outline for selection */}
                                            {inSelectionRect && (
                                                <>
                                                    {r === selectionBounds.minR && <div className="absolute top-0 left-0 right-[-1px] h-[2px] bg-[#1a73e8] z-10" />}
                                                    {r === selectionBounds.maxR && <div className="absolute bottom-[-1px] left-0 right-[-1px] h-[2px] bg-[#1a73e8] z-10" />}
                                                    {c === selectionBounds.minC && <div className="absolute top-0 bottom-[-1px] left-0 w-[2px] bg-[#1a73e8] z-10" />}
                                                    {c === selectionBounds.maxC && <div className="absolute top-0 bottom-[-1px] right-[-1px] w-[2px] bg-[#1a73e8] z-10" />}
                                                </>
                                            )}

                                            {/* Active Cell thick border */}
                                            {isActive && (
                                                <div className="absolute inset-[-1px] border-2 border-[#1a73e8] z-20 pointer-events-none" />
                                            )}

                                            {isActive && isEditing ? (
                                                <input
                                                    ref={inputRef}
                                                    className="w-full h-full border-none outline-none bg-white dark:bg-[#2d2e30] px-0.5 m-0 text-[13px] z-30 relative text-[#202124] dark:text-white"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    spellCheck={false}
                                                />
                                            ) : (
                                                <span className={cn(
                                                    "truncate w-full select-text",
                                                    isNumber ? "text-right" : "",
                                                    isError ? "text-[#d93025] dark:text-[#f28b82] font-semibold text-center" : "",
                                                    displayValue === "" ? "opacity-0" : "" // Help rendering speeds
                                                )}
                                                    title={isError ? "Error in formula" : rawValue}>
                                                    {displayValue}
                                                </span>
                                            )}

                                            {/* Drag to fill handle */}
                                            {isBottomRight && !isEditing && (
                                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#1a73e8] border border-white dark:border-[#1a1a1a] rounded-sm cursor-crosshair z-30" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom Tabs (Google Sheets style) */}
            <div className="flex items-center h-10 border-t border-[#e3e3e3] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] px-1 shrink-0 z-20 shadow-[0_-1px_3px_0_rgba(0,0,0,0.05)]">
                <button className="p-2 hover:bg-[#e8eaed] dark:hover:bg-[#303134] rounded-full text-[#5f6368] dark:text-[#9aa0a6] mx-1 transition-colors">
                    <Plus className="w-5 h-5" />
                </button>
                <div className="px-5 py-2.5 bg-white dark:bg-[#1f1f1f] text-[#1a73e8] dark:text-[#8ab4f8] text-[13px] font-medium border-x border-t border-[#e3e3e3] dark:border-[#3c4043] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] h-10 flex items-center mb-0 mt-auto rounded-t-sm">
                    Sheet1
                </div>
                <div className="px-5 py-2.5 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] dark:hover:bg-[#303134] cursor-pointer text-[13px] font-medium transition-colors h-10 flex items-center mb-0 mt-auto">
                    Sheet2
                </div>

                <div className="ml-auto px-4 flex items-center text-[12px] text-[#5f6368] dark:text-[#80868b]">
                    {selectionBounds && (selectionBounds.maxR !== selectionBounds.minR || selectionBounds.maxC !== selectionBounds.minC) && (
                        <span>
                            Selected: {indexToCol(selectionBounds.minC)}{selectionBounds.minR + 1}:{indexToCol(selectionBounds.maxC)}{selectionBounds.maxR + 1}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
