"use client"

import { useState } from "react"
import { X, Printer, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CellData } from "./types"
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT } from "./types"

interface PrintPreviewProps {
    data: Record<string, CellData>
    evaluatedData: Record<string, string>
    colWidths: Record<number, number>
    rowHeights: Record<number, number>
    sheetName: string
    onClose: () => void
}

const PAGE_WIDTH_PT = 794   // A4 at 96 dpi
const PAGE_HEIGHT_PT = 1123
const MARGIN = 40

export function PrintPreviewDialog({ data, evaluatedData, colWidths, rowHeights, sheetName, onClose }: PrintPreviewProps) {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
    const [showHeaders, setShowHeaders] = useState(true)
    const [page, setPage] = useState(0)

    const pageW = orientation === 'portrait' ? PAGE_WIDTH_PT : PAGE_HEIGHT_PT
    const pageH = orientation === 'portrait' ? PAGE_HEIGHT_PT : PAGE_WIDTH_PT
    const printW = pageW - MARGIN * 2
    const printH = pageH - MARGIN * 2

    const getColWidth = (c: number) => colWidths[c] ?? DEFAULT_COL_WIDTH
    const getRowHeight = (r: number) => rowHeights[r] ?? DEFAULT_ROW_HEIGHT

    // Find data bounds
    let maxR = 0, maxC = 0
    for (const key of Object.keys(data)) {
        const [r, c] = key.split(',').map(Number)
        if (r > maxR) maxR = r
        if (c > maxC) maxC = c
    }

    // Compute page breaks by row (rows that fit in printH)
    const pageBreaks: number[] = [0]
    let accH = 0
    for (let r = 0; r <= maxR; r++) {
        const rh = getRowHeight(r)
        if (accH + rh > printH && accH > 0) {
            pageBreaks.push(r)
            accH = rh
        } else {
            accH += rh
        }
    }
    const totalPages = pageBreaks.length

    const startRow = pageBreaks[page] ?? 0
    const endRow = page + 1 < pageBreaks.length ? pageBreaks[page + 1] - 1 : maxR

    const handlePrint = () => window.print()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300]" onClick={onClose}>
            <div className="bg-background rounded-xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Aperçu avant impression — {sheetName}</span>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <input type="checkbox" checked={showHeaders} onChange={e => setShowHeaders(e.target.checked)} className="accent-[#1a73e8]" />
                            En-têtes
                        </label>
                        <select
                            className="h-7 bg-muted rounded px-2 text-[12px] outline-none"
                            value={orientation}
                            onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')}
                        >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Paysage</option>
                        </select>
                        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 h-7 bg-[#1a73e8] text-white rounded text-[12px] font-medium hover:bg-[#1557b0]">
                            <Printer className="w-3.5 h-3.5" />
                            Imprimer
                        </button>
                        <button onClick={onClose}><X className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* Page preview */}
                <div className="flex-1 overflow-auto bg-muted dark:bg-gray-800 p-6 flex items-start justify-center">
                    <div
                        className="bg-card shadow-xl border border-border relative"
                        style={{ width: pageW * 0.6, height: pageH * 0.6, overflow: 'hidden' }}
                    >
                        {/* Margin lines */}
                        <div className="absolute inset-0 border-[1px] border-dashed border-blue-200 pointer-events-none" style={{ margin: MARGIN * 0.6 }} />

                        {/* Page number */}
                        <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-gray-400">
                            Page {page + 1} / {totalPages}
                        </div>

                        {/* Sheet name header */}
                        <div className="absolute top-3 left-0 right-0 text-center text-[8px] text-gray-400">
                            {sheetName}
                        </div>

                        {/* Grid content */}
                        <div style={{ position: 'absolute', top: MARGIN * 0.6, left: MARGIN * 0.6, overflow: 'hidden', maxWidth: printW * 0.6, maxHeight: printH * 0.6 }}>
                            <div className="flex text-[6px] font-medium bg-muted">
                                {showHeaders && <div style={{ width: 20, minWidth: 20, height: 12, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />}
                                {Array.from({ length: maxC + 1 }).map((_, c) => (
                                    <div key={c} style={{ width: getColWidth(c) * 0.4, minWidth: getColWidth(c) * 0.4, height: 12, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', textAlign: 'center', overflow: 'hidden' }}>
                                        {showHeaders ? String.fromCharCode(65 + c) : ''}
                                    </div>
                                ))}
                            </div>
                            {Array.from({ length: endRow - startRow + 1 }).map((_, ri) => {
                                const r = startRow + ri
                                return (
                                    <div key={r} className="flex text-[6px]">
                                        {showHeaders && <div style={{ width: 20, minWidth: 20, height: getRowHeight(r) * 0.4, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r + 1}</div>}
                                        {Array.from({ length: maxC + 1 }).map((_, c) => {
                                            const val = evaluatedData[`${r},${c}`] || data[`${r},${c}`]?.value || ''
                                            const style = data[`${r},${c}`]?.style
                                            return (
                                                <div key={c} style={{
                                                    width: getColWidth(c) * 0.4, minWidth: getColWidth(c) * 0.4, height: getRowHeight(r) * 0.4,
                                                    borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                                                    overflow: 'hidden', paddingLeft: 2, paddingRight: 2,
                                                    fontWeight: style?.bold ? 'bold' : undefined,
                                                    backgroundColor: style?.fillColor || undefined,
                                                    color: style?.textColor || '#111827',
                                                    display: 'flex', alignItems: 'center',
                                                    justifyContent: style?.align === 'center' ? 'center' : style?.align === 'right' ? 'flex-end' : 'flex-start'
                                                }}>
                                                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{val}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-4 py-3 border-t">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[12px] text-muted-foreground">Page {page + 1} sur {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
