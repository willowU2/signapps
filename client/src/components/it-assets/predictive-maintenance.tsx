"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Activity, HardDrive, Cpu, CheckCircle } from "lucide-react"
import { HardwareAsset, AgentMetric } from "@/lib/api/it-assets"

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info"

interface Prediction {
    assetId: string
    assetName: string
    category: "disk" | "stability" | "cpu"
    severity: Severity
    message: string
    recommendation: string
    value?: number
}

interface MetricsByAsset {
    [assetId: string]: AgentMetric[]
}

// ─── Heuristics ───────────────────────────────────────────────────────────────

const DISK_GROWTH_THRESHOLD = 5        // %/week to trigger warning
const DISK_CRITICAL_DAYS    = 14       // days left to trigger critical
const DISK_WARNING_DAYS     = 30
const CPU_SUSTAINED_HIGH    = 85       // % CPU average to flag as degraded
const CPU_CRITICAL           = 95
const REBOOT_COUNT_THRESHOLD = 3       // reboots in window = instability

function analyzeAsset(asset: HardwareAsset, metrics: AgentMetric[]): Prediction[] {
    const predictions: Prediction[] = []
    if (!metrics.length) return predictions

    // Sort metrics by time ascending
    const sorted = [...metrics].sort(
        (a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime()
    )

    const latest = sorted[sorted.length - 1]

    // ── Disk usage trend ──────────────────────────────────────────────────────
    if (latest.disk_usage != null && sorted.length >= 2) {
        const oldest = sorted[0]
        if (oldest.disk_usage != null) {
            const msDiff = new Date(latest.collected_at).getTime() - new Date(oldest.collected_at).getTime()
            const weeksDiff = msDiff / (1000 * 60 * 60 * 24 * 7)
            if (weeksDiff > 0) {
                const growthPerWeek = (latest.disk_usage - oldest.disk_usage) / weeksDiff

                if (growthPerWeek >= DISK_GROWTH_THRESHOLD && latest.disk_usage < 100) {
                    const remaining = 100 - latest.disk_usage
                    const daysUntilFull = (remaining / growthPerWeek) * 7

                    let severity: Severity = "info"
                    if (daysUntilFull <= DISK_CRITICAL_DAYS) severity = "critical"
                    else if (daysUntilFull <= DISK_WARNING_DAYS) severity = "warning"

                    predictions.push({
                        assetId: asset.id,
                        assetName: asset.name,
                        category: "disk",
                        severity,
                        message: `Disque plein dans ~${Math.round(daysUntilFull)} jours (${latest.disk_usage.toFixed(0)}% utilise, +${growthPerWeek.toFixed(1)}%/sem)`,
                        recommendation: severity === "critical"
                            ? "Nettoyer immediatement ou augmenter l'espace disque"
                            : "Planifier un nettoyage ou une extension de stockage",
                        value: latest.disk_usage,
                    })
                } else if (latest.disk_usage >= 90) {
                    // High usage even without growth trend
                    predictions.push({
                        assetId: asset.id,
                        assetName: asset.name,
                        category: "disk",
                        severity: latest.disk_usage >= 95 ? "critical" : "warning",
                        message: `Usage disque eleve: ${latest.disk_usage.toFixed(0)}%`,
                        recommendation: "Liberer de l'espace ou ajouter du stockage",
                        value: latest.disk_usage,
                    })
                }
            }
        }
    }

    // ── CPU sustained high usage ──────────────────────────────────────────────
    if (latest.cpu_usage != null) {
        const cpuValues = sorted.filter(m => m.cpu_usage != null).map(m => m.cpu_usage!)
        const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length
        const highCount = cpuValues.filter(v => v >= CPU_SUSTAINED_HIGH).length
        const highPct = (highCount / cpuValues.length) * 100

        if (avgCpu >= CPU_SUSTAINED_HIGH || highPct >= 60) {
            predictions.push({
                assetId: asset.id,
                assetName: asset.name,
                category: "cpu",
                severity: avgCpu >= CPU_CRITICAL ? "critical" : "warning",
                message: `Performance degradee — CPU moyen ${avgCpu.toFixed(0)}% (${highPct.toFixed(0)}% du temps > ${CPU_SUSTAINED_HIGH}%)`,
                recommendation: avgCpu >= CPU_CRITICAL
                    ? "Identifier et terminer les processus excessifs, envisager une mise a niveau materielle"
                    : "Analyser les processus en arriere-plan, optimiser les services",
                value: avgCpu,
            })
        }
    }

    // ── Uptime / reboot instability ───────────────────────────────────────────
    if (latest.uptime_seconds != null && sorted.length >= 2) {
        let rebootCount = 0
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1]
            const curr = sorted[i]
            if (
                prev.uptime_seconds != null &&
                curr.uptime_seconds != null &&
                curr.uptime_seconds < prev.uptime_seconds
            ) {
                rebootCount++
            }
        }
        if (rebootCount >= REBOOT_COUNT_THRESHOLD) {
            predictions.push({
                assetId: asset.id,
                assetName: asset.name,
                category: "stability",
                severity: rebootCount >= REBOOT_COUNT_THRESHOLD * 2 ? "critical" : "warning",
                message: `Instabilite detectee — ${rebootCount} redemarrage(s) non planifie(s)`,
                recommendation: "Verifier les journaux systeme, la memoire (RAM) et les mises a jour en attente",
            })
        }
    }

    return predictions
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, { badge: string; icon: React.ReactNode; border: string }> = {
    critical: {
        badge: "bg-red-500/10 text-red-600 border-red-500/20",
        icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />,
        border: "border-l-red-500",
    },
    warning: {
        badge: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        icon: <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />,
        border: "border-l-orange-500",
    },
    info: {
        badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        icon: <Activity className="h-4 w-4 text-blue-500 shrink-0" />,
        border: "border-l-blue-500",
    },
}

