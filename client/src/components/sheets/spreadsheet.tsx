"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAutosave } from "@/hooks/use-autosave"
import { useSpreadsheet } from "./use-spreadsheet"
import { AiSheetsDialog } from "./ai-sheets-dialog"
import { PivotTableDialog } from "./pivot-table"
import { ChartDialog } from "./chart-dialog"
import { FloatingChart } from "./chart-panel"
import { MacroEditor } from "./macro-editor"
import { NamedRangesDialog, type NamedRange } from "./named-ranges-dialog"
import { PrintPreviewDialog } from "./print-preview-dialog"
import { AdvancedValidationDialog, type AdvancedValidation } from "./advanced-validation-dialog"
import { AdvancedCondFormatDialog, type AdvCondRule } from "./advanced-cond-format-dialog"
import { CellStyle, CellData, CellValidation, SelectionBounds, COLS, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, PRESET_COLORS, FONTS, TAB_COLORS, getEffectiveRows } from "./types"
import { evaluateFormula, indexToCol, colToIndex } from "@/lib/sheets/formula"
import { fetchAndParseDocument } from '@/lib/file-parsers'
import { sanitizeAllSheets } from '@/lib/sheets/sanitize-cells'
import { importXlsxToYjs } from '@/lib/sheets/import-xlsx'
import ExcelJS from 'exceljs'
import { EditorMenu, MenuGroup, MenuItem } from '@/components/editor/editor-menu'
import { GenericFeatureModal } from '@/components/editor/generic-feature-modal'
import { Toolbar, ToolbarButton, ToolbarDivider, ToolbarGroup } from '@/components/editor/toolbar'
import { storageApi } from '@/lib/api'
import {
    AlignLeft, AlignCenter, AlignRight, Sparkles,
    PaintBucket, Plus, Undo, Redo, Type, Strikethrough,
    Printer, Paintbrush, Percent, Maximize, ChevronDown, Minus,
    AlignVerticalJustifyCenter, WrapText, RotateCw, MessageSquare, BarChart2, Filter, Sigma,
    Link, X, Scissors, Copy, ClipboardPaste, ArrowUp, ArrowDown,
    Trash2, ChevronRight, Grid3X3, Download, Upload,
    BoxSelect, Square, Columns, Rows, Search, Replace, Snowflake,
    ChevronLeft, ChevronsRight, ChevronsLeft, Palette,
    ListChecks, ExternalLink, StretchHorizontal, Lock, Unlock, Hash,
    Table2, FileCode
} from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const ALIGN_CYCLE: ('left' | 'center' | 'right')[] = ['left', 'center', 'right']
const VALIGN_CYCLE: ('top' | 'middle' | 'bottom')[] = ['top', 'middle', 'bottom']
const VIRT_BUFFER = 8 // extra rows/cols rendered outside viewport

const ALL_FUNCTIONS = [
    { name: 'SUM', desc: 'Somme d\'une plage', syntax: 'SUM(plage)' },
    { name: 'AVERAGE', desc: 'Moyenne', syntax: 'AVERAGE(plage)' },
    { name: 'COUNT', desc: 'Nombre de valeurs numériques', syntax: 'COUNT(plage)' },
    { name: 'COUNTA', desc: 'Nombre de valeurs non vides', syntax: 'COUNTA(plage)' },
    { name: 'MAX', desc: 'Maximum', syntax: 'MAX(plage)' },
    { name: 'MIN', desc: 'Minimum', syntax: 'MIN(plage)' },
    { name: 'MEDIAN', desc: 'Moyenne', syntax: 'MEDIAN(plage)' },
    { name: 'STDEV', desc: 'Écart type', syntax: 'STDEV(plage)' },
    { name: 'IF', desc: 'Condition', syntax: 'IF(test, si_vrai, si_faux)' },
    { name: 'IFERROR', desc: 'Si erreur', syntax: 'IFERROR(valeur, si_erreur)' },
    { name: 'AND', desc: 'ET logique', syntax: 'AND(val1, val2, ...)' },
    { name: 'OR', desc: 'OU logique', syntax: 'OR(val1, val2, ...)' },
    { name: 'NOT', desc: 'NON logique', syntax: 'NOT(valeur)' },
    { name: 'VLOOKUP', desc: 'Recherche verticale', syntax: 'VLOOKUP(clé, plage, col, [approx])' },
    { name: 'HLOOKUP', desc: 'Recherche horizontale', syntax: 'HLOOKUP(clé, plage, ligne, [approx])' },
    { name: 'INDEX', desc: 'Valeur à position', syntax: 'INDEX(plage, ligne, col)' },
    { name: 'MATCH', desc: 'Position d\'une valeur', syntax: 'MATCH(clé, plage)' },
    { name: 'CONCATENATE', desc: 'Concaténer', syntax: 'CONCATENATE(texte1, texte2, ...)' },
    { name: 'ROUND', desc: 'Arrondir', syntax: 'ROUND(nombre, décimales)' },
    { name: 'ROUNDUP', desc: 'Arrondir au supérieur', syntax: 'ROUNDUP(nombre, décimales)' },
    { name: 'ROUNDDOWN', desc: 'Arrondir à l\'inférieur', syntax: 'ROUNDDOWN(nombre, décimales)' },
    { name: 'ABS', desc: 'Valeur absolue', syntax: 'ABS(nombre)' },
    { name: 'SQRT', desc: 'Racine carrée', syntax: 'SQRT(nombre)' },
    { name: 'POWER', desc: 'Puissance', syntax: 'POWER(base, exposant)' },
    { name: 'MOD', desc: 'Modulo', syntax: 'MOD(nombre, diviseur)' },
    { name: 'INT', desc: 'Entier', syntax: 'INT(nombre)' },
    { name: 'LEN', desc: 'Longueur', syntax: 'LEN(texte)' },
    { name: 'UPPER', desc: 'Majuscules', syntax: 'UPPER(texte)' },
    { name: 'LOWER', desc: 'Minuscules', syntax: 'LOWER(texte)' },
    { name: 'TRIM', desc: 'Supprimer espaces', syntax: 'TRIM(texte)' },
    { name: 'LEFT', desc: 'Caractères à gauche', syntax: 'LEFT(texte, nb)' },
    { name: 'RIGHT', desc: 'Caractères à droite', syntax: 'RIGHT(texte, nb)' },
    { name: 'MID', desc: 'Sous-chaîne', syntax: 'MID(texte, début, longueur)' },
    { name: 'SUBSTITUTE', desc: 'Remplacer texte', syntax: 'SUBSTITUTE(texte, ancien, nouveau)' },
    { name: 'FIND', desc: 'Trouver (sensible casse)', syntax: 'FIND(chercher, texte)' },
    { name: 'SEARCH', desc: 'Chercher (insensible casse)', syntax: 'SEARCH(chercher, texte)' },
    { name: 'PROPER', desc: 'Première lettre majuscule', syntax: 'PROPER(texte)' },
    { name: 'EXACT', desc: 'Comparaison exacte', syntax: 'EXACT(texte1, texte2)' },
    { name: 'TEXT', desc: 'Formater nombre en texte', syntax: 'TEXT(nombre, format)' },
    { name: 'VALUE', desc: 'Texte en nombre', syntax: 'VALUE(texte)' },
    { name: 'TODAY', desc: 'Date du jour', syntax: 'TODAY()' },
    { name: 'NOW', desc: 'Date et heure actuelles', syntax: 'NOW()' },
    { name: 'DATE', desc: 'Créer une date', syntax: 'DATE(année, mois, jour)' },
    { name: 'YEAR', desc: 'Année d\'une date', syntax: 'YEAR(date)' },
    { name: 'MONTH', desc: 'Mois d\'une date', syntax: 'MONTH(date)' },
    { name: 'DAY', desc: 'Jour d\'une date', syntax: 'DAY(date)' },
    { name: 'COUNTIF', desc: 'Compter si condition', syntax: 'COUNTIF(plage, critère)' },
    { name: 'COUNTIFS', desc: 'Compter si multi-conditions', syntax: 'COUNTIFS(plage1, crit1, ...)' },
    { name: 'SUMIF', desc: 'Somme si condition', syntax: 'SUMIF(plage, critère, [somme_plage])' },
    { name: 'SUMIFS', desc: 'Somme si multi-conditions', syntax: 'SUMIFS(somme, plage1, crit1, ...)' },
    { name: 'AVERAGEIF', desc: 'Moyenne si condition', syntax: 'AVERAGEIF(plage, critère, [moy_plage])' },
    { name: 'LARGE', desc: 'K-ième plus grand', syntax: 'LARGE(plage, k)' },
    { name: 'SMALL', desc: 'K-ième plus petit', syntax: 'SMALL(plage, k)' },
    { name: 'RANK', desc: 'Rang', syntax: 'RANK(nombre, plage, [ordre])' },
    { name: 'CHOOSE', desc: 'Choisir par index', syntax: 'CHOOSE(index, val1, val2, ...)' },
    { name: 'REPT', desc: 'Répéter texte', syntax: 'REPT(texte, nb)' },
    { name: 'LOG', desc: 'Logarithme', syntax: 'LOG(nombre, [base])' },
    { name: 'LN', desc: 'Logarithme naturel', syntax: 'LN(nombre)' },
    { name: 'EXP', desc: 'Exponentielle', syntax: 'EXP(nombre)' },
    { name: 'PI', desc: 'Pi', syntax: 'PI()' },
    { name: 'RAND', desc: 'Nombre aléatoire', syntax: 'RAND()' },
    { name: 'RANDBETWEEN', desc: 'Aléatoire entre bornes', syntax: 'RANDBETWEEN(min, max)' },
    { name: 'CEILING', desc: 'Plafond', syntax: 'CEILING(nombre, [signif])' },
    { name: 'FLOOR', desc: 'Plancher', syntax: 'FLOOR(nombre, [signif])' },
    { name: 'SPARKLINE', desc: 'Mini-graphique dans la cellule', syntax: 'SPARKLINE(plage, [type])' },
]

/** Format a numeric string for display using the cell's numberFormat.
 *  Handles thousands separators (French locale: space), currency (€),
 *  percentage, dates (Excel serial → dd/mm/yyyy), time, datetime, duration,
 *  scientific notation, and accounting brackets for negatives. */
function formatDisplayValue(value: string, style?: CellStyle): string {
    if (!style?.numberFormat || style.numberFormat === 'auto' || style.numberFormat === 'text' || value === '') return value
    if (isNaN(Number(value))) return value
    const num = Number(value)
    const dec = style.decimals ?? 2

    // Helper: format number with thousands separator (non-breaking space) and decimal comma (French locale)
    const fmtNum = (n: number, decimals: number): string => {
        const abs = Math.abs(n)
        const fixed = abs.toFixed(decimals)
        const [intPart, decPart] = fixed.split('.')
        const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') // non-breaking space
        const formatted = decPart ? `${grouped},${decPart}` : grouped
        return n < 0 ? `-${formatted}` : formatted
    }

    // Helper: Excel serial number → JS Date (Excel epoch: 1899-12-30, with Lotus 123 leap year bug)
    const serialToDate = (serial: number): Date | null => {
        if (serial < 0) return null
        // Excel incorrectly treats 1900 as a leap year (serial 60 = Feb 29, 1900)
        const adjusted = serial > 59 ? serial - 1 : serial
        const d = new Date(1899, 11, 30 + adjusted)
        return isNaN(d.getTime()) ? null : d
    }

    switch (style.numberFormat) {
        case 'number':
            return fmtNum(num, dec)
        case 'currency':
            return `${fmtNum(num, dec)} \u20AC`
        case 'accounting':
            return num < 0
                ? `(${fmtNum(Math.abs(num), dec)} \u20AC)`
                : `${fmtNum(num, dec)} \u20AC`
        case 'percent':
            return `${fmtNum(num * 100, dec)}%`
        case 'scientific':
            return num.toExponential(dec)
        case 'date': {
            const d = serialToDate(num)
            if (!d) return value
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        }
        case 'time': {
            const frac = num % 1
            const totalSeconds = Math.round(Math.abs(frac) * 86400)
            const h = Math.floor(totalSeconds / 3600)
            const m = Math.floor((totalSeconds % 3600) / 60)
            const s = totalSeconds % 60
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
        case 'datetime': {
            const d = serialToDate(Math.floor(num))
            if (!d) return value
            const frac = num % 1
            const totalSeconds = Math.round(Math.abs(frac) * 86400)
            const h = Math.floor(totalSeconds / 3600)
            const mi = Math.floor((totalSeconds % 3600) / 60)
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
        }
        case 'duration': {
            const totalSeconds = Math.round(Math.abs(num) * 86400)
            const h = Math.floor(totalSeconds / 3600)
            const m = Math.floor((totalSeconds % 3600) / 60)
            const s = totalSeconds % 60
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
        default: return value
    }
}

// ---- Toolbar Button ----
const TBtn = React.forwardRef<HTMLButtonElement, {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    active?: boolean;
    title?: string;
    children: React.ReactNode;
    className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>>(({ onClick, active, title, children, className, ...props }, ref) => {
    return (
        <ToolbarButton ref={ref} onClick={onClick} isActive={active} title={title} className={className} onMouseDown={(e) => { e.preventDefault(); props.onMouseDown?.(e); }} {...props}>
            {children}
        </ToolbarButton>
    )
});
TBtn.displayName = 'TBtn';

const Sep = () => <ToolbarDivider />

// ---- Context Menu ----
function ContextMenu({ x, y, onAction, onClose }: {
    x: number, y: number, onAction: (action: string) => void, onClose: () => void
}) {
    useEffect(() => {
        const handler = () => onClose()
        // Use a small timeout so the click that opened the menu doesn't immediately close it
        setTimeout(() => {
            document.addEventListener('click', handler)
            document.addEventListener('contextmenu', handler)
        }, 10)
        return () => { document.removeEventListener('click', handler); document.removeEventListener('contextmenu', handler) }
    }, [onClose])

    const items: { label: string, icon: React.ReactNode, action: string, sep?: boolean }[] = [
        { label: 'Couper', icon: <Scissors className="w-4 h-4" />, action: 'cut' },
        { label: 'Copier', icon: <Copy className="w-4 h-4" />, action: 'copy' },
        { label: 'Coller', icon: <ClipboardPaste className="w-4 h-4" />, action: 'paste', sep: true },
        { label: 'Ins\u00E9rer un commentaire', icon: <MessageSquare className="w-4 h-4" />, action: 'comment', sep: true },
        { label: 'Ins\u00E9rer ligne au-dessus', icon: <ArrowUp className="w-4 h-4" />, action: 'insertRowAbove' },
        { label: 'Ins\u00E9rer ligne en-dessous', icon: <ArrowDown className="w-4 h-4" />, action: 'insertRowBelow' },
        { label: 'Ins\u00E9rer colonne \u00E0 gauche', icon: <Columns className="w-4 h-4" />, action: 'insertColLeft' },
        { label: 'Ins\u00E9rer colonne \u00E0 droite', icon: <ChevronRight className="w-4 h-4" />, action: 'insertColRight', sep: true },
        { label: 'Supprimer la ligne', icon: <Trash2 className="w-4 h-4 text-red-500" />, action: 'deleteRow' },
        { label: 'Supprimer la colonne', icon: <Trash2 className="w-4 h-4 text-red-500" />, action: 'deleteCol', sep: true },
        { label: 'Trier A \u2192 Z', icon: <ArrowUp className="w-4 h-4" />, action: 'sortAsc' },
        { label: 'Trier Z \u2192 A', icon: <ArrowDown className="w-4 h-4" />, action: 'sortDesc' },
    ]

    return (
        <div className="fixed bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl z-[100] py-1 min-w-[220px] text-[13px]" style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
                <div key={item.action}>
                    {item.sep && i > 0 && <div className="h-px bg-[#e3e3e3] dark:bg-[#5f6368] my-1" />}
                    <button className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] text-left text-[#202124] dark:text-[#e8eaed]" onClick={() => onAction(item.action)}>
                        {item.icon}{item.label}
                    </button>
                </div>
            ))}
        </div>
    )
}

// ---- Border Picker ----
function BorderPicker({ onSelect, onClose }: { onSelect: (type: string) => void, onClose: () => void }) {
    const options = [
        { type: 'all', label: 'Toutes', icon: <Grid3X3 className="w-4 h-4" /> },
        { type: 'outer', label: 'Ext\u00E9rieures', icon: <Square className="w-4 h-4" /> },
        { type: 'none', label: 'Aucune', icon: <BoxSelect className="w-4 h-4" /> },
        { type: 'bottom', label: 'Bas', icon: <Rows className="w-4 h-4" /> },
        { type: 'top', label: 'Haut', icon: <Rows className="w-4 h-4 rotate-180" /> },
        { type: 'left', label: 'Gauche', icon: <Columns className="w-4 h-4" /> },
        { type: 'right', label: 'Droite', icon: <Columns className="w-4 h-4 rotate-180" /> },
    ]
    return (
        <div className="absolute top-8 left-0 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 p-2 w-48">
            <div className="flex items-center justify-between mb-1 px-1">
                <span className="font-medium text-[12px]">Bordures</span>
                <button onClick={onClose}><X className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-4 gap-1">
                {options.map(opt => (
                    <button key={opt.type} className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] text-[10px]" title={opt.label} onClick={() => { onSelect(opt.type); onClose() }}>
                        {opt.icon}
                    </button>
                ))}
            </div>
        </div>
    )
}



// ---- Mini Chart ----
function MiniChart({ type, values, onClose }: { type: 'bar' | 'line' | 'pie', values: number[], onClose: () => void }) {
    const w = 300, h = 200, pad = 30
    const max = Math.max(...values, 1)
    const colors = ['#4a86e8', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7baaf7', '#f07b72']

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{type === 'bar' ? 'Graphique en barres' : type === 'line' ? 'Graphique en ligne' : 'Graphique circulaire'}</span>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>
                <svg width={w} height={h} viewBox={type === 'pie' ? "-1 -1 2 2" : undefined}>
                    {type === 'bar' && (() => {
                        const barW = (w - pad * 2) / values.length - 4
                        return <>
                            <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#ccc" />
                            <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#ccc" />
                            {values.map((v, i) => {
                                const bh = ((h - pad * 2) * v) / max
                                return <rect key={i} x={pad + i * (barW + 4) + 2} y={h - pad - bh} width={barW} height={bh} fill="#4a86e8" rx={2} />
                            })}
                        </>
                    })()}
                    {type === 'line' && (() => {
                        const stepX = (w - pad * 2) / Math.max(values.length - 1, 1)
                        const points = values.map((v, i) => `${pad + i * stepX},${h - pad - ((h - pad * 2) * v) / max}`).join(' ')
                        return <>
                            <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#ccc" />
                            <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#ccc" />
                            <polyline points={points} fill="none" stroke="#4a86e8" strokeWidth={2} />
                            {values.map((v, i) => <circle key={i} cx={pad + i * stepX} cy={h - pad - ((h - pad * 2) * v) / max} r={3} fill="#4a86e8" />)}
                        </>
                    })()}
                    {type === 'pie' && (() => {
                        const total = values.reduce((a, b) => a + b, 0) || 1
                        let angle = 0
                        return values.map((v, i) => {
                            const slice = (v / total) * Math.PI * 2
                            const x1 = Math.cos(angle), y1 = Math.sin(angle)
                            angle += slice
                            const x2 = Math.cos(angle), y2 = Math.sin(angle)
                            return <path key={i} d={`M0 0 L${x1} ${y1} A1 1 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2}Z`} fill={colors[i % colors.length]} />
                        })
                    })()}
                </svg>
            </div>
        </div>
    )
}

