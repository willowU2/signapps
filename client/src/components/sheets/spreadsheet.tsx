"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useSpreadsheet, CellStyle } from "./use-spreadsheet"
import { evaluateFormula, indexToCol, colToIndex } from "@/lib/sheets/formula"
import {
    AlignLeft, AlignCenter, AlignRight, Sparkles,
    PaintBucket, Plus, Undo, Redo, Type, Strikethrough,
    Printer, Paintbrush, Percent, Grid, Maximize, ChevronDown, Minus,
    AlignVerticalJustifyCenter, WrapText, RotateCw, MessageSquare, BarChart2, Filter, Sigma,
    Link, X
} from "lucide-react"
import { toast } from "sonner"

const ROWS = 200
const COLS = 50

const PRESET_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
]

const FONTS = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact']

const ALIGN_CYCLE: ('left' | 'center' | 'right')[] = ['left', 'center', 'right']
const VALIGN_CYCLE: ('top' | 'middle' | 'bottom')[] = ['top', 'middle', 'bottom']

function formatDisplayValue(value: string, style?: CellStyle): string {
    if (!style?.numberFormat || value === '' || isNaN(Number(value))) return value
    const num = Number(value)
    const dec = style.decimals ?? 2
    switch (style.numberFormat) {
        case 'currency': return `${num.toFixed(dec)} \u20AC`
        case 'percent': return `${(num * 100).toFixed(dec)}%`
        case 'number': return num.toFixed(dec)
        default: return value
    }
}