const CATEGORY_ICON: Record<Prediction["category"], React.ReactNode> = {
    disk: <HardDrive className="h-3.5 w-3.5" />,
    cpu: <Cpu className="h-3.5 w-3.5" />,
    stability: <Activity className="h-3.5 w-3.5" />,
}

const CATEGORY_LABEL: Record<Prediction["category"], string> = {
    disk: "Disque",
    cpu: "CPU",
    stability: "Stabilite",
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PredictiveMaintenanceProps {
    assets: HardwareAsset[]
    metricsByAsset: MetricsByAsset
}

export function PredictiveMaintenance({ assets, metricsByAsset }: PredictiveMaintenanceProps) {
    const predictions = useMemo(() => {
        const all: Prediction[] = []
        for (const asset of assets) {
            const metrics = metricsByAsset[asset.id] ?? []
            all.push(...analyzeAsset(asset, metrics))
        }
        // Sort: critical first, then warning, then info
        const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
        return all.sort((a, b) => order[a.severity] - order[b.severity])
    }, [assets, metricsByAsset])

    const critical = predictions.filter(p => p.severity === "critical").length
    const warning  = predictions.filter(p => p.severity === "warning").length

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4 text-primary" />
                        Maintenance Predictive
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {critical > 0 && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                                {critical} critique{critical > 1 ? "s" : ""}
                            </Badge>
                        )}
                        {warning > 0 && (
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                                {warning} attention
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {predictions.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        Aucun probleme detecte sur le parc. Tous les equipements semblent sains.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {predictions.map((p, i) => {
                            const styles = SEVERITY_STYLES[p.severity]
                            return (
                                <div
                                    key={`${p.assetId}-${p.category}-${i}`}
                                    className={`flex gap-3 rounded-lg border-l-4 border border-border bg-card px-3 py-2.5 ${styles.border}`}
                                >
                                    {styles.icon}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-sm font-medium text-foreground">{p.assetName}</span>
                                            <Badge className={`text-xs gap-1 ${styles.badge}`}>
                                                {CATEGORY_ICON[p.category]}
                                                {CATEGORY_LABEL[p.category]}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-foreground">{p.message}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            <span className="font-medium">Action :</span> {p.recommendation}
                                        </p>
                                    </div>
                                    {p.value != null && (
                                        <div className="text-right shrink-0">
                                            <span className={`text-lg font-bold ${
                                                p.severity === "critical" ? "text-red-600"
                                                : p.severity === "warning" ? "text-orange-600"
                                                : "text-blue-600"
                                            }`}>
                                                {p.value.toFixed(0)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