// ---- Find & Replace Bar ----
function FindReplaceBar({ findText, replaceText, matchCount, currentMatch, showReplace, searchAllSheets, onFindChange, onReplaceChange, onNext, onPrev, onReplace, onReplaceAll, onToggleReplace, onToggleAllSheets, onClose }: {
    findText: string, replaceText: string, matchCount: number, currentMatch: number, showReplace: boolean, searchAllSheets: boolean,
    onFindChange: (v: string) => void, onReplaceChange: (v: string) => void,
    onNext: () => void, onPrev: () => void, onReplace: () => void, onReplaceAll: () => void,
    onToggleReplace: () => void, onToggleAllSheets: () => void, onClose: () => void
}) {
    return (
        <div className="absolute top-0 right-4 z-50 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-b-lg shadow-lg p-2 flex flex-col gap-1.5 w-[380px]">
            <div className="flex items-center gap-1.5">
                <button onClick={onToggleReplace} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded shrink-0" title={showReplace ? "Masquer remplacer" : "Afficher remplacer"}>
                    {showReplace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 flex items-center bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 h-7">
                    <Search className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
                    <input className="flex-1 bg-transparent outline-none text-[13px] px-1.5" placeholder="Rechercher..." value={findText} onChange={e => onFindChange(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') onNext(); if (e.key === 'Escape') onClose() }} />
                    <span className="text-[11px] text-[#5f6368] shrink-0">{matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : findText ? '0' : ''}</span>
                </div>
                <button onClick={onPrev} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded" title="Pr\u00E9c\u00E9dent"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button onClick={onNext} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded" title="Suivant"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded" title="Fermer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-1.5 ml-6">
                <label className="flex items-center gap-1.5 text-[11px] text-[#5f6368] dark:text-[#9aa0a6] cursor-pointer select-none">
                    <input type="checkbox" checked={searchAllSheets} onChange={onToggleAllSheets} className="w-3 h-3 rounded accent-[#1a73e8]" />
                    Rechercher dans tous les onglets
                </label>
            </div>
            {showReplace && (
                <div className="flex items-center gap-1.5 ml-6">
                    <div className="flex-1 flex items-center bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 h-7">
                        <Replace className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
                        <input className="flex-1 bg-transparent outline-none text-[13px] px-1.5" placeholder="Remplacer par..." value={replaceText} onChange={e => onReplaceChange(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose() }} />
                    </div>
                    <button onClick={onReplace} className="px-2 h-7 text-[12px] hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded border border-[#dadce0] dark:border-[#5f6368]">Remplacer</button>
                    <button onClick={onReplaceAll} className="px-2 h-7 text-[12px] hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded border border-[#dadce0] dark:border-[#5f6368]">Tout</button>
                </div>
            )}
        </div>
    )
}

// ---- Conditional Formatting Dialog ----
interface CondRule { type: 'gt' | 'lt' | 'eq' | 'between' | 'text' | 'empty' | 'notEmpty'; value: string; value2?: string; color: string; range?: string }

function CondFormatDialog({ rules, onAdd, onRemove, onClose }: {
    rules: CondRule[], onAdd: (rule: CondRule) => void, onRemove: (i: number) => void, onClose: () => void
}) {
    const [type, setType] = useState<CondRule['type']>('gt')
    const [value, setValue] = useState('')
    const [value2, setValue2] = useState('')
    const [color, setColor] = useState('#34a853')

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4 w-[380px] max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Mise en forme conditionnelle</span>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>
                {/* Existing rules */}
                {rules.length > 0 && (
                    <div className="mb-3 space-y-1">
                        {rules.map((rule, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[#f8f9fa] dark:bg-[#3c4043] rounded text-[12px]">
                                <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: rule.color }} />
                                <span className="flex-1 truncate">
                                    {rule.type === 'gt' && `> ${rule.value}`}
                                    {rule.type === 'lt' && `< ${rule.value}`}
                                    {rule.type === 'eq' && `= ${rule.value}`}
                                    {rule.type === 'between' && `${rule.value} \u2013 ${rule.value2}`}
                                    {rule.type === 'text' && `Contient "${rule.value}"`}
                                    {rule.type === 'empty' && 'Est vide'}
                                    {rule.type === 'notEmpty' && "N'est pas vide"}
                                </span>
                                <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                )}
                {/* New rule */}
                <div className="space-y-2">
                    <select className="w-full h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none border-none" value={type} onChange={e => setType(e.target.value as CondRule['type'])}>
                        <option value="gt">Sup\u00E9rieur \u00E0</option>
                        <option value="lt">Inf\u00E9rieur \u00E0</option>
                        <option value="eq">\u00C9gal \u00E0</option>
                        <option value="between">Entre</option>
                        <option value="text">Contient le texte</option>
                        <option value="empty">Est vide</option>
                        <option value="notEmpty">N'est pas vide</option>
                    </select>
                    {type !== 'empty' && type !== 'notEmpty' && (
                        <div className="flex gap-2">
                            <input className="flex-1 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" placeholder="Valeur" value={value} onChange={e => setValue(e.target.value)} />
                            {type === 'between' && <input className="flex-1 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" placeholder="Valeur 2" value={value2} onChange={e => setValue2(e.target.value)} />}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-[12px]">Couleur :</span>
                        <div className="flex gap-1">
                            {['#34a853', '#ea4335', '#fbbc04', '#4a86e8', '#ff6d01', '#9334e6'].map(c => (
                                <button key={c} className={cn("w-5 h-5 rounded-sm border", color === c ? 'border-[#202124] scale-110' : 'border-gray-300')} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                            ))}
                        </div>
                    </div>
                    <button className="w-full h-8 bg-[#1a73e8] text-white rounded text-[13px] font-medium hover:bg-[#1557b0] transition-colors" onClick={() => { onAdd({ type, value, value2, color }); setValue(''); setValue2('') }}>
                        Ajouter la r\u00E8gle
                    </button>
                </div>
            </div>
        </div>
    )
}


// ---- Sparkline Cell ----
function SparklineCell({ value, width, height }: { value: string, width: number, height: number }) {
    const parts = value.replace('__SPARKLINE__:', '').split(':')
    const type = parts[0]
    const values = parts[1].split(',').map(Number)
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const w = Math.max(width - 4, 20)
    const h = Math.max(height - 4, 10)

    if (type === 'bar' || type === 'column') {
        const barW = w / values.length - 1
        return (
            <svg width={w} height={h} className="mx-auto">
                {values.map((v, i) => {
                    const barH = ((v - min) / range) * h
                    return <rect key={i} x={i * (barW + 1)} y={h - barH} width={barW} height={barH} fill="#4a86e8" />
                })}
            </svg>
        )
    }
    const points = values.map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * w
        const y = h - ((v - min) / range) * h
        return `${x},${y}`
    }).join(' ')
    return (
        <svg width={w} height={h} className="mx-auto">
            <polyline points={points} fill="none" stroke="#4a86e8" strokeWidth={1.5} />
        </svg>
    )
}

// ---- Filter Dialog ----
function FilterDialog({ col, data, onApply, onClose }: {
    col: number, data: Record<string, CellData>, onApply: (values: Set<string>) => void, onClose: () => void
}) {
    const uniqueValues = useMemo(() => {
        const seen = new Set<string>()
        for (const key of Object.keys(data)) {
            const c = parseInt(key.split(',')[1], 10)
            if (c !== col) continue
            const v = data[key]?.value
            if (v && !seen.has(v)) seen.add(v)
        }
        return Array.from(seen).sort()
    }, [col, data])

    const [checked, setChecked] = useState<Set<string>>(new Set(uniqueValues))
    const [search, setSearch] = useState('')
    const filtered = search ? uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase())) : uniqueValues

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4 w-[300px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Filtrer colonne {indexToCol(col)}</span>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>
                <input className="h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none mb-2" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
                <div className="flex gap-2 mb-2 text-[11px]">
                    <button className="text-[#1a73e8] hover:underline" onClick={() => setChecked(new Set(uniqueValues))}>Tout</button>
                    <button className="text-[#1a73e8] hover:underline" onClick={() => setChecked(new Set())}>Aucun</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5 mb-3 max-h-[200px]">
                    {filtered.map(val => (
                        <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded text-[12px] cursor-pointer">
                            <input type="checkbox" checked={checked.has(val)} onChange={() => { const next = new Set(checked); if (next.has(val)) next.delete(val); else next.add(val); setChecked(next) }} className="accent-[#1a73e8]" />
                            <span className="truncate">{val}</span>
                        </label>
                    ))}
                    {filtered.length === 0 && <span className="text-[12px] text-[#5f6368] px-2">Aucune valeur</span>}
                </div>
                <div className="flex gap-2">
                    <button className="flex-1 h-8 border border-[#dadce0] rounded text-[13px] hover:bg-[#f1f3f4]" onClick={onClose}>Annuler</button>
                    <button className="flex-1 h-8 bg-[#1a73e8] text-white rounded text-[13px] hover:bg-[#1557b0]" onClick={() => { onApply(checked); onClose() }}>Appliquer</button>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// MAIN SPREADSHEET COMPONENT
// ============================================================// MAIN SPREADSHEET COMPONENT
export function Spreadsheet({ documentId = 'new-spreadsheet', documentName = 'document.xlsx', initialData, initialColWidths, initialRowHeights }: { documentId?: string, documentName?: string, initialData?: any, initialColWidths?: Record<number, number>, initialRowHeights?: Record<number, number> }) {
    const {
        doc,
        data, setCell, setCellStyle, setCellFull, setCellComment, setCellValidation,
        deleteCell, deleteCellRange, getCellRange, setCellRange,
        insertRow, deleteRow, insertColumn, deleteColumn,
        sortColumn, mergeCells, unmergeCells,
        isConnected, undo, redo, canUndo, canRedo,
        sheets, activeSheetIndex, setActiveSheetIndex,
        addSheet, removeSheet, renameSheet, setSheetColor,
        getCrossSheetValue, transact, globalGridVersion
    } = useSpreadsheet(documentId, initialData)

    // Autosave: persists sheet data snapshot to localStorage every 30s
    useAutosave(`sheet:${documentId}`, { data, sheets, activeSheetIndex })

    const hasFetchedRef = useRef(false)
    const hasSanitizedRef = useRef(false)

    // Auto-sanitize corrupted Yjs data (fixes [object Object] from old parser)
    useEffect(() => {
        if (doc && !hasSanitizedRef.current) {
            hasSanitizedRef.current = true
            // Run async to not block render
            setTimeout(() => {
                try {
                    const fixed = sanitizeAllSheets(doc)
                    if (fixed > 0) console.log(`[Spreadsheet] Auto-sanitized ${fixed} corrupted cells`)
                } catch (e) {
                    console.warn('[Spreadsheet] Sanitize failed:', e)
                }
            }, 500)
        }
    }, [doc])

    // Selection
    const [selectedRange, setSelectedRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null)
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [activeModal, setActiveModal] = useState<{ id: string, label?: string } | null>(null)

    // Editor Permissions & Refs
    const [isReadOnly, setIsReadOnly] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Editing
    const [editValue, setEditValue] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const formulaBarRef = useRef<HTMLInputElement>(null)

    // Paint format
    const [paintFormat, setPaintFormat] = useState<CellStyle | null>(null)

    // Popovers
    const [showTextColor, setShowTextColor] = useState(false)
    const [showFillColor, setShowFillColor] = useState(false)
    const [showFontPicker, setShowFontPicker] = useState(false)
    const [showFunctionHelper, setShowFunctionHelper] = useState(false)
    const [showBorderPicker, setShowBorderPicker] = useState(false)
    const [showChartPicker, setShowChartPicker] = useState(false)

    // Column/Row resize — synced to Yjs per sheet
    const [colWidths, setColWidths] = useState<Record<number, number>>(initialColWidths ?? {})
    const [rowHeights, setRowHeights] = useState<Record<number, number>>(initialRowHeights ?? {})
    const colWidthsRef = useRef<Record<number, number>>(colWidths)
    const rowHeightsRef = useRef<Record<number, number>>(rowHeights)
    colWidthsRef.current = colWidths
    rowHeightsRef.current = rowHeights
    const resizeRef = useRef<{ type: 'col' | 'row', index: number, startPos: number, startSize: number } | null>(null)

    // Sync colWidths/rowHeights from Yjs maps when active sheet changes
    const currentSheetId = sheets[activeSheetIndex]?.id || 'default'
    useEffect(() => {
        const yjsColWidths = doc.getMap<number>(`colWidths-${currentSheetId}`)
        const yjsRowHeights = doc.getMap<number>(`rowHeights-${currentSheetId}`)

        const loadColWidths = () => {
            const widths: Record<number, number> = {}
            yjsColWidths.forEach((v, k) => { widths[Number(k)] = v })
            setColWidths(widths)
        }
        const loadRowHeights = () => {
            const heights: Record<number, number> = {}
            yjsRowHeights.forEach((v, k) => { heights[Number(k)] = v })
            setRowHeights(heights)
        }

        loadColWidths()
        loadRowHeights()

        yjsColWidths.observe(loadColWidths)
        yjsRowHeights.observe(loadRowHeights)

        return () => {
            yjsColWidths.unobserve(loadColWidths)
            yjsRowHeights.unobserve(loadRowHeights)
        }
    }, [doc, currentSheetId])

    // Persist column width / row height changes to Yjs (observer will update React state)
    const persistColWidth = useCallback((col: number, width: number) => {
        const yjsColWidths = doc.getMap<number>(`colWidths-${currentSheetId}`)
        yjsColWidths.set(String(col), width)
    }, [doc, currentSheetId])

    const persistRowHeight = useCallback((row: number, height: number) => {
        const yjsRowHeights = doc.getMap<number>(`rowHeights-${currentSheetId}`)
        yjsRowHeights.set(String(row), height)
    }, [doc, currentSheetId])

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null)

    // Clipboard
    const clipboardRef = useRef<{ data: (CellData | undefined)[][], bounds: SelectionBounds } | null>(null)
    const [isCut, setIsCut] = useState(false)

    // Drag fill
    const [isDragFilling, setIsDragFilling] = useState(false)
    const [dragFillEnd, setDragFillEnd] = useState<{ r: number, c: number } | null>(null)

    // Sheet tabs
    const [editingTabIndex, setEditingTabIndex] = useState<number | null>(null)
    const [editingTabName, setEditingTabName] = useState("")

    // Chart
    const [chart, setChart] = useState<{ type: 'bar' | 'line' | 'pie', values: number[] } | null>(null)

    // Filter
    const [filterCol, setFilterCol] = useState<number | null>(null)
    const [filterValues, setFilterValues] = useState<Set<string> | null>(null)

    // Freeze
    const [freezeRows, setFreezeRows] = useState(0)
    const [freezeCols, setFreezeCols] = useState(0)
    const [showGridlines, setShowGridlines] = useState(true)

    // Find & Replace
    const [showFind, setShowFind] = useState(false)
    const [showReplaceToggle, setShowReplaceToggle] = useState(false)
    const [findText, setFindText] = useState("")
    const [replaceText, setReplaceText] = useState("")
    const [findAllSheets, setFindAllSheets] = useState(false)
    const [findMatches, setFindMatches] = useState<{ r: number, c: number, sheetIdx?: number }[]>([])
    const [currentFindIdx, setCurrentFindIdx] = useState(0)

    // Conditional formatting
    const [condRules, setCondRules] = useState<CondRule[]>([])
    const [showCondFormat, setShowCondFormat] = useState(false)

    // Comments
    const [hoveredComment, setHoveredComment] = useState<{ r: number, c: number, x: number, y: number } | null>(null)

    // Data validation dropdown
    const [validationDropdown, setValidationDropdown] = useState<{ r: number, c: number } | null>(null)

    // Tab color picker
    const [showTabColorPicker, setShowTabColorPicker] = useState<number | null>(null)

    // Alternating row colors
    const [bandedRows, setBandedRows] = useState(false)

    // Rotation input
    const [showRotationInput, setShowRotationInput] = useState(false)

    // Advanced filter dialog
    const [showFilterDialog, setShowFilterDialog] = useState(false)

    // Number format dropdown
    const [showNumberFormat, setShowNumberFormat] = useState(false)

    // Zoom level (percentage)
    const [zoomLevel, setZoomLevel] = useState(100)

    // Formula bar visibility
    const [showFormulaBar, setShowFormulaBar] = useState(true)

    // Virtualization
    const gridRef = useRef<HTMLDivElement>(null)
    const mainContainerRef = useRef<HTMLDivElement>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)
    const [viewportW, setViewportW] = useState(1200)
    const [viewportH, setViewportH] = useState(600)

    // Formula autocomplete
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([])
    const [autocompleteIdx, setAutocompleteIdx] = useState(0)

    // AI Sheets Dialog
    const [showAiDialog, setShowAiDialog] = useState(false)

    // Pivot Table
    const [showPivotDialog, setShowPivotDialog] = useState(false)

    // Advanced Chart Dialog
    const [showChartDialog, setShowChartDialog] = useState(false)
    const [floatingCharts, setFloatingCharts] = useState<{
        id: string, type: 'bar' | 'line' | 'pie' | 'scatter' | 'area',
        title: string, chartData: Record<string, string | number>[],
        seriesNames: string[], colors: string[], showLegend: boolean
    }[]>([])

    // Macro Editor
    const [showMacroEditor, setShowMacroEditor] = useState(false)

    // CSV import ref
    const csvInputRef = useRef<HTMLInputElement>(null)

    // IDEA-016: Freeze pane visual indicator — state already exists (freezeRows, freezeCols)
    // IDEA-017: CSV drag-drop — handled in drag events on grid
    const [isDragOver, setIsDragOver] = useState(false)

    // IDEA-018: Named ranges
    const [namedRanges, setNamedRanges] = useState<NamedRange[]>([])
    const [showNamedRanges, setShowNamedRanges] = useState(false)

    // IDEA-020: Print preview
    const [showPrintPreview, setShowPrintPreview] = useState(false)

    // IDEA-021: Advanced data validation dialog
    const [showAdvancedValidation, setShowAdvancedValidation] = useState(false)

    // IDEA-022: Advanced conditional formatting
    const [advCondRules, setAdvCondRules] = useState<AdvCondRule[]>([])
    const [showAdvCondFormat, setShowAdvCondFormat] = useState(false)

    // Formula cache
    const [evaluatedData, setEvaluatedData] = useState<Record<string, string>>({})

    const getColWidth = (c: number) => colWidths[c] ?? DEFAULT_COL_WIDTH
    const getRowHeight = (r: number) => rowHeights[r] ?? DEFAULT_ROW_HEIGHT

    // Dynamic row count: expands based on data, minimum 200 for empty sheets
    const effectiveRows = useMemo(() => getEffectiveRows(data), [data])

    // ---- Precompute cumulative offsets for virtualization ----
    const colOffsets = useMemo(() => {
        const offsets = new Float64Array(COLS + 1)
        for (let c = 0; c < COLS; c++) offsets[c + 1] = offsets[c] + getColWidth(c)
        return offsets
    }, [colWidths])

    const rowOffsets = useMemo(() => {
        const offsets = new Float64Array(effectiveRows + 1)
        for (let r = 0; r < effectiveRows; r++) offsets[r + 1] = offsets[r] + getRowHeight(r)
        return offsets
    }, [rowHeights, effectiveRows])

    const totalWidth = colOffsets[COLS]
    const totalHeight = rowOffsets[effectiveRows]

    // Binary search for first visible row/col
    const findFirst = (offsets: Float64Array, scroll: number): number => {
        let lo = 0, hi = offsets.length - 2
        while (lo < hi) { const mid = (lo + hi) >> 1; if (offsets[mid + 1] <= scroll) lo = mid + 1; else hi = mid }
        return lo
    }

    const visibleRows = useMemo(() => {
        const first = findFirst(rowOffsets, scrollTop)
        const startR = Math.max(0, first - VIRT_BUFFER)
        let endR = first
        while (endR < effectiveRows && rowOffsets[endR] < scrollTop + viewportH) endR++
        endR = Math.min(effectiveRows - 1, endR + VIRT_BUFFER)
        return { startR, endR }
    }, [scrollTop, viewportH, rowOffsets, effectiveRows])

    const visibleCols = useMemo(() => {
        const first = findFirst(colOffsets, scrollLeft)
        const startC = Math.max(0, first - VIRT_BUFFER)
        let endC = first
        while (endC < COLS && colOffsets[endC] < scrollLeft + viewportW) endC++
        endC = Math.min(COLS - 1, endC + VIRT_BUFFER)
        return { startC, endC }
    }, [scrollLeft, viewportW, colOffsets])

    const selectionBounds: SelectionBounds | null = useMemo(() => {
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

    // ---- Status bar stats ----
    const selectionStats = useMemo(() => {
        if (!selectionBounds) return null
        const { minR, maxR, minC, maxC } = selectionBounds
        if (minR === maxR && minC === maxC) return null
        const values: number[] = []
        let count = 0
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const key = `${r},${c}`
                const val = evaluatedData[key] || data[key]?.value || ''
                if (val.trim() !== '') { count++; const n = Number(val); if (!isNaN(n)) values.push(n) }
            }
        }
        if (values.length === 0) return { count }
        const sum = values.reduce((a, b) => a + b, 0)
        return { count, sum, avg: sum / values.length, min: Math.min(...values), max: Math.max(...values) }
    }, [selectionBounds, evaluatedData, data])

    // IDEA-018: Named range resolver — expand named ranges in formula text before evaluation
    const expandNamedRanges = useCallback((formula: string): string => {
        if (!formula.startsWith('=') || namedRanges.length === 0) return formula
        let expanded = formula
        for (const nr of namedRanges) {
            // Replace exact word boundaries of the name with the range
            const re = new RegExp(`\\b${nr.name}\\b`, 'g')
            expanded = expanded.replace(re, nr.range)
        }
        return expanded
    }, [namedRanges])

    // ---- Formula recalculation (optimized: only cells with data) ----
    useEffect(() => {
        const newData: Record<string, string> = {}
        const getData = (r: number, c: number, sheet?: string) => {
            if (sheet) return getCrossSheetValue(sheet, r, c)
            const cell = data[`${r},${c}`]
            if (!cell) return ""
            // Return formula when present so the evaluator can compute it;
            // otherwise return the plain value.
            return cell.formula || cell.value || ""
        }
        const activeSheet = sheets[activeSheetIndex]?.name
        const keys = Object.keys(data)
        for (const key of keys) {
            const cell = data[key]
            // Prefer formula over cached value so formulas are re-evaluated
            const raw = cell.formula || cell.value
            const expression = expandNamedRanges(raw)
            const [rStr, cStr] = key.split(',')
            newData[key] = evaluateFormula(expression, getData, { r: parseInt(rStr), c: parseInt(cStr), sheet: activeSheet }, new Set())
        }
        setEvaluatedData(newData)
    }, [data, getCrossSheetValue, globalGridVersion, sheets, activeSheetIndex])

    // Sync edit value — prefer formula over display value so the formula bar shows formulas
    useEffect(() => {
        if (activeCell && !isEditing) {
            const cell = data[`${activeCell.r},${activeCell.c}`]
            setEditValue(cell?.formula || cell?.value || "")
        }
    }, [activeCell, data, isEditing])

    // Formula autocomplete suggestions
    useEffect(() => {
        if (!isEditing || !editValue.startsWith('=')) { setAutocompleteSuggestions([]); return }
        // Extract the last function-like token being typed
        const match = editValue.toUpperCase().match(/(?:^=|[(,+\-*/])([A-Z]{1,15})$/)
        if (match) {
            const partial = match[1]
            const filtered = ALL_FUNCTIONS.filter(f => f.name.startsWith(partial)).slice(0, 8)
            setAutocompleteSuggestions(filtered.map(f => f.name))
            setAutocompleteIdx(0)
        } else {
            setAutocompleteSuggestions([])
        }
    }, [editValue, isEditing])

    // Close popovers
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-popover]')) {
                setShowTextColor(false); setShowFillColor(false); setShowFontPicker(false)
                setShowFunctionHelper(false); setShowBorderPicker(false); setShowChartPicker(false)
                setShowNumberFormat(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Track viewport size
    useEffect(() => {
        const el = gridRef.current
        if (!el) return
        const obs = new ResizeObserver(entries => {
            const e = entries[0]
            if (e) { setViewportW(e.contentRect.width); setViewportH(e.contentRect.height) }
        })
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    // Find matches (supports searching across all sheets)
    useEffect(() => {
        if (!findText) { setFindMatches([]); return }
        const matches: { r: number, c: number, sheetIdx?: number }[] = []
        const lower = findText.toLowerCase()

        if (findAllSheets) {
            // Search all sheets via Yjs maps
            for (let si = 0; si < sheets.length; si++) {
                const gridMap = doc.getMap<CellData>(`grid-${sheets[si].id}`)
                const sheetData = gridMap.toJSON() as Record<string, CellData>
                for (const [key, cellData] of Object.entries(sheetData)) {
                    const val = cellData?.value || ''
                    if (val.toLowerCase().includes(lower)) {
                        const [r, c] = key.split(',').map(Number)
                        matches.push({ r, c, sheetIdx: si })
                    }
                }
            }
        } else {
            // Search only active sheet
            for (const key of Object.keys(data)) {
                const val = data[key]?.value || ''
                if (val.toLowerCase().includes(lower)) {
                    const [r, c] = key.split(',').map(Number)
                    matches.push({ r, c })
                }
            }
        }

        setFindMatches(matches)
        setCurrentFindIdx(0)
    }, [findText, data, findAllSheets, sheets, doc])

    // Resize mouse handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizeRef.current) {
                const { type, index, startPos, startSize } = resizeRef.current
                const delta = type === 'col' ? e.clientX - startPos : e.clientY - startPos
                const newSize = Math.max(30, startSize + delta)
                if (type === 'col') setColWidths(prev => ({ ...prev, [index]: newSize }))
                else setRowHeights(prev => ({ ...prev, [index]: newSize }))
            }
            if (isDragFilling && selectionBounds && gridRef.current) {
                const rect = gridRef.current.getBoundingClientRect()
                const sl = gridRef.current.scrollLeft, st = gridRef.current.scrollTop
                const x = e.clientX - rect.left + sl - ROW_HEADER_WIDTH
                const y = e.clientY - rect.top + st - COL_HEADER_HEIGHT
                let col = findFirst(colOffsets, Math.max(0, x))
                let row = findFirst(rowOffsets, Math.max(0, y))
                col = Math.min(COLS - 1, col); row = Math.min(effectiveRows - 1, row)
                setDragFillEnd({ r: row, c: col })
            }
        }
        const handleMouseUp = () => {
            if (resizeRef.current) {
                // Persist final size to Yjs so it survives sheet switches
                const { type, index, startSize } = resizeRef.current
                resizeRef.current = null
                // We need to read the final value — grab it from the DOM-driven ref
                requestAnimationFrame(() => {
                    const yjsMap = doc.getMap<number>(type === 'col' ? `colWidths-${currentSheetId}` : `rowHeights-${currentSheetId}`)
                    // The value was already set in React state during drag; read from colWidthsRef/rowHeightsRef
                    yjsMap.set(String(index), colWidthsRef.current[index] ?? (type === 'col' ? DEFAULT_COL_WIDTH : DEFAULT_ROW_HEIGHT))
                })
            }
            setIsDragging(false)
            if (isDragFilling && dragFillEnd && selectionBounds) { performDragFill(); setIsDragFilling(false); setDragFillEnd(null) }
        }
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
    })

    // IDEA-022: Advanced conditional formatting helpers
    const selectionNumValues = useMemo(() => {
        if (!selectionBounds) return { min: 0, max: 100 }
        const nums: number[] = []
        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++)
            for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                const v = Number(evaluatedData[`${r},${c}`] || data[`${r},${c}`]?.value || '')
                if (!isNaN(v)) nums.push(v)
            }
        return { min: Math.min(...nums, 0), max: Math.max(...nums, 1) }
    }, [selectionBounds, evaluatedData, data])

    const advCondFormatOverlay = useCallback((r: number, c: number): { dataBar?: { pct: number; color: string; showVal: boolean }; icon?: string; bgColor?: string } | null => {
        if (advCondRules.length === 0) return null
        const rawVal = evaluatedData[`${r},${c}`] || data[`${r},${c}`]?.value || ''
        const num = Number(rawVal)
        const { min, max } = selectionNumValues
        const pct = max !== min ? ((num - min) / (max - min)) * 100 : 50

        for (const rule of advCondRules) {
            if (rule.type === 'data_bar' && !isNaN(num)) {
                return { dataBar: { pct: Math.max(0, Math.min(100, pct)), color: rule.color, showVal: rule.showValue } }
            }
            if (rule.type === 'color_scale' && !isNaN(num)) {
                // Interpolate between minColor and maxColor
                const p = Math.max(0, Math.min(1, (num - min) / (max - min || 1)))
                const hex2rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
                const [r1, g1, b1] = hex2rgb(rule.minColor)
                const [r2, g2, b2] = hex2rgb(rule.maxColor)
                const ri = Math.round(r1 + (r2 - r1) * p)
                const gi = Math.round(g1 + (g2 - g1) * p)
                const bi = Math.round(b1 + (b2 - b1) * p)
                return { bgColor: `rgb(${ri},${gi},${bi})` }
            }
            if (rule.type === 'icon_set' && !isNaN(num)) {
                const [t1, t2] = rule.thresholds
                const icons = rule.iconSet === 'traffic' ? ['🔴', '🟡', '🟢'] : rule.iconSet === 'arrows' ? ['↓', '→', '↑'] : ['☆', '★', '★★']
                const icon = pct <= t1 ? icons[0] : pct <= t2 ? icons[1] : icons[2]
                return { icon }
            }
        }
        return null
    }, [advCondRules, evaluatedData, data, selectionNumValues])

    // ---- Conditional formatting evaluation ----
    const condFormatColor = useCallback((r: number, c: number): string | undefined => {
        if (condRules.length === 0) return undefined
        const key = `${r},${c}`
        const rawVal = evaluatedData[key] || data[key]?.value || ''
        for (const rule of condRules) {
            const num = Number(rawVal)
            switch (rule.type) {
                case 'gt': if (!isNaN(num) && num > Number(rule.value)) return rule.color; break
                case 'lt': if (!isNaN(num) && num < Number(rule.value)) return rule.color; break
                case 'eq': if (rawVal === rule.value || (!isNaN(num) && num === Number(rule.value))) return rule.color; break
                case 'between': if (!isNaN(num) && num >= Number(rule.value) && num <= Number(rule.value2)) return rule.color; break
                case 'text': if (rawVal.toLowerCase().includes(rule.value.toLowerCase())) return rule.color; break
                case 'empty': if (rawVal.trim() === '') return rule.color; break
                case 'notEmpty': if (rawVal.trim() !== '') return rule.color; break
            }
        }
        return undefined
    }, [condRules, evaluatedData, data])

    // ---- Formatting helpers ----
    const applyToSelection = useCallback((stylePatch: Partial<CellStyle>) => {
        if (selectionBounds) {
            transact(() => {
                for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++)
                    for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++)
                        setCellStyle(r, c, stylePatch)
            })
        } else if (activeCell) {
            setCellStyle(activeCell.r, activeCell.c, stylePatch)
        }
    }, [selectionBounds, activeCell, setCellStyle, transact])

    const toggleBoolFormat = useCallback((prop: keyof CellStyle) => {
        applyToSelection({ [prop]: !activeCellStyle[prop] })
    }, [activeCellStyle, applyToSelection])

    const cycleAlign = useCallback(() => {
        const idx = ALIGN_CYCLE.indexOf(activeCellStyle.align || 'left')
        applyToSelection({ align: ALIGN_CYCLE[(idx + 1) % 3] })
    }, [activeCellStyle, applyToSelection])

    const cycleVerticalAlign = useCallback(() => {
        const idx = VALIGN_CYCLE.indexOf(activeCellStyle.verticalAlign || 'middle')
        applyToSelection({ verticalAlign: VALIGN_CYCLE[(idx + 1) % 3] })
    }, [activeCellStyle, applyToSelection])

    const changeFontSize = useCallback((delta: number) => {
        applyToSelection({ fontSize: Math.max(6, Math.min(72, (activeCellStyle.fontSize || 10) + delta)) })
    }, [activeCellStyle, applyToSelection])

    const changeDecimals = useCallback((delta: number) => {
        const next = Math.max(0, Math.min(10, (activeCellStyle.decimals ?? 2) + delta))
        applyToSelection({ decimals: next, numberFormat: activeCellStyle.numberFormat || 'number' })
    }, [activeCellStyle, applyToSelection])

    const applyBorders = useCallback((type: string) => {
        const bounds = selectionBounds || (activeCell ? { minR: activeCell.r, maxR: activeCell.r, minC: activeCell.c, maxC: activeCell.c } : null)
        if (!bounds) return
        const { minR, maxR, minC, maxC } = bounds
        transact(() => {
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    let patch: Partial<CellStyle> = {}
                    if (type === 'none') patch = { borderTop: false, borderRight: false, borderBottom: false, borderLeft: false }
                    else if (type === 'all') patch = { borderTop: true, borderRight: true, borderBottom: true, borderLeft: true }
                    else if (type === 'outer') patch = { borderTop: r === minR, borderBottom: r === maxR, borderLeft: c === minC, borderRight: c === maxC }
                    else if (type === 'top') patch = { borderTop: r === minR }
                    else if (type === 'bottom') patch = { borderBottom: r === maxR }
                    else if (type === 'left') patch = { borderLeft: c === minC }
                    else if (type === 'right') patch = { borderRight: c === maxC }
                    setCellStyle(r, c, patch)
                }
            }
        })
    }, [selectionBounds, activeCell, setCellStyle, transact])

    // ---- Clipboard ----
    const doCopy = useCallback(() => {
        if (!selectionBounds) return
        const range = getCellRange(selectionBounds.minR, selectionBounds.maxR, selectionBounds.minC, selectionBounds.maxC)
        clipboardRef.current = { data: range, bounds: selectionBounds }
        setIsCut(false)
        const text = range.map(row => row.map(c => c?.value || '').join('\t')).join('\n')
        navigator.clipboard?.writeText(text).catch(() => { })
        toast.success('Copi\u00E9')
    }, [selectionBounds, getCellRange])

    const doCut = useCallback(() => {
        if (!selectionBounds) return
        doCopy(); setIsCut(true); toast.success('Coup\u00E9')
    }, [selectionBounds, doCopy])

    const doPaste = useCallback(async () => {
        if (!activeCell) return
        try {
            const text = await navigator.clipboard?.readText()
            if (text) {
                const rows = text.split('\n').map(row => row.split('\t'))
                rows.forEach((row, dr) => row.forEach((val, dc) => setCell(activeCell.r + dr, activeCell.c + dc, val)))
                if (isCut && clipboardRef.current) { deleteCellRange(clipboardRef.current.bounds.minR, clipboardRef.current.bounds.maxR, clipboardRef.current.bounds.minC, clipboardRef.current.bounds.maxC); setIsCut(false) }
                toast.success('Coll\u00E9'); return
            }
        } catch { }
        if (clipboardRef.current) {
            setCellRange(activeCell.r, activeCell.c, clipboardRef.current.data)
            if (isCut) { deleteCellRange(clipboardRef.current.bounds.minR, clipboardRef.current.bounds.maxR, clipboardRef.current.bounds.minC, clipboardRef.current.bounds.maxC); setIsCut(false) }
            toast.success('Coll\u00E9')
        }
    }, [activeCell, isCut, setCell, setCellRange, deleteCellRange])

    // ---- Smart Auto-fill helpers ----
    const DAYS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
    const DAYS_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const DAYS_SHORT_FR = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
    const DAYS_SHORT_EN = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    const MONTHS_SHORT_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']
    const MONTHS_SHORT_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

    const detectSequence = useCallback((values: string[]): ((index: number) => string) | null => {
        if (values.length === 0) return null
        // Check cyclic patterns (days, months)
        const cyclicLists = [DAYS_FR, DAYS_EN, DAYS_SHORT_FR, DAYS_SHORT_EN, MONTHS_FR, MONTHS_EN, MONTHS_SHORT_FR, MONTHS_SHORT_EN]
        for (const list of cyclicLists) {
            const lower0 = values[0].toLowerCase()
            const startIdx = list.indexOf(lower0)
            if (startIdx === -1) continue
            const isCapitalized = values[0][0] === values[0][0].toUpperCase()
            const allMatch = values.every((v, i) => v.toLowerCase() === list[(startIdx + i) % list.length])
            if (allMatch) {
                return (idx: number) => {
                    const val = list[(startIdx + idx) % list.length]
                    return isCapitalized ? val.charAt(0).toUpperCase() + val.slice(1) : val
                }
            }
        }
        // Check number sequence (linear: detect step)
        const nums = values.map(Number)
        if (nums.every(n => !isNaN(n))) {
            if (nums.length === 1) {
                // Single number: increment by 1
                return (idx: number) => (nums[0] + idx).toString()
            }
            const step = nums[1] - nums[0]
            const isLinear = nums.every((n, i) => i === 0 || Math.abs(n - (nums[0] + step * i)) < 1e-10)
            if (isLinear) {
                return (idx: number) => {
                    const v = nums[0] + step * idx
                    return Number.isInteger(step) && Number.isInteger(nums[0]) ? v.toString() : (Math.round(v * 10000000000) / 10000000000).toString()
                }
            }
        }
        return null
    }, [])

    // ---- Drag Fill ----
    const performDragFill = useCallback(() => {
        if (!selectionBounds || !dragFillEnd) return
        const { minR, maxR, minC, maxC } = selectionBounds
        const srcRows = maxR - minR + 1, srcCols = maxC - minC + 1

        if (dragFillEnd.r > maxR) {
            // Fill down: for each column, detect pattern in source cells
            for (let c = minC; c <= maxC; c++) {
                const srcValues = Array.from({ length: srcRows }, (_, i) => data[`${minR + i},${c}`]?.value || '')
                const seqFn = detectSequence(srcValues)
                for (let r = maxR + 1; r <= dragFillEnd.r; r++) {
                    if (seqFn) {
                        const src = data[`${minR + ((r - minR) % srcRows)},${c}`]
                        setCellFull(r, c, { value: seqFn(r - minR), style: src?.style })
                    } else {
                        const src = data[`${minR + ((r - minR) % srcRows)},${c}`]
                        if (src) setCellFull(r, c, { ...src }); else deleteCell(r, c)
                    }
                }
            }
            setSelectedRange({ start: { r: minR, c: minC }, end: { r: dragFillEnd.r, c: maxC } })
        } else if (dragFillEnd.c > maxC) {
            // Fill right: for each row, detect pattern in source cells
            for (let r = minR; r <= maxR; r++) {
                const srcValues = Array.from({ length: srcCols }, (_, i) => data[`${r},${minC + i}`]?.value || '')
                const seqFn = detectSequence(srcValues)
                for (let c = maxC + 1; c <= dragFillEnd.c; c++) {
                    if (seqFn) {
                        const src = data[`${r},${minC + ((c - minC) % srcCols)}`]
                        setCellFull(r, c, { value: seqFn(c - minC), style: src?.style })
                    } else {
                        const src = data[`${r},${minC + ((c - minC) % srcCols)}`]
                        if (src) setCellFull(r, c, { ...src }); else deleteCell(r, c)
                    }
                }
            }
            setSelectedRange({ start: { r: minR, c: minC }, end: { r: maxR, c: dragFillEnd.c } })
        }
    }, [selectionBounds, dragFillEnd, data, setCellFull, deleteCell, detectSequence])

    // ---- Context Menu Action ----
    const handleContextAction = useCallback((action: string) => {
        const r = contextMenu?.r ?? 0, c = contextMenu?.c ?? 0
        setContextMenu(null)
        switch (action) {
            case 'cut': doCut(); break; case 'copy': doCopy(); break; case 'paste': doPaste(); break
            case 'insertRowAbove': insertRow(r); break; case 'insertRowBelow': insertRow(r + 1); break
            case 'insertColLeft': insertColumn(c); break; case 'insertColRight': insertColumn(c + 1); break
            case 'deleteRow': deleteRow(r); break; case 'deleteCol': deleteColumn(c); break
            case 'sortAsc': sortColumn(c, true); break; case 'sortDesc': sortColumn(c, false); break
        }
    }, [contextMenu, doCut, doCopy, doPaste, insertRow, insertColumn, deleteRow, deleteColumn, sortColumn])

    // ---- Charts ----
    const openChart = useCallback((type: 'bar' | 'line' | 'pie') => {
        if (!selectionBounds) { toast.info('S\u00E9lectionnez des donn\u00E9es'); return }
        const values: number[] = []
        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++)
            for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                const ev = evaluatedData[`${r},${c}`] || data[`${r},${c}`]?.value || ''
                const n = Number(ev); if (!isNaN(n) && ev.trim() !== '') values.push(n)
            }
        if (values.length === 0) { toast.info('Aucune donn\u00E9e num\u00E9rique'); return }
        setChart({ type, values }); setShowChartPicker(false)
    }, [selectionBounds, evaluatedData, data])

    // ---- Pivot Table: insert as new sheet ----
    const handlePivotInsert = useCallback((name: string, gridData: Record<string, CellData>) => {
        const sheetName = `${name} ${sheets.length + 1}`
        addSheet(sheetName)
        // Write data to the new sheet after a short delay to allow Yjs to create it
        setTimeout(() => {
            setActiveSheetIndex(sheets.length)
            // The new sheet data will be written via the transact callback
            transact(() => {
                for (const [key, cellData] of Object.entries(gridData)) {
                    setCell(Number(key.split(',')[0]), Number(key.split(',')[1]), cellData.value)
                }
            })
        }, 100)
    }, [sheets, addSheet, setActiveSheetIndex, transact, setCell])

    // ---- Advanced Chart: insert floating chart ----
    const handleInsertChart = useCallback((config: any, parsed: any) => {
        const chartData = parsed.labels.map((label: string, i: number) => {
            const entry: Record<string, string | number> = { label }
            parsed.series.forEach((s: any) => { entry[s.name] = s.values[i] ?? 0 })
            return entry
        })
        const newChart = {
            id: `chart-${Date.now()}`,
            type: config.type,
            title: config.title || 'Graphique',
            chartData,
            seriesNames: parsed.series.map((s: any) => s.name),
            colors: config.colors,
            showLegend: config.showLegend,
        }
        setFloatingCharts(prev => [...prev, newChart])
    }, [])

    const handleRemoveFloatingChart = useCallback((id: string) => {
        setFloatingCharts(prev => prev.filter(c => c.id !== id))
    }, [])

    // ---- Find & Replace ----
    const navigateToFind = useCallback((idx: number) => {
        if (findMatches.length === 0) return
        const i = ((idx % findMatches.length) + findMatches.length) % findMatches.length
        setCurrentFindIdx(i)
        const m = findMatches[i]

        // Switch sheet if match is on a different sheet
        if (m.sheetIdx != null && m.sheetIdx !== activeSheetIndex) {
            setActiveSheetIndex(m.sheetIdx)
        }

        setActiveCell({ r: m.r, c: m.c }); setSelectedRange({ start: { r: m.r, c: m.c }, end: { r: m.r, c: m.c } })
        // Scroll into view (use setTimeout for cross-sheet nav so offsets are recalculated)
        const doScroll = () => {
            if (gridRef.current) {
                gridRef.current.scrollTop = Math.max(0, rowOffsets[m.r] - viewportH / 3)
                gridRef.current.scrollLeft = Math.max(0, colOffsets[m.c] - viewportW / 3)
            }
        }
        if (m.sheetIdx != null && m.sheetIdx !== activeSheetIndex) {
            setTimeout(doScroll, 150)
        } else {
            doScroll()
        }
    }, [findMatches, rowOffsets, colOffsets, viewportH, viewportW, activeSheetIndex, setActiveSheetIndex])

    const doReplace = useCallback(() => {
        if (findMatches.length === 0) return
        const m = findMatches[currentFindIdx]

        if (m.sheetIdx != null) {
            // Replace in specific sheet via Yjs
            const gridMap = doc.getMap<CellData>(`grid-${sheets[m.sheetIdx].id}`)
            const key = `${m.r},${m.c}`
            const cell = gridMap.get(key)
            const val = cell?.value || ''
            gridMap.set(key, { ...cell, value: val.replace(new RegExp(findText, 'i'), replaceText) })
        } else {
            const val = data[`${m.r},${m.c}`]?.value || ''
            setCell(m.r, m.c, val.replace(new RegExp(findText, 'i'), replaceText))
        }
    }, [findMatches, currentFindIdx, data, findText, replaceText, setCell, doc, sheets])

    const doReplaceAll = useCallback(() => {
        let count = 0
        doc.transact(() => {
            for (const m of findMatches) {
                if (m.sheetIdx != null) {
                    const gridMap = doc.getMap<CellData>(`grid-${sheets[m.sheetIdx].id}`)
                    const key = `${m.r},${m.c}`
                    const cell = gridMap.get(key)
                    const val = cell?.value || ''
                    gridMap.set(key, { ...cell, value: val.replace(new RegExp(findText, 'gi'), replaceText) })
                } else {
                    const val = data[`${m.r},${m.c}`]?.value || ''
                    setCell(m.r, m.c, val.replace(new RegExp(findText, 'gi'), replaceText))
                }
                count++
            }
        })
        toast.success(`${count} remplacement(s)`)
    }, [findMatches, data, findText, replaceText, setCell, doc, sheets])

    // ---- Autocomplete insert ----
    const insertAutocomplete = useCallback((fnName: string) => {
        const match = editValue.toUpperCase().match(/(?:^=|[(,+\-*/])([A-Z]{1,15})$/)
        if (match) {
            const partialLen = match[1].length
            const newValue = editValue.slice(0, editValue.length - partialLen) + fnName + '('
            setEditValue(newValue)
            if (activeCell) setCell(activeCell.r, activeCell.c, newValue)
        }
        setAutocompleteSuggestions([])
    }, [editValue, activeCell, setCell])

    // ---- File Import (CSV/XLSX) — delegated to import-xlsx module for fresh Turbopack compilation ----
    const importFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const arrayBuffer = await file.arrayBuffer();
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const importResult = await importXlsxToYjs(doc, arrayBuffer, ext);

            // Column widths and row heights are now stored per-sheet in Yjs by
            // importXlsxToYjs. Switching to the first sheet will load them via
            // the colWidths/rowHeights Yjs observer.
            setActiveSheetIndex(0);

            // Scroll to top-left and select A1 so imported data is immediately visible
            gridRef.current?.scrollTo(0, 0);
            setActiveCell({ r: 0, c: 0 });
            setSelectedRange(null);

            // Freeze first row by default (header row) for usability with large imports
            if (importResult.totalCells > 100) {
                setFreezeRows(1);
            }

            const sheetLabel = importResult.sheetCount > 1
                ? `${importResult.sheetCount} onglets (${importResult.sheetNames.join(', ')})`
                : '1 onglet';
            toast.success(`Import terminé : ${importResult.totalCells.toLocaleString('fr-FR')} cellules, ${sheetLabel}`, { duration: 5000 });
        } catch(err) {
            console.error('Import error:', err);
            toast.error("Erreur d'importation: " + (err instanceof Error ? err.message : 'Format invalide'));
        }
        e.target.value = ''
    }, [doc, setActiveSheetIndex])

    // ---- Build full workbook from all Yjs sheets (with styles & column widths) ----
    const buildFullWorkbook = useCallback(() => {
        const workbook = new ExcelJS.Workbook()

        for (const sheet of sheets) {
            const worksheet = workbook.addWorksheet(sheet.name)
            const gridMap = doc.getMap<CellData>(`grid-${sheet.id}`)
            const sheetData = gridMap.toJSON() as Record<string, CellData>

            // Write cells with values and styles
            for (const [key, cellData] of Object.entries(sheetData)) {
                if (!cellData) continue
                const [rStr, cStr] = key.split(',')
                const r = parseInt(rStr, 10) + 1 // ExcelJS is 1-based
                const c = parseInt(cStr, 10) + 1
                const cell = worksheet.getCell(r, c)

                // Set value — try to preserve numeric types
                const raw = cellData.value
                if (raw != null && raw !== '') {
                    const num = Number(raw)
                    cell.value = raw !== '' && !isNaN(num) && isFinite(num) ? num : raw
                }

                // Apply styles
                const s = cellData.style
                if (s) {
                    // Font
                    const font: Partial<ExcelJS.Font> = {}
                    if (s.bold) font.bold = true
                    if (s.italic) font.italic = true
                    if (s.underline) font.underline = true
                    if (s.strikethrough) font.strike = true
                    if (s.textColor) font.color = { argb: 'FF' + s.textColor.replace('#', '') }
                    if (s.fontFamily) font.name = s.fontFamily
                    if (s.fontSize) font.size = s.fontSize
                    if (Object.keys(font).length > 0) cell.font = font as ExcelJS.Font

                    // Fill
                    if (s.fillColor) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF' + s.fillColor.replace('#', '') },
                        }
                    }

                    // Alignment
                    const alignment: Partial<ExcelJS.Alignment> = {}
                    if (s.align) alignment.horizontal = s.align
                    if (s.verticalAlign) alignment.vertical = s.verticalAlign
                    if (s.wrap) alignment.wrapText = true
                    if (s.rotation && typeof s.rotation === 'number') alignment.textRotation = s.rotation
                    if (Object.keys(alignment).length > 0) cell.alignment = alignment as ExcelJS.Alignment

                    // Borders
                    const border: Partial<ExcelJS.Borders> = {}
                    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
                    if (s.borderTop) border.top = thinBorder
                    if (s.borderRight) border.right = thinBorder
                    if (s.borderBottom) border.bottom = thinBorder
                    if (s.borderLeft) border.left = thinBorder
                    if (Object.keys(border).length > 0) cell.border = border as ExcelJS.Borders

                    // Number format
                    if (s.numberFormat && s.numberFormat !== 'auto') {
                        const decimals = s.decimals ?? 2
                        const decPart = decimals > 0 ? '.' + '0'.repeat(decimals) : ''
                        switch (s.numberFormat) {
                            case 'currency': cell.numFmt = `#,##0${decPart} €`; break
                            case 'percent': cell.numFmt = `0${decPart}%`; break
                            case 'number': cell.numFmt = `#,##0${decPart}`; break
                            case 'date': cell.numFmt = 'DD/MM/YYYY'; break
                            case 'time': cell.numFmt = 'HH:MM:SS'; break
                            case 'datetime': cell.numFmt = 'DD/MM/YYYY HH:MM'; break
                            case 'scientific': cell.numFmt = `0${decPart}E+00`; break
                            case 'accounting': cell.numFmt = `_-* #,##0${decPart} €_-`; break
                        }
                    }

                    // Merged cells
                    if (s.mergeRows && s.mergeRows > 1 || s.mergeCols && s.mergeCols > 1) {
                        const mr = s.mergeRows || 1
                        const mc = s.mergeCols || 1
                        worksheet.mergeCells(r, c, r + mr - 1, c + mc - 1)
                    }
                }
            }

            // Apply column widths
            const cwMap = doc.getMap<number>(`colWidths-${sheet.id}`)
            cwMap.forEach((width, colStr) => {
                const col = parseInt(colStr, 10) + 1
                worksheet.getColumn(col).width = Math.round(width / 7.5) // px to Excel character units
            })

            // Apply row heights
            const rhMap = doc.getMap<number>(`rowHeights-${sheet.id}`)
            rhMap.forEach((height, rowStr) => {
                const row = parseInt(rowStr, 10) + 1
                worksheet.getRow(row).height = height * 0.75 // px to Excel points
            })
        }

        return workbook
    }, [doc, sheets])

    // ---- File Export (CSV/XLSX) ----
    const exportXLSX = useCallback(async (type: 'xlsx' | 'csv') => {
        try {
            const workbook = buildFullWorkbook()

            let buffer: ArrayBuffer
            let mimeType: string
            let filename: string

            if (type === 'csv') {
                // CSV only supports one sheet — export active sheet
                const activeWs = workbook.getWorksheet(sheets[activeSheetIndex]?.name || 'Sheet1')
                const csvWorkbook = new ExcelJS.Workbook()
                const csvSheet = csvWorkbook.addWorksheet('Sheet1')
                if (activeWs) {
                    activeWs.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                        csvSheet.getRow(rowNumber).values = row.values as ExcelJS.CellValue[]
                    })
                }
                buffer = await csvWorkbook.csv.writeBuffer() as ArrayBuffer
                mimeType = 'text/csv'
                filename = `${documentName || sheets[activeSheetIndex]?.name || 'document'}.csv`
            } else {
                buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                filename = `${documentName || 'document'}.xlsx`
            }

            const blob = new Blob([buffer], { type: mimeType })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`Exporté en ${type.toUpperCase()} (${sheets.length} onglet${sheets.length > 1 ? 's' : ''})`)
        } catch (err) {
            console.error('Export error:', err)
            toast.error(`Erreur d'export ${type.toUpperCase()}`)
        }
    }, [buildFullWorkbook, sheets, activeSheetIndex, documentName])

    // ---- Save To Drive ----
    const saveToDrive = useCallback(async () => {
        if (!documentName) {
            toast.error("Impossible d'enregistrer: Le nom du fichier est manquant.");
            return;
        }

        const tId = toast.loading("Enregistrement dans le Drive...");

        try {
            const workbook = buildFullWorkbook()

            // Créer un blob type XLSX
            const wbout = await workbook.xlsx.writeBuffer();
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // Envoyer à l'API backend
            const targetKey = `${documentId}.xlsx`;
            await storageApi.uploadWithKey('drive', targetKey, blob);

            toast.success("Enregistré avec succès !", { id: tId });
        } catch(err: any) {
            console.error("Erreur enregistrement spreadsheet", err);
            toast.error("Erreur d'enregistrement: " + err.message, { id: tId });
        }
    }, [buildFullWorkbook, documentName, documentId]);

    // ---- Cell interactions ----
    const commitEdit = () => {
        if (activeCell) { setCell(activeCell.r, activeCell.c, editValue); setIsEditing(false) }
    }

    const scrollToCell = useCallback((r: number, c: number) => {
        if (!gridRef.current) return
        const top = rowOffsets[r], left = colOffsets[c]
        const h = getRowHeight(r), w = getColWidth(c)
        const g = gridRef.current
        if (top < g.scrollTop + (freezeRows > 0 ? rowOffsets[freezeRows] : 0)) g.scrollTop = Math.max(0, top - (freezeRows > 0 ? rowOffsets[freezeRows] : 0))
        else if (top + h > g.scrollTop + viewportH) g.scrollTop = top + h - viewportH + 4
        if (left < g.scrollLeft + (freezeCols > 0 ? colOffsets[freezeCols] : 0)) g.scrollLeft = Math.max(0, left - (freezeCols > 0 ? colOffsets[freezeCols] : 0))
        else if (left + w > g.scrollLeft + viewportW) g.scrollLeft = left + w - viewportW + 4
    }, [rowOffsets, colOffsets, viewportH, viewportW, freezeRows, freezeCols])

    const moveCell = useCallback((dr: number, dc: number) => {
        if (!activeCell) return
        const nr = Math.max(0, Math.min(effectiveRows - 1, activeCell.r + dr))
        const nc = Math.max(0, Math.min(COLS - 1, activeCell.c + dc))
        setActiveCell({ r: nr, c: nc })
        setSelectedRange({ start: { r: nr, c: nc }, end: { r: nr, c: nc } })
        scrollToCell(nr, nc)
        setTimeout(() => mainContainerRef.current?.focus({ preventScroll: true }), 0)
    }, [activeCell, scrollToCell, effectiveRows])

    // Ctrl+Arrow: jump to next non-empty / empty boundary
    const jumpCell = useCallback((dr: number, dc: number) => {
        if (!activeCell) return
        let { r, c } = activeCell
        const currentHasData = !!data[`${r},${c}`]?.value
        for (let i = 0; i < 200; i++) {
            const nr = r + dr, nc = c + dc
            if (nr < 0 || nr >= effectiveRows || nc < 0 || nc >= COLS) break
            r = nr; c = nc
            const hasData = !!data[`${r},${c}`]?.value
            if (currentHasData && !hasData) break
            if (!currentHasData && hasData) break
        }
        setActiveCell({ r, c })
        setSelectedRange({ start: { r, c }, end: { r, c } })
        scrollToCell(r, c)
    }, [activeCell, data, scrollToCell, effectiveRows])

    // Find last cell with data
    const findLastDataCell = useCallback((): { r: number, c: number } => {
        let maxR = 0, maxC = 0
        for (const key of Object.keys(data)) {
            const [r, c] = key.split(',').map(Number)
            if (r > maxR) maxR = r; if (c > maxC) maxC = c
        }
        return { r: maxR, c: maxC }
    }, [data])

    const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (isEditing) {
            const isOtherSheet = e.currentTarget.closest('[data-sheet-id]')?.getAttribute('data-sheet-id') !== sheets[activeSheetIndex].id
            // Currently handled by not preventing default and typing manually, or by custom logic elsewhere.
            commitEdit()
        }
        setIsEditing(false); setIsDragging(true)
        if (paintFormat) { setCellStyle(r, c, paintFormat); setPaintFormat(null); return }
        if (e.shiftKey && activeCell) setSelectedRange({ start: activeCell, end: { r, c } })
        else { setActiveCell({ r, c }); setSelectedRange({ start: { r, c }, end: { r, c } }) }
        
        // Force focus sur le conteneur pour garantir la capture des flèches directionnelles
        mainContainerRef.current?.focus({ preventScroll: true })
    }

    const handleCellMouseEnter = (r: number, c: number) => {
        if (isDragging && selectedRange) setSelectedRange({ ...selectedRange, end: { r, c } })
    }

    const handleDoubleClick = (r: number, c: number) => {
        if (data[`${r},${c}`]?.style?.locked) { toast.info('Cellule verrouill\u00E9e'); return }
        const cell = data[`${r},${c}`]
        setActiveCell({ r, c }); setSelectedRange({ start: { r, c }, end: { r, c } })
        setEditValue(cell?.formula || cell?.value || "")
        setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleContextMenu = (r: number, c: number, e: React.MouseEvent) => {
        e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, r, c })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey)) {
            if (e.key === 'z') { e.preventDefault(); undo(); return }
            if (e.key === 'y') { e.preventDefault(); redo(); return }
            if (e.key === 'c') { e.preventDefault(); doCopy(); return }
            if (e.key === 'x') { e.preventDefault(); doCut(); return }
            if (e.key === 'v') { e.preventDefault(); doPaste(); return }
            if (e.key === 'f') { e.preventDefault(); setShowFind(true); setShowReplaceToggle(false); return }
            if (e.key === 'h') { e.preventDefault(); setShowFind(true); setShowReplaceToggle(true); return }
            if (e.key === 's') { e.preventDefault(); if (documentName) { saveToDrive(); } else { toast.success('Enregistré automatiquement'); } return }
            if (e.key === 'n') { e.preventDefault(); window.open('/sheets', '_blank'); return }
            if (e.key === 'o') { e.preventDefault(); toast.info("Rendez-vous sur l'accueil Drive pour ouvrir un fichier."); return }
            if (e.key === 'q') { e.preventDefault(); toast.info("Fermez l'onglet du navigateur pour quitter la session."); return }
            if (e.key === 'a') {
                e.preventDefault();
                setIsEditing(false);
                commitEdit();
                setActiveCell({ r: 0, c: 0 });
                setSelectedRange({ start: { r: 0, c: 0 }, end: { r: effectiveRows - 1, c: COLS - 1 } });
                return;
            }
            // Ctrl+B/I/U/5 → formatting shortcuts (work in both edit and navigation mode)
            if (e.key === 'b') { e.preventDefault(); toggleBoolFormat('bold'); return }
            if (e.key === 'i') { e.preventDefault(); toggleBoolFormat('italic'); return }
            if (e.key === 'u') { e.preventDefault(); toggleBoolFormat('underline'); return }
            if (e.key === '5') { e.preventDefault(); toggleBoolFormat('strikethrough'); return }
            if (!isEditing) {
                // Ctrl+Espace -> Sélectionner la colonne entière
                if (e.key === ' ') {
                    e.preventDefault();
                    if (activeCell) {
                        setActiveCell({ r: 0, c: activeCell.c });
                        setSelectedRange({ start: { r: 0, c: activeCell.c }, end: { r: effectiveRows - 1, c: activeCell.c } });
                    }
                    return;
                }
                if (e.key === 'p') { e.preventDefault(); window.print(); return }
                // Ctrl+Home → A1
                if (e.key === 'Home') { e.preventDefault(); setActiveCell({ r: 0, c: 0 }); setSelectedRange({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } }); scrollToCell(0, 0); return }
                // Ctrl+End → last data cell
                if (e.key === 'End') { e.preventDefault(); const last = findLastDataCell(); setActiveCell(last); setSelectedRange({ start: last, end: last }); scrollToCell(last.r, last.c); return }
                // Ctrl+Arrows → jump to data boundary
                if (e.key === 'ArrowUp') { e.preventDefault(); jumpCell(-1, 0); return }
                if (e.key === 'ArrowDown') { e.preventDefault(); jumpCell(1, 0); return }
                if (e.key === 'ArrowLeft') { e.preventDefault(); jumpCell(0, -1); return }
                if (e.key === 'ArrowRight') { e.preventDefault(); jumpCell(0, 1); return }
            }
        }

        if (isEditing) {
            // F4: toggle absolute reference ($A$1 cycle)
            if (e.key === 'F4') {
                e.preventDefault()
                const input = inputRef.current || formulaBarRef.current
                if (!input) return
                const pos = input.selectionStart || 0
                const refRegex = /(\$?)([A-Z]+)(\$?)(\d+)/g
                let match
                while ((match = refRegex.exec(editValue)) !== null) {
                    if (match.index <= pos && match.index + match[0].length >= pos) {
                        const [, d1, col, d2, row] = match
                        let newRef: string
                        if (!d1 && !d2) newRef = `$${col}$${row}`
                        else if (d1 && d2) newRef = `${col}$${row}`
                        else if (!d1 && d2) newRef = `$${col}${row}`
                        else newRef = `${col}${row}`
                        const newValue = editValue.substring(0, match.index) + newRef + editValue.substring(match.index + match[0].length)
                        setEditValue(newValue)
                        const newPos = match.index + newRef.length
                        setTimeout(() => input.setSelectionRange(newPos, newPos), 0)
                        break
                    }
                }
                return
            }
            // Autocomplete navigation
            if (autocompleteSuggestions.length > 0) {
                if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteSuggestions.length > 0)) {
                    e.preventDefault(); insertAutocomplete(autocompleteSuggestions[autocompleteIdx]); return
                }
                if (e.key === 'ArrowDown') { e.preventDefault(); setAutocompleteIdx(i => Math.min(i + 1, autocompleteSuggestions.length - 1)); return }
                if (e.key === 'ArrowUp') { e.preventDefault(); setAutocompleteIdx(i => Math.max(i - 1, 0)); return }
                if (e.key === 'Escape') { e.preventDefault(); setAutocompleteSuggestions([]); return }
            }
            if (e.altKey && e.key === 'Enter') {
                e.preventDefault();
                setEditValue(prev => prev + '\n');
                return;
            }
            if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); commitEdit(); moveCell(-1, 0); return; }
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); moveCell(1, 0) }
            if (e.key === 'Tab') { e.preventDefault(); commitEdit(); moveCell(0, e.shiftKey ? -1 : 1) }
            if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false); const cellEsc = data[`${activeCell!.r},${activeCell!.c}`]; setEditValue(cellEsc?.formula || cellEsc?.value || ""); setAutocompleteSuggestions([]) }
            
            if (e.key === 'ArrowUp') { e.preventDefault(); commitEdit(); moveCell(-1, 0) }
            if (e.key === 'ArrowDown') { e.preventDefault(); commitEdit(); moveCell(1, 0) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); commitEdit(); moveCell(0, -1) }
            if (e.key === 'ArrowRight') { e.preventDefault(); commitEdit(); moveCell(0, 1) }
            
            return
        }

        if (!activeCell) return
        
        // Maj + Espace -> Sélectionner la ligne entière
        if (e.shiftKey && e.key === ' ') {
            e.preventDefault();
            setActiveCell({ r: activeCell.r, c: 0 });
            setSelectedRange({ start: { r: activeCell.r, c: 0 }, end: { r: activeCell.r, c: COLS - 1 } });
            return;
        }

        // Maj + Flèches -> Étendre la sélection
        if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            let dr = 0, dc = 0;
            if (e.key === 'ArrowUp') dr = -1;
            if (e.key === 'ArrowDown') dr = 1;
            if (e.key === 'ArrowLeft') dc = -1;
            if (e.key === 'ArrowRight') dc = 1;

            if (selectedRange) {
                const newR = Math.max(0, Math.min(effectiveRows - 1, selectedRange.end.r + dr));
                const newC = Math.max(0, Math.min(COLS - 1, selectedRange.end.c + dc));
                setSelectedRange({ start: selectedRange.start, end: { r: newR, c: newC } });
                scrollToCell(newR, newC);
            }
            return;
        }

        if (e.key === 'ArrowUp') { e.preventDefault(); moveCell(-1, 0) }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveCell(1, 0) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCell(0, -1) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); moveCell(0, 1) }
        else if (e.key === 'Tab') { e.preventDefault(); moveCell(0, e.shiftKey ? -1 : 1) }
        else if (e.key === 'Enter') {
            e.preventDefault()
            const cellE = data[`${activeCell.r},${activeCell.c}`]
            if (cellE?.style?.locked) { toast.info('Cellule verrouill\u00E9e'); return }
            setEditValue(cellE?.formula || cellE?.value || "")
            setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0)
        }
        else if (e.key === 'Home') { e.preventDefault(); const r = activeCell.r; setActiveCell({ r, c: 0 }); setSelectedRange({ start: { r, c: 0 }, end: { r, c: 0 } }); scrollToCell(r, 0) }
        else if (e.key === 'End') { e.preventDefault(); const r = activeCell.r; let lastC = COLS - 1; while (lastC > 0 && !data[`${r},${lastC}`]?.value) lastC--; setActiveCell({ r, c: lastC }); setSelectedRange({ start: { r, c: lastC }, end: { r, c: lastC } }); scrollToCell(r, lastC) }
        else if (e.key === 'PageDown') { e.preventDefault(); const rows = Math.floor(viewportH / DEFAULT_ROW_HEIGHT); moveCell(rows, 0) }
        else if (e.key === 'PageUp') { e.preventDefault(); const rows = Math.floor(viewportH / DEFAULT_ROW_HEIGHT); moveCell(-rows, 0) }
        else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            if (selectionBounds) deleteCellRange(selectionBounds.minR, selectionBounds.maxR, selectionBounds.minC, selectionBounds.maxC)
        } else if (e.key === 'F2') {
            e.preventDefault()
            const cellF2 = data[`${activeCell.r},${activeCell.c}`]
            if (cellF2?.style?.locked) { toast.info('Cellule verrouill\u00E9e'); return }
            setEditValue(cellF2?.formula || cellF2?.value || "")
            setIsEditing(true); setTimeout(() => inputRef.current?.focus(), 0)
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (data[`${activeCell.r},${activeCell.c}`]?.style?.locked) { toast.info('Cellule verrouill\u00E9e'); return }
            setIsEditing(true); setEditValue(e.key); setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    // ---- Filter helpers ----
    const isRowVisible = (r: number): boolean => {
        if (filterCol === null || !filterValues) return true
        return filterValues.has(data[`${r},${filterCol}`]?.value || '')
    }

    const toggleFilter = useCallback(() => {
        if (filterCol !== null) { setFilterCol(null); setFilterValues(null); toast.info('Filtre d\u00E9sactiv\u00E9'); return }
        if (!activeCell) return
        setFilterCol(activeCell.c)
        setShowFilterDialog(true)
    }, [activeCell, filterCol])

    // ---- Merge helper ----
    const handleMerge = useCallback(() => {
        if (!selectionBounds) return
        const { minR, maxR, minC, maxC } = selectionBounds
        const topLeft = data[`${minR},${minC}`]
        if (topLeft?.style?.mergeRows) { unmergeCells(minR, minC); toast.info('D\u00E9fusionn\u00E9') }
        else { mergeCells(minR, maxR, minC, maxC); toast.success('Fusionn\u00E9') }
    }, [selectionBounds, data, mergeCells, unmergeCells])

    // ---- Column auto-fit ----
    const autoFitColumn = useCallback((col: number) => {
        let maxWidth = 40 // minimum width
        // Iterate only existing data keys for this column (sparse)
        for (const key of Object.keys(data)) {
            const c = parseInt(key.split(',')[1], 10)
            if (c !== col) continue
            const cellVal = evaluatedData[key] || data[key]?.value || ''
            if (cellVal) {
                // Estimate character width (~7.5px per char at 13px font, plus 16px padding)
                const fontSize = data[key]?.style?.fontSize || 13
                const charWidth = fontSize * 0.6
                const width = cellVal.length * charWidth + 16
                if (width > maxWidth) maxWidth = width
            }
        }
        maxWidth = Math.min(maxWidth, 400) // cap at 400px
        const finalWidth = Math.ceil(maxWidth)
        setColWidths(prev => ({ ...prev, [col]: finalWidth }))
        persistColWidth(col, finalWidth)
        toast.success(`Colonne ${indexToCol(col)} ajustée`)
    }, [data, evaluatedData, persistColWidth])

    // ---- Freeze toggle ----
    const toggleFreeze = useCallback(() => {
        if (freezeRows > 0 || freezeCols > 0) { setFreezeRows(0); setFreezeCols(0); toast.info('Figer d\u00E9sactiv\u00E9'); return }
        if (!activeCell) return
        setFreezeRows(activeCell.r); setFreezeCols(activeCell.c)
        toast.success(`Fig\u00E9: ${activeCell.r} ligne(s), ${activeCell.c} colonne(s)`)
    }, [activeCell, freezeRows, freezeCols])

    // ---- Scroll handler ----
    const handleScroll = useCallback(() => {
        if (!gridRef.current) return
        setScrollTop(gridRef.current.scrollTop)
        setScrollLeft(gridRef.current.scrollLeft)
    }, [])

    // IDEA-017: CSV drag-drop import
    const handleGridDragOver = useCallback((e: React.DragEvent) => {
        const hasFile = Array.from(e.dataTransfer.items).some(i => i.kind === 'file')
        if (hasFile) { e.preventDefault(); setIsDragOver(true) }
    }, [])

    const handleGridDragLeave = useCallback(() => setIsDragOver(false), [])

    const handleGridDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.csv') || f.name.endsWith('.tsv') || f.name.endsWith('.txt'))
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            if (!text) return
            const sep = file.name.endsWith('.tsv') ? '\t' : ','
            const rows = text.split(/\r?\n/)
            const startR = activeCell?.r ?? 0
            const startC = activeCell?.c ?? 0
            transact(() => {
                rows.forEach((row, ri) => {
                    const cols = row.split(sep)
                    cols.forEach((val, ci) => {
                        if (val.trim()) setCell(startR + ri, startC + ci, val.trim())
                    })
                })
            })
            toast.success(`CSV importé: ${rows.length} ligne(s) depuis ${file.name}`)
        }
        reader.readAsText(file)
    }, [activeCell, setCell, transact])

    // ============================================================
    // RENDER
    // ============================================================
    const { startR, endR } = visibleRows
    const { startC, endC } = visibleCols

    return (
        <div ref={mainContainerRef} className={cn("spreadsheet-root w-full h-full flex flex-col bg-background dark:bg-[#1f1f1f] text-[#202124] dark:text-[#e8eaed] outline-none font-sans text-sm select-none", paintFormat && "cursor-cell")} tabIndex={0} onKeyDown={handleKeyDown}>

            {/* Print-friendly layout — hide chrome, show all rows */}
            <style>{`
                @media print {
                    body { background: white !important; }
                    /* Hide menu bar, toolbar, formula bar, sheet tabs, and app shell */
                    nav, header, .sidebar,
                    [data-print-hide],
                    [data-sheet-tabs] {
                        display: none !important;
                    }
                    .spreadsheet-root {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    /* Make the grid container visible without clipping */
                    .spreadsheet-root > div[class*="overflow-auto"] {
                        overflow: visible !important;
                        height: auto !important;
                        transform: none !important;
                    }
                    /* Show all cell content, no clipping */
                    [style*="overflow: hidden"] {
                        overflow: visible !important;
                    }
                    /* Hide scrollbars */
                    ::-webkit-scrollbar { display: none !important; }
                    /* Preserve cell background colors */
                    td, th, [role="gridcell"], div {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>

            {/* ===== MENU BAR ===== */}
            <div data-print-hide className="-ml-1.5 flex flex-col pt-0.5">
                <EditorMenu menus={[
        {
            id: 'file', label: 'Fichier', items: [
                { label: 'Nouveau', subItems: [
                    { label: 'Feuille de calcul', action: 'new' },
                    { label: 'À partir d\'un modèle', action: 'templates' }
                ] },
                { label: 'Ouvrir', action: 'open', shortcut: 'Ctrl+O' },
                { label: 'Importer', action: 'import' },
                { label: 'Créer une copie', action: 'copyFile' },
                { sep: true },
                { label: 'Envoyer par e-mail', action: 'email_send' },
                { label: 'Télécharger', subItems: [
                    { label: 'Microsoft Excel (.xlsx)', action: 'export_xlsx' },
                    { label: 'Valeurs séparées par des virgules (.csv)', action: 'export_csv' },
                    { label: 'Document PDF (.pdf)', action: 'print' },
                { label: 'Aperçu avant impression', action: 'print_preview' }
                ] },
                { label: 'Approbations', action: 'approvals' },
                { sep: true },
                { label: 'Renommer', action: 'rename' },
                { label: 'Placer dans la corbeille', action: 'trash' },
                { sep: true },
                { label: 'Historique des versions', subItems: [
                    { label: 'Nommer la version actuelle', action: 'name_version' },
                    { label: 'Afficher l\'historique des versions', action: 'version_history' }
                ] },
                { label: 'Rendre disponible hors connexion', action: 'offline_mode' },
                { sep: true },
                { label: 'Détails', action: 'file_details' },
                { label: 'Limites de sécurité', action: 'security_limits' },
                { label: 'Paramètres', action: 'file_settings' }
            ]
        },
        {
            id: 'edit', label: 'Édition', items: [
                { label: 'Annuler', action: 'undo', shortcut: 'Ctrl+Z' },
                { label: 'Rétablir', action: 'redo', shortcut: 'Ctrl+Y' },
                { sep: true },
                { label: 'Couper', action: 'cut', shortcut: 'Ctrl+X' },
                { label: 'Copier', action: 'copy', shortcut: 'Ctrl+C' },
                { label: 'Coller', action: 'paste', shortcut: 'Ctrl+V' },
                { sep: true },
                { label: 'Rechercher et remplacer', action: 'find', shortcut: 'Ctrl+H' }
            ]
        },
        {
            id: 'view', label: 'Affichage', items: [
                { label: 'Afficher', subItems: [
                    { label: 'Barre de formules', action: 'toggleFormulaBar' },
                    { label: 'Quadrillage', action: 'toggleGridlines' },
                    { label: 'Plages protégées', action: 'protected_ranges' }
                ] },
                { label: 'Figer', subItems: [
                    { label: 'Figer la première ligne', action: 'freezeRow' },
                    { label: 'Figer la première colonne', action: 'freezeCol' },
                    { label: 'Libérer les lignes', action: 'unfreezeRow' },
                    { label: 'Libérer les colonnes', action: 'unfreezeCol' }
                ] },
                { label: 'Regrouper', subItems: [
                    { label: 'Associer lignes/colonnes', action: 'group_rows_cols' },
                    { label: 'Dissocier lignes/colonnes', action: 'ungroup_rows_cols' }
                ] },
                { label: 'Commentaires', action: 'show_comments' },
                { sep: true },
                { label: 'Feuilles masquées', action: 'hidden_sheets' },
                { sep: true },
                { label: 'Zoom', subItems: [
                    { label: '50%', action: 'zoom50' },
                    { label: '75%', action: 'zoom75' },
                    { label: '100%', action: 'zoom100' },
                    { label: '125%', action: 'zoom125' },
                    { label: '150%', action: 'zoom150' },
                    { label: '200%', action: 'zoom200' }
                ] },
                { label: 'Plein écran', action: 'fullScreen' },
                { sep: true },
                { label: isReadOnly ? 'Passer en Édition' : 'Mode Lecture', action: 'toggle_read_only' }
            ]
        },
        {
            id: 'insert', label: 'Insertion', items: [
                { label: 'Cellules', subItems: [
                    { label: 'Décaler vers la droite', action: 'shift_cells_right' },
                    { label: 'Décaler vers le bas', action: 'shift_cells_down' }
                ] },
                { label: 'Lignes', subItems: [
                    { label: 'Insérer 1 ligne au-dessus', action: 'insertRowAbove' },
                    { label: 'Insérer 1 ligne en-dessous', action: 'insertRowBelow' }
                ] },
                { label: 'Colonnes', subItems: [
                    { label: 'Insérer 1 colonne à gauche', action: 'insertColLeft' },
                    { label: 'Insérer 1 colonne à droite', action: 'insertColRight' }
                ] },
                { label: 'Feuille', action: 'insertSheet', shortcut: 'Maj+F11' },
                { sep: true },
                { label: 'Générer un tableau', action: 'generate_table' },
                { label: 'Tableaux prédéfinis', action: 'preset_tables' },
                { sep: true },
                { label: 'Chronologie', action: 'insert_timeline' },
                { label: 'Graphique (simple)', action: 'chart' },
                { label: 'Graphique avance', action: 'chartDialog' },
                { label: 'Tableau croise dynamique', action: 'pivot_table' },
                { label: 'Image', subItems: [
                    { label: 'Insérer une image dans la cellule', action: 'image_in_cell' },
                    { label: 'Insérer une image sur les cellules', action: 'image_over_cells' }
                ] },
                { label: 'Dessin', action: 'insert_drawing' },
                { sep: true },
                { label: 'Fonction', subItems: [
                    { label: 'SUM', action: 'insertSum' },
                    { label: 'AVERAGE', action: 'insertAvg' },
                    { label: 'COUNT', action: 'insertCount' },
                    { label: 'MAX', action: 'insertMax' },
                    { label: 'MIN', action: 'insertMin' }
                ] },
                { label: 'Lien', action: 'link', shortcut: 'Ctrl+K' },
                { sep: true },
                { label: 'Case à cocher', action: 'insertCheckbox' },
                { label: 'Liste déroulante', action: 'validation' }
            ]
        },
        {
            id: 'format', label: 'Format', items: [
                { label: 'Nombre', subItems: [
                    { label: 'Automatique', action: 'formatAuto' },
                    { label: 'Texte brut', action: 'formatText' },
                    { label: 'Nombre', action: 'formatNumber' },
                    { label: 'Pourcentage', action: 'formatPercent' },
                    { label: 'Scientifique', action: 'formatScientific' },
                    { sep: true },
                    { label: 'Comptabilité', action: 'formatAccounting' },
                    { label: 'Finances', action: 'formatFinance' },
                    { label: 'Devise', action: 'formatCurrency' },
                    { label: 'Devise (arrondie)', action: 'formatCurrencyRounded' },
                    { sep: true },
                    { label: 'Date', action: 'formatDate' },
                    { label: 'Heure', action: 'formatTime' },
                    { label: 'Date et heure', action: 'formatDateTime' },
                    { label: 'Durée', action: 'formatDuration' },
                    { sep: true },
                    { label: 'Autres formats', action: 'format_custom' }
                ]},
                { label: 'Retour à la ligne', subItems: [
                    { label: 'Débordement', action: 'overflowText' },
                    { label: 'Retour à la ligne', action: 'wrapText' },
                    { label: 'Tronquer', action: 'truncateText' }
                ]},
                { label: 'Rotation du texte', subItems: [
                    { label: 'Aucune', action: 'rotateNone' },
                    { label: 'Incliner vers le haut', action: 'rotateTiltUp' },
                    { label: 'Incliner vers le bas', action: 'rotateTiltDown' },
                    { label: 'Rotation vers le haut', action: 'rotateUp' },
                    { label: 'Rotation vers le bas', action: 'rotateDown' },
                    { label: 'Empiler verticalement', action: 'rotateVertical' }
                ]},
                { sep: true },
                { label: 'Fusionner les cellules', subItems: [
                    { label: 'Fusionner toutes les cellules', action: 'mergeCellsAll' },
                    { label: 'Fusionner horizontalement', action: 'mergeCellsHoriz' },
                    { label: 'Fusionner verticalement', action: 'mergeCellsVert' },
                    { label: 'Annuler la fusion', action: 'unmergeCellsAction' }
                ] },
                { sep: true },
                { label: 'Convertir en tableau', action: 'convert_to_table', shortcut: 'Ctrl+Alt+T' },
                { label: 'Mise en forme conditionnelle', action: 'condFormat' },
                { label: 'M.E.F. conditionnelle avancée', action: 'advanced_cond_format' },
                { label: 'Couleurs en alternance', action: 'bandedRows' },
                { sep: true },
                { label: 'Effacer la mise en forme', action: 'clearFormat', shortcut: 'Ctrl+\\' }
            ]
        },
        {
            id: 'data', label: 'Données', items: [
                { label: 'Analyser les données', action: 'analyze_data' },
                { sep: true },
                { label: 'Trier une feuille', subItems: [
                    { label: 'Trier la feuille de A à Z', action: 'sortAsc' },
                    { label: 'Trier la feuille de Z à A', action: 'sortDesc' }
                ] },
                { label: 'Trier une plage', subItems: [
                    { label: 'Trier la plage de A à Z', action: 'sortAsc' },
                    { label: 'Trier la plage de Z à A', action: 'sortDesc' }
                ] },
                { sep: true },
                { label: 'Créer un filtre', action: 'filter' },
                { label: 'Créer une vue avec critère de regroupement', subItems: [{label: 'Nouvelle vue de regroupement', action: 'group_view'}] },
                { label: 'Créer une vue filtrée', action: 'filtered_view' },
                { label: 'Ajouter un segment', action: 'add_slicer' },
                { sep: true },
                { label: 'Protéger des feuilles et des plages', action: 'protect_sheets' },
                { label: 'Plages nommées', action: 'named_ranges' },
                { label: 'Fonctions nommées', action: 'named_functions' },
                { label: 'Plage aléatoire', action: 'random_range' },
                { sep: true },
                { label: 'Statistiques de colonne', action: 'column_stats' },
                { label: 'Validation des données', action: 'validation' },
                { label: 'Validation avancée', action: 'advanced_validation' },
                { label: 'Nettoyage des données', subItems: [
                    { label: 'Suggestions de nettoyage', action: 'cleanup_suggestions' },
                    { label: 'Supprimer les doublons', action: 'remove_duplicates' },
                    { label: 'Supprimer les espaces', action: 'trim_whitespace' }
                ] },
                { label: 'Scinder le texte en colonnes', action: 'split_text' }
            ]
        },
        {
            id: 'tools', label: 'Outils', items: [
                { label: 'Créer un formulaire', action: 'create_form' },
                { label: 'Orthographe', subItems: [
                    { label: 'Vérification orthographique', action: 'spell_check' },
                    { label: 'Dictionnaire personnel', action: 'personal_dictionary' }
                ] },
                { label: 'Commandes des suggestions', subItems: [{label: 'Activer la suggestion automatique', action: 'auto_complete_settings'}] },
                { label: 'Notifications conditionnelles', action: 'conditional_notifications' },
                { sep: true },
                { label: 'Paramètres de notification', subItems: [
                    { label: 'M\'informer des modifications', action: 'notify_changes' }
                ] },
                { label: 'Accessibilité', action: 'accessibility_settings' },
                { sep: true },
                { label: 'Tableau de bord des activités', action: 'activity_dashboard' }
            ]
        },
        {
            id: 'gemini', label: 'Gemini', items: [
                { label: 'Analyser les données', action: 'ai_analyze' },
                { sep: true },
                { label: 'Générer des graphiques', action: 'ai_charts' },
                { label: 'Générer un tableau croisé dynamique', action: 'ai_pivot' },
                { label: 'Générer un tableau', action: 'ai_table' },
                { label: 'Générer une image', action: 'ai_image' },
                { label: 'Générer une formule', action: 'ai_formula' },
                { sep: true },
                { label: 'Résumer du texte', action: 'ai_summarize' },
                { label: 'Classer du texte', action: 'ai_classify' },
                { label: 'Analyser les sentiments', action: 'ai_sentiment' },
                { label: 'Générer du texte', action: 'ai_generate' },
                { sep: true },
                { label: 'Poser une question', action: 'gemini' }
            ]
        },
        {
            id: 'extensions', label: 'Extensions', items: [
                { label: 'Modules complémentaires', subItems: [{label: 'Télécharger des modules complémentaires', action: 'add_ons'} ] },
                { label: 'Macros', subItems: [
                    {label: 'Editeur de macros', action: 'macroEditor'},
                    {label: 'Enregistrer une macro', action: 'record_macro'}
                ] },
                { label: 'Apps Script', action: 'apps_script' },
                { label: 'AppSheet', subItems: [{label: 'Créer une application', action: 'create_app'} ] }
            ]
        },
        {
            id: 'help', label: 'Aide', items: [
                { label: 'Rechercher dans les menus', shortcut: 'Alt+/' },
                { sep: true },
                { label: 'Demandez de l\'aide à Gemini', action: 'gemini' },
                { label: 'Aide de Sheets', action: 'help_docs' },
                { label: 'Aidez-nous à améliorer Sheets', action: 'send_feedback' },
                { sep: true },
                { label: 'Liste des fonctions', action: 'functions_list' },
                { label: 'Raccourcis clavier', action: 'keyboard_shortcuts' }
            ]
        }
    ]} onAction={(action, label) => {
                const NATIVE_ACTIONS = ['new', 'open', 'import', 'export_xlsx', 'export_csv', 'print', 'rename', 'trash', 'fullScreen', 'copyFile', 'undo', 'redo', 'cut', 'copy', 'paste', 'find', 'toggleGridlines', 'freezeRow', 'freezeCol', 'insertRowAbove', 'insertRowBelow', 'insertColLeft', 'insertColRight', 'chart', 'link', 'comment', 'bold', 'italic', 'underline', 'strikethrough', 'alignLeft', 'alignCenter', 'alignRight', 'clearFormat', 'unfreezeRow', 'unfreezeCol', 'zoom50', 'zoom75', 'zoom100', 'zoom125', 'zoom150', 'zoom200', 'toggleFormulaBar', 'insertSum', 'insertAvg', 'insertCount', 'insertMax', 'insertMin', 'condFormat', 'bandedRows', 'sortAsc', 'sortDesc', 'filter', 'validation', 'gemini', 'toggle_read_only', 'insertCheckbox', 'wrapText', 'overflowText', 'truncateText', 'mergeCellsAll', 'mergeCellsHoriz', 'mergeCellsVert', 'unmergeCellsAction', 'insertSheet', 'formatAuto', 'formatText', 'formatNumber', 'formatPercent', 'formatScientific', 'formatAccounting', 'formatFinance', 'formatCurrency', 'formatCurrencyRounded', 'formatDate', 'formatTime', 'formatDateTime', 'formatDuration', 'rotateNone', 'rotateTiltUp', 'rotateTiltDown', 'rotateUp', 'rotateDown', 'rotateVertical', 'pivot_table', 'chartDialog', 'macroEditor'];
                
                if (action === 'todo' || !NATIVE_ACTIONS.includes(action)) {
                    setActiveModal({ id: action, label });
                    return;
                }

                if (action === 'insertCheckbox') {
                    if (selectionBounds) {
                        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++) {
                            for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                                setCellValidation(r, c, { type: 'boolean' });
                                if (!data[`${r},${c}`]?.value) setCell(r, c, 'FALSE');
                            }
                        }
                    } else if (activeCell) {
                        setCellValidation(activeCell.r, activeCell.c, { type: 'boolean' });
                        if (!data[`${activeCell.r},${activeCell.c}`]?.value) setCell(activeCell.r, activeCell.c, 'FALSE');
                    }
                    return;
                }
                if (action === 'wrapText') { applyToSelection({ wrap: true }); return; }
                if (action === 'overflowText') { applyToSelection({ wrap: false }); return; }
                if (action === 'truncateText') { applyToSelection({ wrap: false, overflow: 'hidden' }); toast.success('Texte tronqué'); return; }
                // Number formats
                if (action === 'formatAuto') { applyToSelection({ numberFormat: 'auto' }); toast.success('Format automatique'); return; }
                if (action === 'formatText') { applyToSelection({ numberFormat: 'text' }); toast.success('Format texte'); return; }
                if (action === 'formatNumber') { applyToSelection({ numberFormat: 'number' }); toast.success('Format nombre'); return; }
                if (action === 'formatPercent') { applyToSelection({ numberFormat: 'percent' }); toast.success('Format pourcentage'); return; }
                if (action === 'formatScientific') { applyToSelection({ numberFormat: 'scientific' }); toast.success('Format scientifique'); return; }
                if (action === 'formatAccounting') { applyToSelection({ numberFormat: 'accounting' }); toast.success('Format comptabilité'); return; }
                if (action === 'formatFinance') { applyToSelection({ numberFormat: 'accounting' }); toast.success('Format finances'); return; }
                if (action === 'formatCurrency') { applyToSelection({ numberFormat: 'currency' }); toast.success('Format devise'); return; }
                if (action === 'formatCurrencyRounded') { applyToSelection({ numberFormat: 'currency', decimals: 0 }); toast.success('Format devise arrondie'); return; }
                if (action === 'formatDate') { applyToSelection({ numberFormat: 'date' }); toast.success('Format date'); return; }
                if (action === 'formatTime') { applyToSelection({ numberFormat: 'time' }); toast.success('Format heure'); return; }
                if (action === 'formatDateTime') { applyToSelection({ numberFormat: 'datetime' }); toast.success('Format date et heure'); return; }
                if (action === 'formatDuration') { applyToSelection({ numberFormat: 'duration' }); toast.success('Format durée'); return; }
                // Text rotation
                if (action === 'rotateNone') { applyToSelection({ rotation: 0 }); toast.success('Rotation supprimée'); return; }
                if (action === 'rotateTiltUp') { applyToSelection({ rotation: -45 }); toast.success('Incliné vers le haut'); return; }
                if (action === 'rotateTiltDown') { applyToSelection({ rotation: 45 }); toast.success('Incliné vers le bas'); return; }
                if (action === 'rotateUp') { applyToSelection({ rotation: -90 }); toast.success('Rotation vers le haut'); return; }
                if (action === 'rotateDown') { applyToSelection({ rotation: 90 }); toast.success('Rotation vers le bas'); return; }
                if (action === 'rotateVertical') { applyToSelection({ rotation: 'vertical' }); toast.success('Texte vertical'); return; }
                if (action === 'mergeCellsAll') { handleMerge(); return; }
                if (action === 'mergeCellsHoriz') {
                    if (selectionBounds) {
                        for (let r = selectionBounds.minR; r <= selectionBounds.maxR; r++) {
                            mergeCells(r, r, selectionBounds.minC, selectionBounds.maxC);
                        }
                        toast.success('Fusion horizontale');
                    }
                    return;
                }
                if (action === 'mergeCellsVert') {
                    if (selectionBounds) {
                        for (let c = selectionBounds.minC; c <= selectionBounds.maxC; c++) {
                            mergeCells(selectionBounds.minR, selectionBounds.maxR, c, c);
                        }
                        toast.success('Fusion verticale');
                    }
                    return;
                }
                if (action === 'unmergeCellsAction') {
                    if (selectionBounds) {
                        unmergeCells(selectionBounds.minR, selectionBounds.minC);
                        toast.info('Défusionné');
                    }
                    return;
                }

                if (action === 'new') window.open('/sheets', '_blank')
                if (action === 'open') toast.info("Rendez-vous sur l'accueil Drive pour ouvrir un fichier.")
                if (action === 'import') fileInputRef.current?.click()
                if (action === 'export_xlsx') exportXLSX('xlsx')
                if (action === 'export_csv') exportXLSX('csv')
                if (action === 'print') window.print()
                if (action === 'toggle_read_only') {
                    setIsReadOnly(r => {
                        const newR = !r;
                        toast.info(newR ? "Mode Lecture seule activé" : "Mode Édition activé");
                        return newR;
                    })
                }
                if (action === 'rename') {
                     const name = prompt("Nouveau nom du fichier:", "Document sans titre");
                     if (name) toast.success(`Fichier renommé en "${name}"`);
                }
                if (action === 'trash') {
                     if (confirm("Voulez-vous placer ce fichier dans la corbeille ?")) {
                          toast.success("Fichier placé dans la corbeille.");
                          window.location.href = '/drive';
                     }
                }
                if (action === 'fullScreen') {
                     if (!document.fullscreenElement) {
                          document.documentElement.requestFullscreen().catch(() => toast.error("Le plein écran est bloqué."));
                     } else {
                          document.exitFullscreen();
                     }
                }
                if (action === 'copyFile') {
                     toast.success("Document dupliqué avec succès.");
                }
                if (action === 'undo') undo()
                if (action === 'redo') redo()
                if (action === 'cut') handleContextAction('cut')
                if (action === 'copy') handleContextAction('copy')
                if (action === 'paste') handleContextAction('paste')
                if (action === 'find') setShowFind(true)
                if (action === 'toggleGridlines') setShowGridlines(!showGridlines)
                if (action === 'freezeRow') { setFreezeRows(1); toast.success('Première ligne figée') }
                if (action === 'freezeCol') { setFreezeCols(1); toast.success('Première colonne figée') }
                if (action === 'insertRowAbove') handleContextAction('insertRowAbove')
                if (action === 'insertRowBelow') handleContextAction('insertRowBelow')
                if (action === 'insertColLeft') handleContextAction('insertColLeft')
                if (action === 'insertColRight') handleContextAction('insertColRight')
                if (action === 'chart') setShowChartPicker(true)
                if (action === 'link') { const url = prompt("URL:"); if (url && activeCell) { setCell(activeCell.r, activeCell.c, url); toast.success("Lien inséré") } }
                if (action === 'comment') { if (activeCell) { const existing = data[`${activeCell.r},${activeCell.c}`]?.comment || ''; const c = prompt("Commentaire:", existing); if (c !== null) { setCellComment(activeCell.r, activeCell.c, c || undefined); toast.success(c ? 'Commentaire ajouté' : 'Commentaire supprimé') } } }
                if (action === 'bold') toggleBoolFormat('bold')
                if (action === 'italic') toggleBoolFormat('italic')
                if (action === 'underline') toggleBoolFormat('underline')
                if (action === 'strikethrough') toggleBoolFormat('strikethrough')
                if (action === 'alignLeft') applyToSelection({ align: 'left' })
                if (action === 'alignCenter') applyToSelection({ align: 'center' })
                if (action === 'alignRight') applyToSelection({ align: 'right' })
                if (action === 'clearFormat') applyToSelection({ bold: false, italic: false, underline: false, strikethrough: false, textColor: undefined, fillColor: undefined, align: undefined, verticalAlign: undefined, fontFamily: undefined, fontSize: undefined, numberFormat: "auto" })
                if (action === 'unfreezeRow') { setFreezeRows(0); toast.info('Lignes libérées') }
                if (action === 'unfreezeCol') { setFreezeCols(0); toast.info('Colonnes libérées') }
                if (action === 'toggleFormulaBar') { setShowFormulaBar(v => { toast.info(v ? 'Barre de formules masquée' : 'Barre de formules affichée'); return !v }); return }
                if (action === 'zoom50') { setZoomLevel(50); toast.success('Zoom à 50%'); return }
                if (action === 'zoom75') { setZoomLevel(75); toast.success('Zoom à 75%'); return }
                if (action === 'zoom100') { setZoomLevel(100); toast.success('Zoom à 100%'); return }
                if (action === 'zoom125') { setZoomLevel(125); toast.success('Zoom à 125%'); return }
                if (action === 'zoom150') { setZoomLevel(150); toast.success('Zoom à 150%'); return }
                if (action === 'zoom200') { setZoomLevel(200); toast.success('Zoom à 200%'); return }
                if (action === 'insertSum') { if (activeCell) { setCell(activeCell.r, activeCell.c, '=SUM()'); setIsEditing(true); setTimeout(() => formulaBarRef.current?.focus(), 0) } }
                if (action === 'insertAvg') { if (activeCell) { setCell(activeCell.r, activeCell.c, '=AVERAGE()'); setIsEditing(true); setTimeout(() => formulaBarRef.current?.focus(), 0) } }
                if (action === 'insertCount') { if (activeCell) { setCell(activeCell.r, activeCell.c, '=COUNT()'); setIsEditing(true); setTimeout(() => formulaBarRef.current?.focus(), 0) } }
                if (action === 'insertMax') { if (activeCell) { setCell(activeCell.r, activeCell.c, '=MAX()'); setIsEditing(true); setTimeout(() => formulaBarRef.current?.focus(), 0) } }
                if (action === 'insertMin') { if (activeCell) { setCell(activeCell.r, activeCell.c, '=MIN()'); setIsEditing(true); setTimeout(() => formulaBarRef.current?.focus(), 0) } }
                if (action === 'condFormat') setShowCondFormat(true)
                if (action === 'bandedRows') setBandedRows(!bandedRows)
                if (action === 'sortAsc') handleContextAction('sortAsc')
                if (action === 'sortDesc') handleContextAction('sortDesc')
                if (action === 'filter') toggleFilter()
                if (action === 'validation') { if (!activeCell) return; const vals = prompt("Valeurs de la liste (séparées par des virgules):"); if (vals) { setCellValidation(activeCell.r, activeCell.c, { type: 'list', values: vals.split(',').map(v => v.trim()) }); toast.success('Validation ajoutée') } }
                if (action === 'insertSheet') { addSheet(`Sheet${sheets.length + 1}`); toast.success('Nouvelle feuille ajoutée'); return }
                if (action === 'pivot_table') { setShowPivotDialog(true); return }
                if (action === 'chartDialog') { setShowChartDialog(true); return }
                if (action === 'macroEditor') { setShowMacroEditor(true); return }
                // IDEA-018: Named ranges
                if (action === 'named_ranges') { setShowNamedRanges(true); return }
                // IDEA-020: Print preview
                if (action === 'print_preview') { setShowPrintPreview(true); return }
                // IDEA-021: Advanced data validation
                if (action === 'advanced_validation') { setShowAdvancedValidation(true); return }
                // IDEA-022: Advanced conditional formatting
                if (action === 'advanced_cond_format') { setShowAdvCondFormat(true); return }
            }} />
            </div>

            {/* ===== TOOLBAR ===== */}
            <Toolbar data-print-hide className="overflow-x-auto custom-scrollbar flex-nowrap min-h-[44px]">
                    <TBtn onClick={undo} title="Annuler (Ctrl+Z)"><Undo className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={redo} title="R\u00E9tablir (Ctrl+Y)"><Redo className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => window.print()} title="Imprimer (Ctrl+P)"><Printer className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => { if (paintFormat) setPaintFormat(null); else if (activeCell) { setPaintFormat({ ...activeCellStyle }); toast.info("Cliquez sur une cellule") } }} active={!!paintFormat} title="Reproduire la mise en forme"><Paintbrush className="w-[18px] h-[18px]" /></TBtn>
                    <Sep />
                    <TBtn onClick={() => applyToSelection({ numberFormat: activeCellStyle.numberFormat === 'currency' ? 'auto' : 'currency' })} active={activeCellStyle.numberFormat === 'currency'} title="Format mon\u00E9taire" className="font-serif font-medium">{"\u20AC"}</TBtn>
                    <TBtn onClick={() => applyToSelection({ numberFormat: activeCellStyle.numberFormat === 'percent' ? 'auto' : 'percent' })} active={activeCellStyle.numberFormat === 'percent'} title="Format pourcentage"><Percent className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => changeDecimals(-1)} title="R\u00E9duire d\u00E9cimales" className="tracking-tighter font-semibold text-xs">{".0\u2190"}</TBtn>
                    <TBtn onClick={() => changeDecimals(1)} title="Augmenter d\u00E9cimales" className="tracking-tighter font-semibold text-xs">{".00\u2192"}</TBtn>
                    {/* Number Format Dropdown */}
                    <Popover open={showNumberFormat} onOpenChange={setShowNumberFormat}>
                        <PopoverTrigger asChild>
                            <TBtn title="Format num\u00E9rique"><Hash className="w-[18px] h-[18px]" /></TBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1" align="start" sideOffset={8}>
                            {([
                                { fmt: 'auto', label: 'Automatique' },
                                { fmt: 'number', label: 'Nombre (1 000,00)' },
                                { fmt: 'currency', label: 'Mon\u00E9taire (\u20AC)' },
                                { fmt: 'accounting', label: 'Comptabilit\u00E9' },
                                { fmt: 'percent', label: 'Pourcentage (%)' },
                                { fmt: 'scientific', label: 'Scientifique (1E+3)' },
                                { fmt: 'date', label: 'Date (AAAA-MM-JJ)' },
                                { fmt: 'time', label: 'Heure (HH:MM:SS)' },
                            ] as { fmt: CellStyle['numberFormat'], label: string }[]).map(({ fmt, label }) => (
                                <button key={fmt} className={cn("w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded-sm", activeCellStyle.numberFormat === fmt && "bg-[#e8f0fe] dark:bg-[#3c4043] font-medium")} onClick={() => { applyToSelection({ numberFormat: fmt }); setShowNumberFormat(false) }}>{label}</button>
                            ))}
                        </PopoverContent>
                    </Popover>
                    <Sep />
                    {/* Font Picker */}
                    <Popover open={showFontPicker} onOpenChange={setShowFontPicker}>
                        <PopoverTrigger asChild>
                            <button className="px-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] border border-transparent hover:border-[#c7c7c7] border hover:bg-background rounded flex items-center cursor-pointer h-7 w-24 justify-between mx-0.5" >
                                <span className="truncate">{activeCellStyle.fontFamily || 'Arial'}</span>
                                <ChevronDown className="w-3 h-3 ml-1 shrink-0" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 max-h-64 p-1 overflow-y-auto" align="start" sideOffset={8}>
                            {FONTS.map(font => (
                                <button key={font} className={cn("w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded-sm", activeCellStyle.fontFamily === font && "bg-[#e8f0fe] dark:bg-[#3c4043]")} style={{ fontFamily: font }} onClick={() => { applyToSelection({ fontFamily: font }); setShowFontPicker(false) }}>{font}</button>
                            ))}
                        </PopoverContent>
                    </Popover>
                    {/* Font Size */}
                    <div className="flex items-center border border-transparent hover:border-[#c7c7c7] rounded h-7 ml-0.5 bg-transparent hover:bg-background transition-colors">
                        <button className="px-1.5 text-[13px] text-[#444746] cursor-pointer hover:bg-gray-100 h-full flex items-center" onClick={() => changeFontSize(-1)}><Minus className="w-[14px] h-[14px]" /></button>
                        <input className="px-1 text-[13px] text-[#444746] dark:text-[#e3e3e3] w-8 text-center bg-transparent outline-none" value={activeCellStyle.fontSize || 10} onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 6 && v <= 72) applyToSelection({ fontSize: v }) }} onMouseDown={(e) => e.stopPropagation()} />
                        <button className="px-1.5 text-[13px] text-[#444746] cursor-pointer hover:bg-gray-100 h-full flex items-center" onClick={() => changeFontSize(1)}><Plus className="w-[14px] h-[14px]" /></button>
                    </div>
                    <Sep />
                    <TBtn onClick={() => toggleBoolFormat('bold')} active={activeCellStyle.bold} title="Gras (Ctrl+B)" className="font-serif font-bold">B</TBtn>
                    <TBtn onClick={() => toggleBoolFormat('italic')} active={activeCellStyle.italic} title="Italique (Ctrl+I)" className="font-serif italic">I</TBtn>
                    <TBtn onClick={() => toggleBoolFormat('underline')} active={activeCellStyle.underline} title="Soulign\u00E9 (Ctrl+U)" className="font-serif underline">U</TBtn>
                    <TBtn onClick={() => toggleBoolFormat('strikethrough')} active={activeCellStyle.strikethrough} title="Barr\u00E9"><Strikethrough className="w-[18px] h-[18px]" /></TBtn>
                    {/* Text Color */}
                    <Popover open={showTextColor} onOpenChange={setShowTextColor}>
                        <PopoverTrigger asChild>
                            <button className="p-1 px-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors relative" title="Couleur du texte" onClick={() => setShowFillColor(false)}>
                                <Type className="w-[18px] h-[18px]" />
                                <div className="absolute bottom-0.5 left-1.5 right-1.5 h-[3px] rounded-sm" style={{ backgroundColor: activeCellStyle.textColor || '#000000' }} />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-2" align="start" sideOffset={8}>
                            <div className="grid grid-cols-10 gap-1">
                                {PRESET_COLORS.map(color => (<button key={color} className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => { applyToSelection({ textColor: color }); setShowTextColor(false) }} />))}
                            </div>
                            <button className="mt-2 text-xs text-[#1a73e8] hover:underline" onClick={() => { applyToSelection({ textColor: undefined }); setShowTextColor(false) }}>R\u00E9initialiser</button>
                        </PopoverContent>
                    </Popover>
                    {/* Fill Color */}
                    <Popover open={showFillColor} onOpenChange={setShowFillColor}>
                        <PopoverTrigger asChild>
                            <button className="p-1 px-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] text-[#444746] dark:text-[#e3e3e3] rounded flex items-center justify-center transition-colors relative" title="Couleur de remplissage" onClick={() => setShowTextColor(false)}>
                                <PaintBucket className="w-[18px] h-[18px]" />
                                <div className="absolute bottom-0.5 left-1.5 right-1.5 h-[3px] rounded-sm" style={{ backgroundColor: activeCellStyle.fillColor || 'transparent' }} />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-2" align="start" sideOffset={8}>
                            <div className="grid grid-cols-10 gap-1">
                                {PRESET_COLORS.map(color => (<button key={color} className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => { applyToSelection({ fillColor: color }); setShowFillColor(false) }} />))}
                            </div>
                            <button className="mt-2 text-xs text-[#1a73e8] hover:underline" onClick={() => { applyToSelection({ fillColor: undefined }); setShowFillColor(false) }}>Aucun</button>
                        </PopoverContent>
                    </Popover>
                    <Sep />
                    {/* Borders */}
                    <Popover open={showBorderPicker} onOpenChange={setShowBorderPicker}>
                        <PopoverTrigger asChild>
                            <TBtn title="Bordures"><Grid3X3 className="w-[18px] h-[18px]" /></TBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align="start" sideOffset={8}>
                            <BorderPicker onSelect={applyBorders} onClose={() => setShowBorderPicker(false)} />
                        </PopoverContent>
                    </Popover>
                    <TBtn onClick={handleMerge} active={!!activeCellStyle.mergeRows} title="Fusionner"><Maximize className="w-[18px] h-[18px]" /></TBtn>
                    <Sep />
                    <TBtn onClick={cycleAlign} title={`Alignement: ${activeCellStyle.align || 'left'}`}>
                        {activeCellStyle.align === 'center' ? <AlignCenter className="w-[18px] h-[18px]" /> : activeCellStyle.align === 'right' ? <AlignRight className="w-[18px] h-[18px]" /> : <AlignLeft className="w-[18px] h-[18px]" />}
                    </TBtn>
                    <TBtn onClick={cycleVerticalAlign} title={`V-Align: ${activeCellStyle.verticalAlign || 'middle'}`}><AlignVerticalJustifyCenter className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => toggleBoolFormat('wrap')} active={activeCellStyle.wrap} title="Retour \u00E0 la ligne"><WrapText className="w-[18px] h-[18px]" /></TBtn>
                    <Popover open={showRotationInput} onOpenChange={setShowRotationInput}>
                        <PopoverTrigger asChild>
                            <TBtn active={!!activeCellStyle.rotation} title="Rotation du texte"><RotateCw className="w-[18px] h-[18px]" /></TBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="start" sideOffset={8}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[12px] font-medium">Angle</span>
                                <button onClick={() => setShowRotationInput(false)}><X className="w-3 h-3" /></button>
                            </div>
                            <div className="flex gap-1 mb-2">
                                {[0, 45, 90, -45, -90, 180].map(deg => (
                                    <button key={deg} className={cn("px-2 py-1 text-[11px] rounded border", activeCellStyle.rotation === deg ? "bg-[#e8f0fe] border-[#1a73e8]" : "border-gray-200 hover:bg-gray-100")} onClick={() => { applyToSelection({ rotation: deg === 0 ? undefined : deg }); setShowRotationInput(false) }}>{deg}°</button>
                                ))}
                            </div>
                            <input type="range" min={-90} max={90} value={activeCellStyle.rotation || 0} className="w-full" onChange={(e) => applyToSelection({ rotation: Number(e.target.value) || undefined })} />
                        </PopoverContent>
                    </Popover>
                    <Sep />
                    <TBtn onClick={() => { const url = prompt("URL:"); if (url && activeCell) { setCell(activeCell.r, activeCell.c, url); toast.success("Lien ins\u00E9r\u00E9") } }} title="Lien"><Link className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => { if (!activeCell) return; const existing = data[`${activeCell.r},${activeCell.c}`]?.comment || ''; const c = prompt("Commentaire:", existing); if (c !== null) { setCellComment(activeCell.r, activeCell.c, c || undefined); toast.success(c ? 'Commentaire ajouté' : 'Commentaire supprimé') } }} title="Commentaire"><MessageSquare className="w-[18px] h-[18px]" /></TBtn>
                    {/* Chart picker */}
                    <Popover open={showChartPicker} onOpenChange={setShowChartPicker}>
                        <PopoverTrigger asChild>
                            <TBtn title="Graphique"><BarChart2 className="w-[18px] h-[18px]" /></TBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-36 p-1" align="end" sideOffset={8}>
                            <button className="w-full text-left px-2 py-1 text-[12px] hover:bg-[#f1f3f4] rounded" onClick={() => { openChart('bar'); setShowChartPicker(false); }}>Barres</button>
                            <button className="w-full text-left px-2 py-1 text-[12px] hover:bg-[#f1f3f4] rounded" onClick={() => { openChart('line'); setShowChartPicker(false); }}>Ligne</button>
                            <button className="w-full text-left px-2 py-1 text-[12px] hover:bg-[#f1f3f4] rounded" onClick={() => { openChart('pie'); setShowChartPicker(false); }}>Circulaire</button>
                        </PopoverContent>
                    </Popover>
                    <TBtn onClick={() => setShowChartDialog(true)} title="Graphique avance"><BarChart2 className="w-[18px] h-[18px] text-[#1a73e8]" /></TBtn>
                    <TBtn onClick={() => setShowPivotDialog(true)} title="Tableau croise dynamique"><Table2 className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => setShowMacroEditor(true)} title="Macros"><FileCode className="w-[18px] h-[18px]" /></TBtn>
                    <Sep />
                    <TBtn onClick={toggleFilter} active={filterCol !== null} title="Filtre"><Filter className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={toggleFreeze} active={freezeRows > 0 || freezeCols > 0} title="Figer lignes/colonnes"><Snowflake className="w-[18px] h-[18px]" /></TBtn>
                    <TBtn onClick={() => setShowCondFormat(true)} active={condRules.length > 0} title="Mise en forme conditionnelle"><Palette className="w-[18px] h-[18px]" /></TBtn>

                    {/* Functions helper */}
                    <Popover open={showFunctionHelper} onOpenChange={setShowFunctionHelper}>
                        <PopoverTrigger asChild>
                            <TBtn title="Fonctions"><Sigma className="w-[18px] h-[18px]" /></TBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 max-h-72 p-1 overflow-y-auto" align="end" sideOffset={8}>
                            <div className="flex items-center justify-between mb-2 px-2 pt-1">
                                <span className="font-medium text-[13px]">Fonctions</span>
                                <button onClick={() => setShowFunctionHelper(false)}><X className="w-4 h-4" /></button>
                            </div>
                            {[
                                { fn: '=SUM(A1:A10)', desc: 'Somme' },
                                { fn: '=AVERAGE(A1:A10)', desc: 'Moyenne' },
                                { fn: '=COUNT(A1:A10)', desc: 'Nombre' },
                                { fn: '=MAX(A1:A10)', desc: 'Maximum' },
                                { fn: '=MIN(A1:A10)', desc: 'Minimum' },
                                { fn: '=IF(A1>5,"Oui","Non")', desc: 'Condition' },
                                { fn: '=VLOOKUP(A1,B1:C10,2)', desc: 'Recherche V' },
                                { fn: '=CONCATENATE(A1,B1)', desc: 'Concat\u00E9ner' },
                                { fn: '=ROUND(A1,2)', desc: 'Arrondir' },
                                { fn: '=COUNTIF(A1:A10,">5")', desc: 'NB.SI' },
                                { fn: '=SUMIF(A1:A10,">5")', desc: 'SOMME.SI' },
                                { fn: '=TODAY()', desc: "Date du jour" },
                                { fn: '=LEN(A1)', desc: 'Longueur' },
                                { fn: '=UPPER(A1)', desc: 'Majuscules' },
                                { fn: '=IFERROR(A1/B1,0)', desc: 'Si erreur' },
                            ].map(({ fn, desc }) => (
                                <button key={fn} className="w-full text-left px-2 py-1 text-[12px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] rounded" onClick={() => { if (activeCell) { setEditValue(fn); setCell(activeCell.r, activeCell.c, fn); setIsEditing(true); setShowFunctionHelper(false); setTimeout(() => formulaBarRef.current?.focus(), 0) } }}>
                                    <span className="font-mono text-[#1a73e8]">{fn}</span>
                                    <span className="ml-2 text-[#5f6368]">{desc}</span>
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                    <div className="ml-auto flex items-center pr-1 shrink-0 relative">
                        <button
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded font-medium text-[13px] shadow-sm transition-all border",
                                showAiDialog
                                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent scale-95"
                                    : "bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 dark:from-purple-900/30 dark:to-indigo-900/30 dark:hover:from-purple-900/50 dark:hover:to-indigo-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            )}
                            onClick={() => setShowAiDialog(!showAiDialog)}
                        >
                            <Sparkles className={cn("w-3.5 h-3.5", showAiDialog ? "animate-pulse" : "")} /> Tools IA
                        </button>
                    </div>
            </Toolbar>

            {/* ===== FORMULA BAR ===== */}
            {showFormulaBar && (
            <div data-print-hide className="flex items-center gap-2 px-4 py-2 border-b border-[#e3e3e3] dark:border-[#3c4043] bg-background dark:bg-[#1a1a1a] shrink-0 h-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10">
                <div className="w-12 h-6 flex items-center justify-center bg-[#f1f3f4] dark:bg-[#3c4043] rounded font-medium text-[12px] shrink-0 tracking-wide select-text border border-[#e3e3e3] dark:border-[#5f6368]">
                    {activeCell ? `${indexToCol(activeCell.c)}${activeCell.r + 1}` : ''}
                </div>
                <div className="w-px h-5 bg-[#e3e3e3] dark:bg-[#5f6368] shrink-0 mx-1" />
                <div className="text-[#9aa0a6] font-serif italic shrink-0 text-base px-1 pointer-events-none select-none">
                    ƒ<span className="text-[12px] font-sans italic relative -top-0.5 -left-0.5">x</span>
                </div>
                <input ref={formulaBarRef} className="flex-1 outline-none text-[13px] bg-transparent font-mono text-[#202124] dark:text-[#e8eaed] placeholder:text-[#9aa0a6] placeholder:font-sans" placeholder={activeCell ? "Saisir une formule ou un texte..." : ""} value={activeCell ? editValue : ''} onChange={(e) => { setEditValue(e.target.value); if (activeCell) setCell(activeCell.r, activeCell.c, e.target.value) }} onFocus={() => { if (activeCell) setIsEditing(true) }} disabled={!activeCell} />
            </div>
            )}

            {/* ===== GRID (Virtualized) ===== */}
            <div ref={gridRef} className="relative flex-1 overflow-auto bg-background dark:bg-[#1f1f1f] will-change-transform" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }} onScroll={handleScroll} onDragOver={handleGridDragOver} onDragLeave={handleGridDragLeave} onDrop={handleGridDrop}>
                {/* IDEA-017: CSV drag-drop overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-[500] bg-[#1a73e8]/10 border-4 border-dashed border-[#1a73e8] flex items-center justify-center pointer-events-none rounded">
                        <div className="bg-background rounded-xl shadow-xl px-6 py-4 text-center">
                            <p className="font-semibold text-[#1a73e8]">Déposer le fichier CSV</p>
                            <p className="text-[12px] text-muted-foreground mt-1">Le contenu sera inséré à la cellule active</p>
                        </div>
                    </div>
                )}

                {/* Find & Replace */}
                {showFind && (
                    <FindReplaceBar
                        findText={findText} replaceText={replaceText}
                        matchCount={findMatches.length} currentMatch={currentFindIdx}
                        showReplace={showReplaceToggle}
                        searchAllSheets={findAllSheets}
                        onFindChange={setFindText} onReplaceChange={setReplaceText}
                        onNext={() => navigateToFind(currentFindIdx + 1)}
                        onPrev={() => navigateToFind(currentFindIdx - 1)}
                        onReplace={doReplace} onReplaceAll={doReplaceAll}
                        onToggleReplace={() => setShowReplaceToggle(!showReplaceToggle)}
                        onToggleAllSheets={() => setFindAllSheets(prev => !prev)}
                        onClose={() => { setShowFind(false); setFindText(''); setFindAllSheets(false) }}
                    />
                )}

                {/* Total grid size (for scrollbar) */}
                <div style={{ width: totalWidth + ROW_HEADER_WIDTH, height: totalHeight + COL_HEADER_HEIGHT, position: 'relative' }}>

                    {/* Column headers */}
                    <div className="flex sticky top-0 z-30 select-none" style={{ height: COL_HEADER_HEIGHT }}>
                        <div className="bg-[#f8f9fa] dark:bg-[#202124] border-r border-b border-[#c0c0c0] dark:border-[#5f6368] shrink-0 sticky left-0 z-40 relative cursor-pointer hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043] transition-colors" style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: COL_HEADER_HEIGHT }} onClick={() => { setSelectedRange({ start: { r: 0, c: 0 }, end: { r: effectiveRows - 1, c: COLS - 1 } }); setActiveCell({ r: 0, c: 0 }) }} title="Tout sélectionner">
                            <div className={cn("absolute top-1 left-1 h-1.5 w-1.5 rounded-full shadow-sm", isConnected ? "bg-[#1e8e3e]" : "bg-[#d93025] animate-pulse")} />
                        </div>
                        {/* Spacer for cols before visible range */}
                        {startC > 0 && <div style={{ width: colOffsets[startC], minWidth: colOffsets[startC] }} />}
                        {Array.from({ length: endC - startC + 1 }).map((_, i) => {
                            const c = startC + i
                            const inSel = selectionBounds && c >= selectionBounds.minC && c <= selectionBounds.maxC
                            const w = getColWidth(c)
                            const isFrozen = c < freezeCols
                            return (
                                <div key={c} className={cn("flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] font-medium shrink-0 transition-colors relative group cursor-pointer", inSel ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8]" : "bg-[#f8f9fa] dark:bg-[#202124] text-[#444746] dark:text-[#9aa0a6] hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043]", isFrozen && "bg-[#e8f0fe]/50")} style={{ width: w, minWidth: w, maxWidth: w, height: COL_HEADER_HEIGHT, ...(isFrozen ? { position: 'sticky', left: ROW_HEADER_WIDTH + colOffsets[c], zIndex: 41 } : {}) }} onClick={(e) => { if (e.shiftKey && activeCell) { setSelectedRange({ start: { r: 0, c: activeCell.c }, end: { r: effectiveRows - 1, c } }) } else { setSelectedRange({ start: { r: 0, c }, end: { r: effectiveRows - 1, c } }); setActiveCell({ r: 0, c }) } }}>
                                    {indexToCol(c)}
                                    <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#1a73e8] opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { type: 'col', index: c, startPos: e.clientX, startSize: w } }} onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autoFitColumn(c) }} />
                                </div>
                            )
                        })}
                    </div>

                    {/* IDEA-016: Freeze pane visual indicator — blue lines at frozen boundaries */}
                {freezeRows > 0 && (
                    <div className="absolute z-30 pointer-events-none" style={{
                        left: 0, right: 0,
                        top: COL_HEADER_HEIGHT + rowOffsets[freezeRows] - scrollTop,
                        height: 2,
                        background: 'linear-gradient(to right, transparent, #1a73e8 20%, #1a73e8 80%, transparent)',
                        boxShadow: '0 0 6px rgba(26,115,232,0.5)'
                    }} />
                )}
                {freezeCols > 0 && (
                    <div className="absolute z-30 pointer-events-none" style={{
                        top: 0, bottom: 0,
                        left: ROW_HEADER_WIDTH + colOffsets[freezeCols] - scrollLeft,
                        width: 2,
                        background: 'linear-gradient(to bottom, transparent, #1a73e8 20%, #1a73e8 80%, transparent)',
                        boxShadow: '0 0 6px rgba(26,115,232,0.5)'
                    }} />
                )}

                {/* Rows (virtualized) */}
                    {/* Spacer for rows before visible range */}
                    {startR > 0 && <div style={{ height: rowOffsets[startR] }} />}
                    {Array.from({ length: endR - startR + 1 }).map((_, ri) => {
                        const r = startR + ri
                        if (!isRowVisible(r)) return null
                        const inSelRow = selectionBounds && r >= selectionBounds.minR && r <= selectionBounds.maxR
                        const rh = getRowHeight(r)
                        const isFrozenRow = r < freezeRows

                        return (
                            <div key={r} className="flex" style={{ height: rh, position: 'absolute', top: COL_HEADER_HEIGHT + rowOffsets[r], left: 0, width: totalWidth + ROW_HEADER_WIDTH, ...(isFrozenRow ? { position: 'sticky', top: COL_HEADER_HEIGHT + rowOffsets[r], zIndex: 25 } : {}) }}>
                                {/* Row header */}
                                <div className={cn("flex items-center justify-center border-r border-b border-[#c0c0c0] dark:border-[#5f6368] text-[12px] shrink-0 sticky left-0 z-20 transition-colors relative group cursor-pointer", inSelRow ? "bg-[#e8f0fe] dark:bg-[#3c4043] text-[#1a73e8]" : "bg-[#f8f9fa] dark:bg-[#202124] text-[#444746] dark:text-[#9aa0a6] hover:bg-[#e8f0fe] dark:hover:bg-[#3c4043]")} style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: rh }} onClick={(e) => { if (e.shiftKey && activeCell) { setSelectedRange({ start: { r: activeCell.r, c: 0 }, end: { r, c: COLS - 1 } }) } else { setSelectedRange({ start: { r, c: 0 }, end: { r, c: COLS - 1 } }); setActiveCell({ r, c: 0 }) } }}>
                                    {r + 1}
                                    <div className="absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-[#1a73e8] opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { type: 'row', index: r, startPos: e.clientY, startSize: rh } }} />
                                </div>

                                {/* Spacer for cols before visible range */}
                                {startC > 0 && <div style={{ width: colOffsets[startC], minWidth: colOffsets[startC] }} />}

                                {/* Cells */}
                                {Array.from({ length: endC - startC + 1 }).map((_, ci) => {
                                    const c = startC + ci
                                    const cellData = data[`${r},${c}`]
                                    const style = cellData?.style
                                    if (style?.mergedInto) return null

                                    const isActive = activeCell?.r === r && activeCell?.c === c
                                    const inRect = selectionBounds && r >= selectionBounds.minR && r <= selectionBounds.maxR && c >= selectionBounds.minC && c <= selectionBounds.maxC
                                    const isBottomRight = selectionBounds && r === selectionBounds.maxR && c === selectionBounds.maxC
                                    const isFindMatch = findMatches.some(m => m.r === r && m.c === c)
                                    const isCurrentFind = findMatches.length > 0 && findMatches[currentFindIdx]?.r === r && findMatches[currentFindIdx]?.c === c

                                    let rawValue: string = typeof cellData?.value === 'string' ? cellData.value : ''
                                    // Safety: if Yjs stored an object instead of string, convert it
                                    if (cellData?.value && typeof cellData.value !== 'string') {
                                        const v = cellData.value as any
                                        try {
                                            if (v instanceof Date || typeof v.toISOString === 'function') rawValue = (v.toISOString?.() || '').split('T')[0]
                                            else if (typeof v === 'number' || typeof v === 'boolean') rawValue = String(v)
                                            else if (v.result !== undefined) rawValue = String(v.result ?? '')
                                            else if (v.text !== undefined) rawValue = String(v.text ?? '')
                                            else if (v.richText) rawValue = v.richText.map((r: any) => r?.text || '').join('')
                                            else rawValue = JSON.stringify(v)
                                        } catch { rawValue = '' }
                                    }
                                    const evaluated = evaluatedData[`${r},${c}`] || rawValue
                                    const displayValue = formatDisplayValue(evaluated, style)
                                    const isErrorVal = (displayValue.startsWith("#") && displayValue.endsWith("!")) || displayValue === "#NAME?" || displayValue === "#N/A"
                                    const isNumber = !isErrorVal && !isNaN(Number(evaluated)) && evaluated.trim() !== ""

                                    const mergeRows = style?.mergeRows || 1
                                    const mergeCols2 = style?.mergeCols || 1
                                    let cellW = 0; for (let mc = 0; mc < mergeCols2; mc++) cellW += getColWidth(c + mc)
                                    let cellH = 0; for (let mr = 0; mr < mergeRows; mr++) cellH += getRowHeight(r + mr)

                                    const condColor = condFormatColor(r, c)
                                    const advOverlay = advCondFormatOverlay(r, c)
                                    const isFrozenCell = c < freezeCols

                                    const bandedBg = bandedRows && !style?.fillColor && !condColor && !inRect && !isActive && r % 2 === 0 ? '#f8f9fa' : undefined
                                    const isUrl = !isErrorVal && /^https?:\/\/\S+/.test(evaluated)
                                    const isSparkline = evaluated.startsWith('__SPARKLINE__:')
                                    const isLocked = !!style?.locked
                                    const hasComment = !!cellData?.comment
                                    const hasValidation = !!cellData?.validation
                                    const isCheckbox = cellData?.validation?.type === 'boolean' || displayValue === 'true' || displayValue === 'false' || displayValue === 'TRUE' || displayValue === 'FALSE'

                                    const isMerged = mergeRows > 1 || mergeCols2 > 1
                                    const cellStyle: React.CSSProperties = {
                                        width: cellW, minWidth: cellW, maxWidth: cellW, height: cellH,
                                        fontWeight: style?.bold ? 700 : undefined,
                                        fontStyle: style?.italic ? 'italic' : undefined,
                                        textDecoration: style?.strikethrough ? 'line-through' : (isUrl ? 'underline' : undefined),
                                        textAlign: style?.align || (isNumber ? 'right' : 'left'),
                                        fontFamily: style?.fontFamily,
                                        fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
                                        color: isUrl ? '#1a73e8' : style?.textColor,
                                        backgroundColor: advOverlay?.bgColor
                                            ? advOverlay.bgColor
                                            : condColor
                                            ? `${condColor}22`
                                            : style?.fillColor || (inRect && !isActive ? 'rgba(66,133,244,0.08)' : bandedBg),
                                        whiteSpace: style?.wrap ? 'pre-wrap' : 'nowrap',
                                        borderTopWidth: style?.borderTop ? 2 : undefined,
                                        borderRightWidth: style?.borderRight ? 2 : undefined,
                                        borderBottomWidth: style?.borderBottom ? 2 : undefined,
                                        borderLeftWidth: style?.borderLeft ? 2 : undefined,
                                        borderColor: (style?.borderTop || style?.borderRight || style?.borderBottom || style?.borderLeft) ? '#202124' : undefined,
                                        borderStyle: 'solid',
                                        // Merged cells that span rows need z-index to not be painted over by subsequent rows
                                        ...(isMerged && mergeRows > 1 ? { position: 'relative', zIndex: 5 } : {}),
                                        ...(isFrozenCell ? { position: 'sticky', left: ROW_HEADER_WIDTH + colOffsets[c], zIndex: 21 } : {}),
                                    }

                                    const inDragFill = isDragFilling && dragFillEnd && selectionBounds && (
                                        (dragFillEnd.r > selectionBounds.maxR && r > selectionBounds.maxR && r <= dragFillEnd.r && c >= selectionBounds.minC && c <= selectionBounds.maxC) ||
                                        (dragFillEnd.c > selectionBounds.maxC && c > selectionBounds.maxC && c <= dragFillEnd.c && r >= selectionBounds.minR && r <= selectionBounds.maxR)
                                    )

                                    return (
                                        <div
                                            key={c}
                                            className={cn(
                                                "border-r border-b text-[13px] px-1 flex items-center outline-none relative shrink-0 overflow-hidden",
                                                showGridlines ? "border-[#e3e3e3] dark:border-[#5f6368]" : "border-transparent",
                                                !style?.fillColor && !condColor && !inRect && !inDragFill && !bandedBg && "bg-background dark:bg-[#1a1a1a]",
                                                inDragFill && "bg-[#e8f0fe]/40",
                                                isFindMatch && !isCurrentFind && "ring-1 ring-inset ring-yellow-400",
                                                isCurrentFind && "ring-2 ring-inset ring-orange-500"
                                            )}
                                            style={cellStyle}
                                            onMouseDown={(e) => { if (!isReadOnly) handleCellMouseDown(r, c, e) }}
                                            onMouseEnter={() => { if (!isReadOnly) handleCellMouseEnter(r, c); if (hasComment) setHoveredComment({ r, c, x: ROW_HEADER_WIDTH + colOffsets[c] + cellW, y: COL_HEADER_HEIGHT + rowOffsets[r] }) }}
                                            onMouseLeave={() => { if (hoveredComment?.r === r && hoveredComment?.c === c) setHoveredComment(null) }}
                                            onDoubleClick={() => { if (!isReadOnly) handleDoubleClick(r, c) }}
                                            onContextMenu={(e) => { if (!isReadOnly) handleContextMenu(r, c, e) }}
                                        >
                                            {/* Comment indicator triangle */}
                                            {hasComment && <div className="absolute top-0 right-0 w-0 h-0 z-[6]" style={{ borderLeft: '6px solid transparent', borderTop: '6px solid #ff9900' }} />}
                                            {/* Lock indicator */}
                                            {isLocked && <div className="absolute bottom-0 left-0 z-[6] opacity-30 pointer-events-none"><Lock className="w-2.5 h-2.5" /></div>}
                                            {/* Validation dropdown arrow */}
                                            {hasValidation && !isEditing && (
                                                <button className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[#5f6368] hover:text-[#202124] z-[6] opacity-0 hover:opacity-100 group-hover:opacity-100" style={{ opacity: (isActive || validationDropdown?.r === r && validationDropdown?.c === c) ? 1 : undefined }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setValidationDropdown(validationDropdown?.r === r && validationDropdown?.c === c ? null : { r, c }) }}>
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            )}
                                            {condColor && <div className="absolute inset-0 border-l-[3px] pointer-events-none z-[5]" style={{ borderColor: condColor }} />}
                                            {/* IDEA-022: Advanced cond format — data bar */}
                                            {advOverlay?.dataBar && (
                                                <div className="absolute inset-0 flex items-center pointer-events-none z-[4]">
                                                    <div style={{ width: `${advOverlay.dataBar.pct}%`, height: '70%', backgroundColor: advOverlay.dataBar.color, opacity: 0.45, borderRadius: 2 }} />
                                                </div>
                                            )}
                                            {/* IDEA-022: Advanced cond format — icon set */}
                                            {advOverlay?.icon && (
                                                <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none z-[6] leading-none">{advOverlay.icon}</span>
                                            )}
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
                                                <input ref={inputRef} className="w-full h-full border-none outline-none bg-background dark:bg-[#2d2e30] px-0.5 m-0 text-[13px] z-30 relative text-[#202124] dark:text-white" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit} spellCheck={false} />
                                            ) : isCheckbox ? (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <input type="checkbox" className="w-[15px] h-[15px] cursor-pointer accent-[#1a73e8]" checked={rawValue.toUpperCase() === 'TRUE'} onChange={(e) => { e.stopPropagation(); setCell(r, c, e.target.checked ? 'TRUE' : 'FALSE') }} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} />
                                                </div>
                                            ) : isSparkline ? (
                                                <SparklineCell value={evaluated} width={cellW - 4} height={cellH - 4} />
                                            ) : isUrl ? (
                                                <a href={evaluated} target="_blank" rel="noopener noreferrer" className="truncate w-full cursor-pointer hover:underline" onClick={(e) => e.stopPropagation()} style={style?.rotation ? { transform: `rotate(${style.rotation}deg)`, display: 'inline-block' } : undefined}>
                                                    <ExternalLink className="w-3 h-3 inline mr-1 opacity-60" />{displayValue}
                                                </a>
                                            ) : (
                                                <span className={cn(style?.wrap ? "w-full select-text break-words" : "truncate w-full select-text", isErrorVal && "text-[#d93025] font-semibold text-center", displayValue === "" && "opacity-0")} title={hasComment ? `💬 ${cellData!.comment}\n${rawValue}` : (isErrorVal ? "Erreur" : rawValue)} style={style?.rotation ? { transform: `rotate(${style.rotation}deg)`, display: 'inline-block', transformOrigin: 'left center' } : undefined}>
                                                    {displayValue}
                                                </span>
                                            )}
                                            {isBottomRight && !isEditing && (
                                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#1a73e8] border border-white dark:border-[#1a1a1a] rounded-sm cursor-crosshair z-30" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragFilling(true) }} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>

                {/* Floating Charts */}
                {floatingCharts.map(fc => (
                    <FloatingChart key={fc.id} id={fc.id} type={fc.type} title={fc.title}
                        chartData={fc.chartData} seriesNames={fc.seriesNames}
                        colors={fc.colors} showLegend={fc.showLegend}
                        onRemove={handleRemoveFloatingChart} />
                ))}
            </div>

            {/* ===== SHEET TABS + STATUS BAR ===== */}
            <div data-sheet-tabs className="flex items-center h-10 border-t border-[#e3e3e3] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] px-1 shrink-0 z-20 shadow-[0_-1px_3px_0_rgba(0,0,0,0.05)]">
                <button className="p-2 hover:bg-[#e8eaed] dark:hover:bg-[#303134] rounded-full text-[#5f6368] mx-1 transition-colors" onClick={() => addSheet(`Sheet${sheets.length + 1}`)}>
                    <Plus className="w-5 h-5" />
                </button>
                {sheets.map((sheet, i) => (
                    <div key={i} className={cn("px-5 py-2.5 text-[13px] font-medium transition-colors h-10 flex items-center mb-0 mt-auto relative group", i === activeSheetIndex ? "bg-background dark:bg-[#1f1f1f] text-[#1a73e8] dark:text-[#8ab4f8] border-x border-t border-[#e3e3e3] dark:border-[#3c4043] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] rounded-t-sm" : "text-[#5f6368] hover:bg-[#e8eaed] dark:hover:bg-[#303134] cursor-pointer")} style={sheet.color ? { borderBottom: `3px solid ${sheet.color}` } : undefined} onClick={() => setActiveSheetIndex(i)} onDoubleClick={() => { setEditingTabIndex(i); setEditingTabName(sheet.name) }} onContextMenu={(e) => { e.preventDefault(); setShowTabColorPicker(showTabColorPicker === i ? null : i) }}>
                        {editingTabIndex === i ? (
                            <input className="bg-transparent outline-none text-[13px] w-20 text-center" value={editingTabName} onChange={(e) => setEditingTabName(e.target.value)} onBlur={() => { renameSheet(i, editingTabName); setEditingTabIndex(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { renameSheet(i, editingTabName); setEditingTabIndex(null) } }} autoFocus />
                        ) : sheet.name}
                        {sheets.length > 1 && i === activeSheetIndex && (
                            <button className="ml-2 opacity-0 group-hover:opacity-100 text-[#5f6368] hover:text-red-500 transition-all" onClick={(e) => { e.stopPropagation(); removeSheet(i) }}><X className="w-3 h-3" /></button>
                        )}
                        {/* Tab color picker */}
                        {showTabColorPicker === i && (
                            <div className="absolute bottom-10 left-0 bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-lg z-50 p-2 w-36" onClick={(e) => e.stopPropagation()}>
                                <div className="grid grid-cols-5 gap-1 mb-1">
                                    {TAB_COLORS.map(color => (
                                        <button key={color} className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => { setSheetColor(sheet.id, color); setShowTabColorPicker(null) }} />
                                    ))}
                                </div>
                                <button className="text-[10px] text-[#1a73e8] hover:underline" onClick={() => { setSheetColor(sheet.id, undefined); setShowTabColorPicker(null) }}>Aucune</button>
                            </div>
                        )}
                    </div>
                ))}
                {/* Status bar */}
                <div className="ml-auto px-4 flex items-center gap-4 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
                    {selectionStats && (
                        <>
                            {selectionStats.sum !== undefined && (
                                <>
                                    <span>Somme: <strong className="text-[#202124] dark:text-[#e8eaed]">{Math.round(selectionStats.sum * 100) / 100}</strong></span>
                                    <span>Moy: <strong className="text-[#202124] dark:text-[#e8eaed]">{Math.round(selectionStats.avg! * 100) / 100}</strong></span>
                                    <span>Min: <strong className="text-[#202124] dark:text-[#e8eaed]">{selectionStats.min}</strong></span>
                                    <span>Max: <strong className="text-[#202124] dark:text-[#e8eaed]">{selectionStats.max}</strong></span>
                                </>
                            )}
                            <span>Nb: <strong className="text-[#202124] dark:text-[#e8eaed]">{selectionStats.count}</strong></span>
                        </>
                    )}
                    {!selectionStats && selectionBounds && (
                        <span>{indexToCol(selectionBounds.minC)}{selectionBounds.minR + 1}{selectionBounds.minR !== selectionBounds.maxR || selectionBounds.minC !== selectionBounds.maxC ? `:${indexToCol(selectionBounds.maxC)}${selectionBounds.maxR + 1}` : ''}</span>
                    )}
                </div>
            </div>

            {/* ===== OVERLAYS ===== */}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextAction} onClose={() => setContextMenu(null)} />}
            {chart && <MiniChart type={chart.type} values={chart.values} onClose={() => setChart(null)} />}
            {showCondFormat && <CondFormatDialog rules={condRules} onAdd={(rule) => setCondRules(prev => [...prev, rule])} onRemove={(i) => setCondRules(prev => prev.filter((_, idx) => idx !== i))} onClose={() => setShowCondFormat(false)} />}
            {showFilterDialog && filterCol !== null && <FilterDialog col={filterCol} data={data} onApply={(values) => { setFilterValues(values); toast.success(`Filtre appliqu\u00E9 sur ${indexToCol(filterCol)}`) }} onClose={() => setShowFilterDialog(false)} />}

            {/* AI Dialog */}
            {showAiDialog && (
                <AiSheetsDialog
                    onClose={() => setShowAiDialog(false)}
                    selectionBounds={selectionBounds}
                    data={data}
                    onApplyResult={(val, r, c) => { setEditValue(val); setCell(r, c, val) }}
                    activeCell={activeCell}
                />
            )}

            {/* Pivot Table Dialog */}
            {showPivotDialog && (
                <PivotTableDialog
                    data={data}
                    onClose={() => setShowPivotDialog(false)}
                    onInsertSheet={handlePivotInsert}
                />
            )}

            {/* Advanced Chart Dialog */}
            {showChartDialog && (
                <ChartDialog
                    data={data}
                    evaluatedData={evaluatedData}
                    selectionBounds={selectionBounds}
                    onClose={() => setShowChartDialog(false)}
                    onInsertChart={handleInsertChart}
                />
            )}

            {/* Macro Editor */}
            {showMacroEditor && (
                <MacroEditor
                    data={data}
                    evaluatedData={evaluatedData}
                    sheetId={sheets[activeSheetIndex]?.id || 'default'}
                    sheetName={sheets[activeSheetIndex]?.name || 'Sheet1'}
                    setCell={setCell}
                    transact={transact}
                    onClose={() => setShowMacroEditor(false)}
                />
            )}

            {/* Comment tooltip */}
            {hoveredComment && gridRef.current && (() => {
                const cellData = data[`${hoveredComment.r},${hoveredComment.c}`]
                if (!cellData?.comment) return null
                const rect = gridRef.current!.getBoundingClientRect()
                return (
                    <div className="fixed z-[250] bg-[#fff9c4] dark:bg-[#554800] border border-[#fbc02d] rounded shadow-lg px-3 py-2 max-w-[250px] text-[12px] text-[#202124] dark:text-[#e8eaed] pointer-events-none" style={{ left: rect.left + hoveredComment.x - gridRef.current!.scrollLeft, top: rect.top + hoveredComment.y - gridRef.current!.scrollTop }}>
                        {cellData.comment}
                    </div>
                )
            })()}

            {/* Validation dropdown */}
            {validationDropdown && gridRef.current && (() => {
                const cellData = data[`${validationDropdown.r},${validationDropdown.c}`]
                if (!cellData?.validation) return null
                const rect = gridRef.current!.getBoundingClientRect()
                const x = rect.left + ROW_HEADER_WIDTH + colOffsets[validationDropdown.c] - gridRef.current!.scrollLeft
                const y = rect.top + COL_HEADER_HEIGHT + rowOffsets[validationDropdown.r] + getRowHeight(validationDropdown.r) - gridRef.current!.scrollTop
                return (
                    <div className="fixed z-[250] bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl py-1 min-w-[140px] text-[13px]" style={{ left: x, top: y }}>
                        {cellData.validation.type === 'list' && cellData.validation.values.map((val: string) => (
                            <button key={val} className={cn("w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]", cellData.value === val && "bg-[#e8f0fe] dark:bg-[#3c4043] font-medium")} onClick={() => { setCell(validationDropdown.r, validationDropdown.c, val); setValidationDropdown(null) }}>
                                {val}
                            </button>
                        ))}
                    </div>
                )
            })()}

            {/* Formula Autocomplete Dropdown */}
            {isEditing && autocompleteSuggestions.length > 0 && activeCell && (
                <div className="fixed z-[300] bg-background dark:bg-[#2d2e30] border border-[#dadce0] dark:border-[#5f6368] rounded-lg shadow-xl py-1 min-w-[280px] text-[13px]" style={{ left: (() => { if (!gridRef.current) return 100; const rect = gridRef.current.getBoundingClientRect(); return rect.left + ROW_HEADER_WIDTH + colOffsets[activeCell.c] - gridRef.current.scrollLeft })(), top: (() => { if (!gridRef.current) return 100; const rect = gridRef.current.getBoundingClientRect(); return rect.top + COL_HEADER_HEIGHT + rowOffsets[activeCell.r] + getRowHeight(activeCell.r) - gridRef.current.scrollTop })() }}>
                    {autocompleteSuggestions.map((fn, i) => {
                        const fnInfo = ALL_FUNCTIONS.find(f => f.name === fn)
                        return (
                            <button key={fn} className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]", i === autocompleteIdx && "bg-[#e8f0fe] dark:bg-[#3c4043]")} onMouseDown={(e) => { e.preventDefault(); insertAutocomplete(fn) }}>
                                <span className="font-mono text-[#1a73e8] font-medium">{fn}</span>
                                <span className="text-[#5f6368] dark:text-[#9aa0a6] text-[11px] truncate">{fnInfo?.desc}</span>
                            </button>
                        )
                    })}
                    <div className="px-3 py-1 text-[10px] text-[#9aa0a6] border-t border-[#e3e3e3] dark:border-[#5f6368] mt-0.5">Tab pour insérer</div>
                </div>
            )}

            {/* IDEA-018: Named ranges dialog */}
            {showNamedRanges && (
                <NamedRangesDialog
                    namedRanges={namedRanges}
                    onAdd={(nr) => setNamedRanges(prev => [...prev, nr])}
                    onRemove={(name) => setNamedRanges(prev => prev.filter(n => n.name !== name))}
                    onUpdate={(oldName, nr) => setNamedRanges(prev => prev.map(n => n.name === oldName ? nr : n))}
                    onClose={() => setShowNamedRanges(false)}
                />
            )}

            {/* IDEA-020: Print preview */}
            {showPrintPreview && (
                <PrintPreviewDialog
                    data={data}
                    evaluatedData={evaluatedData}
                    colWidths={colWidths}
                    rowHeights={rowHeights}
                    sheetName={sheets[activeSheetIndex]?.name || 'Sheet1'}
                    onClose={() => setShowPrintPreview(false)}
                />
            )}

            {/* IDEA-021: Advanced data validation */}
            {showAdvancedValidation && activeCell && (
                <AdvancedValidationDialog
                    current={data[`${activeCell.r},${activeCell.c}`]?.validation as AdvancedValidation | undefined}
                    onApply={(v) => {
                        if (activeCell) setCellValidation(activeCell.r, activeCell.c, v as any)
                    }}
                    onClose={() => setShowAdvancedValidation(false)}
                />
            )}

            {/* IDEA-022: Advanced conditional formatting */}
            {showAdvCondFormat && (
                <AdvancedCondFormatDialog
                    rules={advCondRules}
                    onAdd={(rule) => setAdvCondRules(prev => [...prev, rule])}
                    onRemove={(id) => setAdvCondRules(prev => prev.filter(r => r.id !== id))}
                    onClose={() => setShowAdvCondFormat(false)}
                />
            )}

            {/* Hidden CSV/XLSX import input */}
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden" onChange={importFile} />
            
            <GenericFeatureModal 
                isOpen={!!activeModal} 
                actionId={activeModal?.id || null} 
                actionLabel={activeModal?.label}
                onClose={() => setActiveModal(null)} 
            />
        </div>
    )
}