export function Spreadsheet() {
    const { data, setCell, setCellStyle, isConnected, undo, redo, canUndo, canRedo } = useSpreadsheet("sheet-demo")

    // Selection
    const [selectedRange, setSelectedRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null)
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Editing
    const [editValue, setEditValue] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const formulaBarRef = useRef<HTMLInputElement>(null)

    // Paint format mode
    const [paintFormat, setPaintFormat] = useState<CellStyle | null>(null)

    // Popover states
    const [showTextColor, setShowTextColor] = useState(false)
    const [showFillColor, setShowFillColor] = useState(false)
    const [showFontPicker, setShowFontPicker] = useState(false)
    const [showFunctionHelper, setShowFunctionHelper] = useState(false)

    // Formula cache
    const [evaluatedData, setEvaluatedData] = useState<Record<string, string>>({})

    const selectionBounds = useMemo(() => {
        if (!selectedRange) return null
        return {
            minR: Math.min(selectedRange.start.r, selectedRange.end.r),
            maxR: Math.max(selectedRange.start.r, selectedRange.end.r),
            minC: Math.min(selectedRange.start.c, selectedRange.end.c),
            maxC: Math.max(selectedRange.start.c, selectedRange.end.c)
        }
    }, [selectedRange])

    const activeCellStyle: CellStyle = useMemo(() => {
        if (!activeCell) return {}
        return data[`${activeCell.r},${activeCell.c}`]?.style || {}
    }, [activeCell, data])

    // Recalculate formulas
    useEffect(() => {
        const newData: Record<string, string> = {}
        const getData = (r: number, c: number) => data[`${r},${c}`]?.value || ""
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

    // Sync edit value
    useEffect(() => {
        if (activeCell && !isEditing) {
            setEditValue(data[`${activeCell.r},${activeCell.c}`]?.value || "")
        }
    }, [activeCell, data, isEditing])

    // Close popovers on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-popover]')) {
                setShowTextColor(false)
                setShowFillColor(false)
                setShowFontPicker(false)
                setShowFunctionHelper(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // ---- Formatting helpers ----

    const applyToSelection = useCallback((stylePatch: Partial<CellStyle>) => {
        if (!selectionBounds) return
        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++) {
            for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                setCellStyle(r, c, stylePatch)
            }
        }
    }, [selectionBounds, setCellStyle])

    const toggleBoolFormat = useCallback((prop: 'bold' | 'italic' | 'strikethrough' | 'wrap') => {
        const current = activeCellStyle[prop]
        applyToSelection({ [prop]: !current })
    }, [activeCellStyle, applyToSelection])

    const cycleAlign = useCallback(() => {
        const current = activeCellStyle.align || 'left'
        const idx = ALIGN_CYCLE.indexOf(current)
        applyToSelection({ align: ALIGN_CYCLE[(idx + 1) % 3] })
    }, [activeCellStyle, applyToSelection])

    const cycleVerticalAlign = useCallback(() => {
        const current = activeCellStyle.verticalAlign || 'middle'
        const idx = VALIGN_CYCLE.indexOf(current)
        applyToSelection({ verticalAlign: VALIGN_CYCLE[(idx + 1) % 3] })
    }, [activeCellStyle, applyToSelection])

    const changeFontSize = useCallback((delta: number) => {
        const current = activeCellStyle.fontSize || 10
        const next = Math.max(6, Math.min(72, current + delta))
        applyToSelection({ fontSize: next })
    }, [activeCellStyle, applyToSelection])

    const changeDecimals = useCallback((delta: number) => {
        const current = activeCellStyle.decimals ?? 2
        const next = Math.max(0, Math.min(10, current + delta))
        applyToSelection({ decimals: next, numberFormat: activeCellStyle.numberFormat || 'number' })
    }, [activeCellStyle, applyToSelection])

    // ---- Cell interactions ----

    const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (isEditing) commitEdit()
        setIsEditing(false)
        setIsDragging(true)

        // Paint format mode
        if (paintFormat) {
            setCellStyle(r, c, paintFormat)
            setPaintFormat(null)
            return
        }

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

    const handleMouseUp = () => setIsDragging(false)

    const handleDoubleClick = (r: number, c: number) => {
        setActiveCell({ r, c })
        setSelectedRange({ start: { r, c }, end: { r, c } })
        setIsEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [])

    const commitEdit = () => {
        if (activeCell) {
            setCell(activeCell.r, activeCell.c, editValue)
            setIsEditing(false)
        }
    }

    const moveCell = (dr: number, dc: number) => {
        if (!activeCell) return
        const nr = Math.max(0, Math.min(ROWS - 1, activeCell.r + dr))
        const nc = Math.max(0, Math.min(COLS - 1, activeCell.c + dc))
        setActiveCell({ r: nr, c: nc })
        setSelectedRange({ start: { r: nr, c: nc }, end: { r: nr, c: nc } })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl shortcuts
        if ((e.ctrlKey || e.metaKey) && !isEditing) {
            if (e.key === 'z') { e.preventDefault(); undo(); return }
            if (e.key === 'y') { e.preventDefault(); redo(); return }
            if (e.key === 'b') { e.preventDefault(); toggleBoolFormat('bold'); return }
            if (e.key === 'i') { e.preventDefault(); toggleBoolFormat('italic'); return }
            if (e.key === 'p') { e.preventDefault(); window.print(); return }
        }

        if (isEditing) {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); moveCell(1, 0) }
            if (e.key === 'Tab') { e.preventDefault(); commitEdit(); moveCell(0, e.shiftKey ? -1 : 1) }
            if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false); setEditValue(data[`${activeCell!.r},${activeCell!.c}`]?.value || "") }
            return
        }

        if (!activeCell) return

        if (e.key === 'ArrowUp') { e.preventDefault(); moveCell(-1, 0) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveCell(1, 0) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCell(0, -1) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); moveCell(0, 1) }
        else if (e.key === 'Tab') { e.preventDefault(); moveCell(0, e.shiftKey ? -1 : 1) }
        else if (e.key === 'Enter') {
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
            setIsEditing(true)
            setEditValue(e.key)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value)
        if (activeCell) setCell(activeCell.r, activeCell.c, e.target.value)
    }

    // Toolbar button component
    const TBtn = ({ onClick, active, title, children, className }: {
        onClick: () => void, active?: boolean, title: string, children: React.ReactNode, className?: string
    }) => (
        <button
            className={cn(
                "p-1 px-1.5 rounded flex items-center justify-center transition-colors",
                active
                    ? "bg-[#d3e3fd] dark:bg-[#004a77] text-[#1a73e8] dark:text-[#8ab4f8]"
                    : "hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3]",
                className
            )}
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
        >
            {children}
        </button>
    )

    const Sep = () => <div className="w-px h-5 bg-[#c7c7c7] dark:bg-[#5f6368] mx-1 shrink-0" />

    return (
        <div
            className={cn(
                "w-full h-full flex flex-col bg-white dark:bg-[#1f1f1f] text-[#202124] dark:text-[#e8eaed] outline-none font-sans text-sm select-none",
                paintFormat && "cursor-cell"
            )}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {/* Toolbar */}
            <div className="border-b border-[#e3e3e3] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] shrink-0 px-4 py-2">
                <div className="flex items-center gap-0.5 px-3 py-1.5 bg-[#edf2fa] dark:bg-[#2d2e30] rounded-full shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] overflow-x-auto">
                    {/* Undo / Redo / Print / Paint Format */}
                    <TBtn onClick={undo} title="Annuler (Ctrl+Z)" active={false}><Undo className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={redo} title="R\u00E9tablir (Ctrl+Y)" active={false}><Redo className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => window.print()} title="Imprimer (Ctrl+P)"><Printer className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn
                        onClick={() => {
                            if (paintFormat) { setPaintFormat(null) }
                            else if (activeCell) { setPaintFormat({ ...activeCellStyle }); toast.info("Cliquez sur une cellule pour appliquer le format") }
                        }}
                        active={!!paintFormat}
                        title="Reproduire la mise en forme"
                    >
                        <Paintbrush className="w-[18px] h-[18px]" />
                    </TBtn>

                    <Sep />

                    {/* Number Formats */}
                    <TBtn
                        onClick={() => applyToSelection({ numberFormat: activeCellStyle.numberFormat === 'currency' ? 'auto' : 'currency' })}
                        active={activeCellStyle.numberFormat === 'currency'}
                        title="Format mon\u00E9taire"
                        className="font-serif font-medium"
                    >{"\u20AC"}</TBtn>
                    <TBtn
                        onClick={() => applyToSelection({ numberFormat: activeCellStyle.numberFormat === 'percent' ? 'auto' : 'percent' })}
                        active={activeCellStyle.numberFormat === 'percent'}
                        title="Format pourcentage"
                    ><Percent className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => changeDecimals(-1)} title="R\u00E9duire les d\u00E9cimales" className="tracking-tighter font-semibold text-xs">{".0\u2190"}</TBtn>
                    <TBtn onClick={() => changeDecimals(1)} title="Augmenter les d\u00E9cimales" className="tracking-tighter font-semibold text-xs">{".00\u2192"}</TBtn>

                    <Sep />

                    {/* Font Picker */}
                    <div className="relative" data-popover>
                        <button
                            className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] border border-transparent hover:border-[#c7c7c7] hover:bg-white rounded flex items-center cursor-pointer h-7 w-24 justify-between mx-0.5"
                            onClick={() => setShowFontPicker(!showFontPicker)}
                        >
                            <span className="truncate">{activeCellStyle.fontFamily || 'Arial'}</span>
                            <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
                        </button>
                        {showFontPicker && (
                            <div className="absolute top-8 left-0 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 w-48 max-h-48 overflow-y-auto py-1">
                                {FONTS.map(font => (
                                    <button
                                        key={font}
                                        className={cn(
                                            "w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]",
                                            activeCellStyle.fontFamily === font && "bg-[#e8f0fe] dark:bg-[#004a77]"
                                        )}
                                        style={{ fontFamily: font }}
                                        onClick={() => { applyToSelection({ fontFamily: font }); setShowFontPicker(false) }}
                                    >
                                        {font}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center border border-transparent hover:border-[#c7c7c7] rounded h-7 ml-0.5 bg-transparent hover:bg-white transition-colors">
                        <button className="px-1.5 text-[13px] text-[#444746] cursor-pointer hover:bg-gray-100 flex items-center justify-center h-full" onClick={() => changeFontSize(-1)}><Minus className="w-[14px] h-[14px]" /></button>
                        <input
                            className="px-1 text-[13px] text-[#444746] dark:text-[#e3e3e3] w-8 text-center bg-transparent outline-none"
                            value={activeCellStyle.fontSize || 10}
                            onChange={(e) => {
                                const v = parseInt(e.target.value)
                                if (!isNaN(v) && v >= 6 && v <= 72) applyToSelection({ fontSize: v })
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                        <button className="px-1.5 text-[13px] text-[#444746] cursor-pointer hover:bg-gray-100 flex items-center justify-center h-full" onClick={() => changeFontSize(1)}><Plus className="w-[14px] h-[14px]" /></button>
                    </div>

                    <Sep />

                    {/* Bold / Italic / Strikethrough */}
                    <TBtn onClick={() => toggleBoolFormat('bold')} active={activeCellStyle.bold} title="Gras (Ctrl+B)" className="font-serif font-bold">B</TBtn>
                    <TBtn onClick={() => toggleBoolFormat('italic')} active={activeCellStyle.italic} title="Italique (Ctrl+I)" className="font-serif italic">I</TBtn>
                    <TBtn onClick={() => toggleBoolFormat('strikethrough')} active={activeCellStyle.strikethrough} title="Barr\u00E9"><Strikethrough className="w-[18px] h-[18px]" /></TBtn>

                    {/* Text Color */}
                    <div className="relative" data-popover>
                        <button
                            className="p-1 px-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors relative"
                            title="Couleur du texte"
                            onClick={() => { setShowTextColor(!showTextColor); setShowFillColor(false) }}
                        >
                            <Type className="w-[18px] h-[18px]" />
                            <div className="absolute bottom-0.5 left-1.5 right-1.5 h-[3px] rounded-sm" style={{ backgroundColor: activeCellStyle.textColor || '#000000' }} />
                        </button>
                        {showTextColor && (
                            <div className="absolute top-8 left-0 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 p-2 w-[220px]">
                                <div className="grid grid-cols-10 gap-1">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-125 transition-transform"
                                            style={{ backgroundColor: color }}
                                            onClick={() => { applyToSelection({ textColor: color }); setShowTextColor(false) }}
                                        />
                                    ))}
                                </div>
                                <button
                                    className="mt-2 text-xs text-[#1a73e8] hover:underline w-full text-left"
                                    onClick={() => { applyToSelection({ textColor: undefined }); setShowTextColor(false) }}
                                >{"R\u00E9initialiser"}</button>
                            </div>
                        )}
                    </div>

                    {/* Fill Color */}
                    <div className="relative" data-popover>
                        <button
                            className="p-1 px-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors relative"
                            title="Couleur de remplissage"
                            onClick={() => { setShowFillColor(!showFillColor); setShowTextColor(false) }}
                        >
                            <PaintBucket className="w-[18px] h-[18px]" />
                            <div className="absolute bottom-0.5 left-1.5 right-1.5 h-[3px] rounded-sm" style={{ backgroundColor: activeCellStyle.fillColor || 'transparent' }} />
                        </button>
                        {showFillColor && (
                            <div className="absolute top-8 left-0 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 p-2 w-[220px]">
                                <div className="grid grid-cols-10 gap-1">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-125 transition-transform"
                                            style={{ backgroundColor: color }}
                                            onClick={() => { applyToSelection({ fillColor: color }); setShowFillColor(false) }}
                                        />
                                    ))}
                                </div>
                                <button
                                    className="mt-2 text-xs text-[#1a73e8] hover:underline w-full text-left"
                                    onClick={() => { applyToSelection({ fillColor: undefined }); setShowFillColor(false) }}
                                >Aucun remplissage</button>
                            </div>
                        )}
                    </div>

                    <Sep />

                    {/* Borders / Merge */}
                    <TBtn onClick={() => toast.info("Bordures: utilisez le format de cellule pour configurer les bordures")} title="Bordures"><Grid className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toast.info("Fusion de cellules: s\u00E9lectionnez une plage et cliquez \u00E0 nouveau")} title="Fusionner les cellules"><Maximize className="w-[18px] h-[18px]" /></TBtn>

                    <Sep />

                    {/* Alignment */}
                    <TBtn onClick={cycleAlign} active={false} title={`Alignement: ${activeCellStyle.align || 'left'}`}>
                        {activeCellStyle.align === 'center' ? <AlignCenter className="w-[18px] h-[18px]" /> :
                         activeCellStyle.align === 'right' ? <AlignRight className="w-[18px] h-[18px]" /> :
                         <AlignLeft className="w-[18px] h-[18px]" />}
                    </TBtn>
                    <TBtn onClick={cycleVerticalAlign} title={`Alignement vertical: ${activeCellStyle.verticalAlign || 'middle'}`}><AlignVerticalJustifyCenter className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toggleBoolFormat('wrap')} active={activeCellStyle.wrap} title="Retour \u00E0 la ligne"><WrapText className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toast.info("Rotation du texte: fonctionnalit\u00E9 \u00E0 venir")} title="Rotation du texte"><RotateCw className="w-[18px] h-[18px]" /></TBtn>

                    <Sep />

                    {/* Inserts */}
                    <TBtn onClick={() => {
                        const url = prompt("Entrez l'URL du lien:")
                        if (url && activeCell) {
                            setCell(activeCell.r, activeCell.c, url)
                            toast.success("Lien ins\u00E9r\u00E9")
                        }
                    }} title="Ins\u00E9rer un lien"><Link className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => {
                        const comment = prompt("Entrez votre commentaire:")
                        if (comment) toast.success(`Commentaire ajout\u00E9: "${comment}"`)
                    }} title="Ins\u00E9rer un commentaire"><MessageSquare className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toast.info("Graphiques: fonctionnalit\u00E9 \u00E0 venir")} title="Ins\u00E9rer un graphique"><BarChart2 className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toast.info("Filtre activ\u00E9 sur la s\u00E9lection")} title="Cr\u00E9er un filtre"><Filter className="w-[18px] h-[18px]" /></TBtn>

                    {/* Functions helper */}
                    <div className="relative" data-popover>
                        <TBtn onClick={() => setShowFunctionHelper(!showFunctionHelper)} title="Fonctions">
                            <Sigma className="w-[18px] h-[18px]" />
                        </TBtn>
                        {showFunctionHelper && (
                            <div className="absolute top-8 right-0 bg-white dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 p-3 w-56">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-[13px]">Fonctions</span>
                                    <button onClick={() => setShowFunctionHelper(false)}><X className="w-4 h-4" /></button>
                                </div>
                                {[
                                    { fn: '=SUM(A1:A10)', desc: 'Somme' },
                                    { fn: '=AVERAGE(A1:A10)', desc: 'Moyenne' },
                                    { fn: '=COUNT(A1:A10)', desc: 'Nombre' },
                                    { fn: '=MAX(A1:A10)', desc: 'Maximum' },
                                    { fn: '=MIN(A1:A10)', desc: 'Minimum' },
                                ].map(({ fn, desc }) => (
                                    <button
                                        key={fn}
                                        className="w-full text-left px-2 py-1 text-[12px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded"
                                        onClick={() => {
                                            if (activeCell) {
                                                setEditValue(fn)
                                                setCell(activeCell.r, activeCell.c, fn)
                                                setIsEditing(true)
                                                setShowFunctionHelper(false)
                                                setTimeout(() => formulaBarRef.current?.focus(), 0)
                                            }
                                        }}
                                    >
                                        <span className="font-mono text-[#1a73e8]">{fn}</span>
                                        <span className="ml-2 text-[#5f6368]">{"\u2014"} {desc}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ml-auto flex items-center pr-1 shrink-0">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 rounded font-medium text-[13px] shadow-sm transition-colors border border-purple-200 dark:border-purple-800">
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
                    onFocus={() => { if (activeCell) setIsEditing(true) }}
                    disabled={!activeCell}
                />
            </div>

            {/* Grid */}
            <div className="relative flex-1 overflow-auto bg-white dark:bg-[#1f1f1f] custom-scrollbar will-change-transform">
                {/* Column headers */}
                <div className="flex sticky top-0 z-30 select-none bg-white dark:bg-[#1f1f1f]">
                    <div className="w-[46px] min-w-[46px] max-w-[46px] h-[25px] bg-[#f8f9fa] dark:bg-[#202124] border-r border-b border-[#c0c0c0] dark:border-[#5f6368] shrink-0 sticky left-0 z-40 relative">
                        <div className={cn("absolute top-1 left-1 h-1.5 w-1.5 rounded-full shadow-sm", isConnected ? "bg-[#1e8e3e]" : "bg-[#d93025] animate-pulse")} />
                    </div>
                    {Array.from({ length: COLS }).map((_, c) => {
                        const inSel = selectionBounds && c >= selectionBounds.minC && c <= selectionBounds.maxC
                        return (
                            <div
                                key={c}
                                className={cn(
                                    "w-[100px] min-w-[100px] max-w-[100px] h-[25px] flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] font-medium shrink-0 transition-colors",
                                    inSel ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]" : "bg-[#f8f9fa] dark:bg-[#202124] text-[#444746] dark:text-[#9aa0a6]"
                                )}
                            >
                                {indexToCol(c)}
                            </div>
                        )
                    })}
                </div>

                {/* Rows */}
                <div className="flex flex-col select-none">
                    {Array.from({ length: ROWS }).map((_, r) => {
                        const inSelRow = selectionBounds && r >= selectionBounds.minR && r <= selectionBounds.maxR
                        return (
                            <div key={r} className="flex" style={{ height: 21 }}>
                                {/* Row header */}
                                <div className={cn(
                                    "w-[46px] min-w-[46px] max-w-[46px] flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] shrink-0 sticky left-0 z-20 transition-colors",
                                    inSelRow ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8]" : "bg-[#f8f9fa] dark:bg-[#202124] text-[#444746] dark:text-[#9aa0a6]"
                                )} style={{ height: 21 }}>
                                    {r + 1}
                                </div>

                                {/* Cells */}
                                {Array.from({ length: COLS }).map((_, c) => {
                                    const isActive = activeCell?.r === r && activeCell?.c === c
                                    const inRect = selectionBounds &&
                                        r >= selectionBounds.minR && r <= selectionBounds.maxR &&
                                        c >= selectionBounds.minC && c <= selectionBounds.maxC
                                    const isBottomRight = selectionBounds && r === selectionBounds.maxR && c === selectionBounds.maxC

                                    const cellData = data[`${r},${c}`]
                                    const rawValue = cellData?.value || ""
                                    const evaluated = evaluatedData[`${r},${c}`] || rawValue
                                    const style = cellData?.style
                                    const displayValue = formatDisplayValue(evaluated, style)
                                    const isError = (displayValue.startsWith("#") && displayValue.endsWith("!")) || displayValue === "#NAME?"
                                    const isNumber = !isError && !isNaN(Number(evaluated)) && evaluated.trim() !== ""

                                    const cellStyle: React.CSSProperties = {
                                        width: 100, minWidth: 100, maxWidth: 100, height: 21,
                                        fontWeight: style?.bold ? 700 : undefined,
                                        fontStyle: style?.italic ? 'italic' : undefined,
                                        textDecoration: style?.strikethrough ? 'line-through' : undefined,
                                        textAlign: style?.align || (isNumber ? 'right' : 'left'),
                                        fontFamily: style?.fontFamily,
                                        fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
                                        color: style?.textColor,
                                        backgroundColor: style?.fillColor || (inRect && !isActive ? 'rgba(66,133,244,0.08)' : undefined),
                                        whiteSpace: style?.wrap ? 'normal' : 'nowrap',
                                    }

                                    return (
                                        <div
                                            key={c}
                                            className={cn(
                                                "border-r border-b border-[#e3e3e3] dark:border-[#5f6368] text-[13px] px-1 flex items-center outline-none relative shrink-0",
                                                !style?.fillColor && !inRect && "bg-white dark:bg-[#1a1a1a]"
                                            )}
                                            style={cellStyle}
                                            onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                                            onMouseEnter={() => handleCellMouseEnter(r, c)}
                                            onDoubleClick={() => handleDoubleClick(r, c)}
                                        >
                                            {/* Selection border */}
                                            {inRect && (
                                                <>
                                                    {r === selectionBounds!.minR && <div className="absolute top-0 left-0 right-[-1px] h-[2px] bg-[#1a73e8] z-10" />}
                                                    {r === selectionBounds!.maxR && <div className="absolute bottom-[-1px] left-0 right-[-1px] h-[2px] bg-[#1a73e8] z-10" />}
                                                    {c === selectionBounds!.minC && <div className="absolute top-0 bottom-[-1px] left-0 w-[2px] bg-[#1a73e8] z-10" />}
                                                    {c === selectionBounds!.maxC && <div className="absolute top-0 bottom-[-1px] right-[-1px] w-[2px] bg-[#1a73e8] z-10" />}
                                                </>
                                            )}

                                            {isActive && <div className="absolute inset-[-1px] border-2 border-[#1a73e8] z-20 pointer-events-none" />}

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
                                                    isError && "text-[#d93025] dark:text-[#f28b82] font-semibold text-center",
                                                    displayValue === "" && "opacity-0"
                                                )} title={isError ? "Erreur dans la formule" : rawValue}>
                                                    {displayValue}
                                                </span>
                                            )}

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

            {/* Bottom Sheet Tabs */}
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
                            {indexToCol(selectionBounds.minC)}{selectionBounds.minR + 1}:{indexToCol(selectionBounds.maxC)}{selectionBounds.maxR + 1}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
