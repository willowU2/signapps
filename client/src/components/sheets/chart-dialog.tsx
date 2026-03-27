"use client"

import React, { useState, useMemo, useCallback, useRef } from "react"
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    ScatterChart, Scatter, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { cn } from "@/lib/utils"
import { CellData, SelectionBounds, COLS } from "./types"
import { X, BarChart2, TrendingUp, PieChart as PieIcon, ScatterChart as ScatterIcon, AreaChart as AreaIcon, Download, Palette } from "lucide-react"
import { toast } from "sonner"

type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area'

const CHART_COLORS = ['#4a86e8', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#9334e6', '#d81b60']

const CHART_TYPES: { type: ChartType, label: string, icon: React.ReactNode }[] = [
    { type: 'bar', label: 'Barres', icon: <BarChart2 className="w-5 h-5" /> },
    { type: 'line', label: 'Ligne', icon: <TrendingUp className="w-5 h-5" /> },
    { type: 'pie', label: 'Circulaire', icon: <PieIcon className="w-5 h-5" /> },
    { type: 'scatter', label: 'Nuage', icon: <ScatterIcon className="w-5 h-5" /> },
    { type: 'area', label: 'Aire', icon: <AreaIcon className="w-5 h-5" /> },
]

interface ChartConfig {
    type: ChartType
    title: string
    xLabel: string
    yLabel: string
    showLegend: boolean
    colors: string[]
}

interface ParsedData {
    labels: string[]
    series: { name: string, values: number[] }[]
}

function parseSelectionData(
    data: Record<string, CellData>,
    evaluatedData: Record<string, string>,
    bounds: SelectionBounds
): ParsedData {
    const numCols = bounds.maxC - bounds.minC + 1
    const numRows = bounds.maxR - bounds.minR + 1

    const getValue = (r: number, c: number): string => {
        return evaluatedData[`${r},${c}`] || data[`${r},${c}`]?.value || ''
    }

    // Check if first row looks like headers
    let hasHeaders = false
    if (numRows > 1) {
        const firstRowNumeric = Array.from({ length: numCols }, (_, i) => {
            const v = getValue(bounds.minR, bounds.minC + i)
            return v && !isNaN(Number(v))
        })
        hasHeaders = firstRowNumeric.filter(Boolean).length < numCols / 2
    }

    const headerRow = hasHeaders ? bounds.minR : -1
    const dataStartRow = hasHeaders ? bounds.minR + 1 : bounds.minR

    // First column = labels, remaining columns = data series
    const labels: string[] = []
    for (let r = dataStartRow; r <= bounds.maxR; r++) {
        labels.push(getValue(r, bounds.minC))
    }

    const series: { name: string, values: number[] }[] = []
    for (let c = bounds.minC + (numCols > 1 ? 1 : 0); c <= bounds.maxC; c++) {
        const name = headerRow >= 0 ? getValue(headerRow, c) : `Serie ${c - bounds.minC}`
        const values: number[] = []
        for (let r = dataStartRow; r <= bounds.maxR; r++) {
            const raw = getValue(r, c)
            values.push(isNaN(Number(raw)) ? 0 : Number(raw))
        }
        series.push({ name, values })
    }

    // If only one column selected, use row values as single series
    if (numCols === 1) {
        const values: number[] = []
        for (let r = dataStartRow; r <= bounds.maxR; r++) {
            const raw = getValue(r, bounds.minC)
            values.push(isNaN(Number(raw)) ? 0 : Number(raw))
        }
        return {
            labels: labels.map((_, i) => String(i + 1)),
            series: [{ name: headerRow >= 0 ? getValue(headerRow, bounds.minC) : 'Valeurs', values }]
        }
    }

    return { labels, series }
}

interface ChartDialogProps {
    data: Record<string, CellData>
    evaluatedData: Record<string, string>
    selectionBounds: SelectionBounds | null
    onClose: () => void
    onInsertChart: (config: ChartConfig, parsed: ParsedData) => void
}

export function ChartDialog({ data, evaluatedData, selectionBounds, onClose, onInsertChart }: ChartDialogProps) {
    const [config, setConfig] = useState<ChartConfig>({
        type: 'bar',
        title: '',
        xLabel: '',
        yLabel: '',
        showLegend: true,
        colors: [...CHART_COLORS],
    })

    const chartRef = useRef<HTMLDivElement>(null)

    const parsed = useMemo(() => {
        if (!selectionBounds) return { labels: [], series: [] }
        return parseSelectionData(data, evaluatedData, selectionBounds)
    }, [data, evaluatedData, selectionBounds])

    // Build recharts data format
    const chartData = useMemo(() => {
        return parsed.labels.map((label, i) => {
            const entry: Record<string, string | number> = { label }
            parsed.series.forEach(s => { entry[s.name] = s.values[i] ?? 0 })
            return entry
        })
    }, [parsed])

    const exportPNG = useCallback(async () => {
        if (!chartRef.current) return
        try {
            const svg = chartRef.current.querySelector('svg')
            if (!svg) { toast.error('Pas de graphique a exporter'); return }

            const svgData = new XMLSerializer().serializeToString(svg)
            const canvas = document.createElement('canvas')
            const svgRect = svg.getBoundingClientRect()
            canvas.width = svgRect.width * 2
            canvas.height = svgRect.height * 2
            const ctx = canvas.getContext('2d')!
            ctx.scale(2, 2)

            const img = new Image()
            img.onload = () => {
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0)
                const link = document.createElement('a')
                link.download = `chart-${config.type}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
                toast.success('Graphique exporte en PNG')
            }
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
        } catch {
            toast.error("Erreur lors de l'export")
        }
    }, [config.type])

    if (!selectionBounds) {
        return (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
                <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-6 w-[400px]" onClick={e => e.stopPropagation()}>
                    <p className="text-sm text-center">Selectionnez une plage de donnees avant de creer un graphique.</p>
                    <button onClick={onClose} className="mt-4 w-full h-9 bg-[#1a73e8] text-white rounded text-[13px] hover:bg-[#1557b0]">Fermer</button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]" onClick={onClose}>
            <div className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl w-[750px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#dadce0] dark:border-[#5f6368]">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-[#1a73e8]" />
                        <span className="font-medium text-[15px]">Inserer un graphique</span>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5" /></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left panel: config */}
                    <div className="w-[220px] border-r border-[#dadce0] dark:border-[#5f6368] p-3 space-y-3 overflow-y-auto">
                        {/* Chart type selector */}
                        <div>
                            <div className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wide">Type</div>
                            <div className="grid grid-cols-3 gap-1">
                                {CHART_TYPES.map(ct => (
                                    <button key={ct.type} onClick={() => setConfig(prev => ({ ...prev, type: ct.type }))}
                                        className={cn(
                                            "flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-colors",
                                            config.type === ct.type
                                                ? "border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#394457] text-[#1a73e8]"
                                                : "border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]"
                                        )}
                                    >
                                        {ct.icon}
                                        {ct.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1 block uppercase tracking-wide">Titre</label>
                            <input className="w-full h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none" placeholder="Titre du graphique"
                                value={config.title} onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))} />
                        </div>

                        {/* Axis labels */}
                        {config.type !== 'pie' && (
                            <>
                                <div>
                                    <label className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1 block uppercase tracking-wide">Axe X</label>
                                    <input className="w-full h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                                        value={config.xLabel} onChange={e => setConfig(prev => ({ ...prev, xLabel: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1 block uppercase tracking-wide">Axe Y</label>
                                    <input className="w-full h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                                        value={config.yLabel} onChange={e => setConfig(prev => ({ ...prev, yLabel: e.target.value }))} />
                                </div>
                            </>
                        )}

                        {/* Legend toggle */}
                        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                            <input type="checkbox" checked={config.showLegend} onChange={e => setConfig(prev => ({ ...prev, showLegend: e.target.checked }))} className="accent-[#1a73e8]" />
                            Afficher la legende
                        </label>

                        {/* Color palette */}
                        <div>
                            <div className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1 uppercase tracking-wide flex items-center gap-1"><Palette className="w-3 h-3" /> Couleurs</div>
                            <div className="flex gap-1 flex-wrap">
                                {parsed.series.map((s, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <input type="color" value={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                                            onChange={e => {
                                                const colors = [...config.colors]
                                                colors[i] = e.target.value
                                                setConfig(prev => ({ ...prev, colors }))
                                            }}
                                            className="w-6 h-6 rounded cursor-pointer border border-[#dadce0]" />
                                        <span className="text-[10px] truncate max-w-[60px]">{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right panel: preview */}
                    <div className="flex-1 p-4 flex flex-col">
                        {config.title && (
                            <div className="text-center text-[14px] font-medium mb-2">{config.title}</div>
                        )}
                        <div ref={chartRef} className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {config.type === 'bar' ? (
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5 } : undefined} tick={{ fontSize: 11 }} />
                                        <YAxis label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft' } : undefined} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        {config.showLegend && <Legend />}
                                        {parsed.series.map((s, i) => (
                                            <Bar key={s.name} dataKey={s.name} fill={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </BarChart>
                                ) : config.type === 'line' ? (
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5 } : undefined} tick={{ fontSize: 11 }} />
                                        <YAxis label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft' } : undefined} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        {config.showLegend && <Legend />}
                                        {parsed.series.map((s, i) => (
                                            <Line key={s.name} type="monotone" dataKey={s.name} stroke={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                        ))}
                                    </LineChart>
                                ) : config.type === 'pie' ? (
                                    <PieChart>
                                        <Tooltip />
                                        {config.showLegend && <Legend />}
                                        <Pie
                                            data={chartData.map((d, i) => ({ name: d.label, value: d[parsed.series[0]?.name ?? ''] as number }))}
                                            dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" label={{ fontSize: 11 }}
                                        >
                                            {chartData.map((_, i) => (
                                                <Cell key={i} fill={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                ) : config.type === 'scatter' ? (
                                    <ScatterChart>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="x" name={config.xLabel || 'X'} tick={{ fontSize: 11 }} />
                                        <YAxis dataKey="y" name={config.yLabel || 'Y'} tick={{ fontSize: 11 }} />
                                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                        {config.showLegend && <Legend />}
                                        <Scatter name={parsed.series[0]?.name || 'Data'}
                                            data={parsed.labels.map((_, i) => ({
                                                x: parsed.series[0]?.values[i] ?? 0,
                                                y: parsed.series[1]?.values[i] ?? parsed.series[0]?.values[i] ?? 0
                                            }))}
                                            fill={config.colors[0] || CHART_COLORS[0]}
                                        />
                                    </ScatterChart>
                                ) : (
                                    <AreaChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5 } : undefined} tick={{ fontSize: 11 }} />
                                        <YAxis label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft' } : undefined} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        {config.showLegend && <Legend />}
                                        {parsed.series.map((s, i) => (
                                            <Area key={s.name} type="monotone" dataKey={s.name}
                                                fill={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                                                stroke={config.colors[i] || CHART_COLORS[i % CHART_COLORS.length]}
                                                fillOpacity={0.3} />
                                        ))}
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#dadce0] dark:border-[#5f6368]">
                    <button onClick={exportPNG} className="flex items-center gap-1.5 px-3 h-8 border border-[#dadce0] dark:border-[#5f6368] rounded text-[12px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">
                        <Download className="w-3.5 h-3.5" /> Exporter PNG
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 h-9 border border-[#dadce0] dark:border-[#5f6368] rounded text-[13px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]">Annuler</button>
                        <button onClick={() => { onInsertChart(config, parsed); toast.success('Graphique insere'); onClose() }}
                            className="px-4 h-9 bg-[#1a73e8] text-white rounded text-[13px] hover:bg-[#1557b0] font-medium">
                            Inserer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
