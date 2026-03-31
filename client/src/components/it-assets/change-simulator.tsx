"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Play, CheckCircle, Zap, Clock, GitBranch, ShieldAlert } from "lucide-react"
import { HardwareAsset, ConfigurationItem, CIRelationship } from "@/lib/api/it-assets"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeType = "patch" | "reboot" | "config" | "decommission"

interface SimulationResult {
    riskScore: number        // 0-100
    riskLabel: string
    affectedCount: number
    affectedNames: string[]
    inMaintenanceWindow: boolean
    businessHoursRisk: boolean
    warnings: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANGE_TYPES: { value: ChangeType; label: string }[] = [
    { value: "patch",          label: "Application de patch" },
    { value: "reboot",         label: "Redemarrage" },
    { value: "config",         label: "Changement de configuration" },
    { value: "decommission",   label: "Decommissionnement" },
]

function isBusinessHours(): boolean {
    const h = new Date().getHours()
    const d = new Date().getDay()
    return d >= 1 && d <= 5 && h >= 8 && h < 18
}

function isMaintenanceWindow(): boolean {
    const h = new Date().getHours()
    const d = new Date().getDay()
    // Maintenance windows: Sat/Sun or weekday 00:00-06:00
    return d === 0 || d === 6 || h < 6
}

function getDownstreamIds(nodeId: string, relationships: CIRelationship[]): string[] {
    const visited = new Set<string>()
    const queue = [nodeId]
    while (queue.length > 0) {
        const cur = queue.shift()!
        if (visited.has(cur)) continue
        visited.add(cur)
        for (const r of relationships) {
            // A depends_on B → B going down affects A
            if (r.target_ci_id === cur && !visited.has(r.source_ci_id)) {
                queue.push(r.source_ci_id)
            }
            // hosted_on, part_of → propagate
            if (["hosted_on", "part_of"].includes(r.relationship_type) &&
                r.target_ci_id === cur && !visited.has(r.source_ci_id)) {
                queue.push(r.source_ci_id)
            }
        }
    }
    visited.delete(nodeId)
    return Array.from(visited)
}

function computeRisk(
    changeType: ChangeType,
    affectedCount: number,
    inMaintenance: boolean,
    businessHours: boolean,
): number {
    let score = 0

    // Base by change type
    const typeScores: Record<ChangeType, number> = {
        patch: 20, config: 35, reboot: 40, decommission: 60,
    }
    score += typeScores[changeType]

    // Cascade blast radius
    score += Math.min(affectedCount * 8, 30)

    // Business hours penalty
    if (businessHours) score += 20

    // Maintenance window bonus
    if (inMaintenance) score -= 15

    return Math.max(0, Math.min(100, score))
}

function riskLabel(score: number): string {
    if (score >= 70) return "Critique"
    if (score >= 50) return "Eleve"
    if (score >= 30) return "Moyen"
    return "Faible"
}

function riskColors(score: number): { badge: string; bar: string } {
    if (score >= 70) return { badge: "bg-red-500/10 text-red-600 border-red-500/20", bar: "bg-red-500" }
    if (score >= 50) return { badge: "bg-orange-500/10 text-orange-600 border-orange-500/20", bar: "bg-orange-500" }
    if (score >= 30) return { badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", bar: "bg-yellow-400" }
    return { badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", bar: "bg-emerald-500" }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ChangeSimulatorProps {
    assets: HardwareAsset[]
    cis: ConfigurationItem[]
    relationships: CIRelationship[]
    onApply?: (targetId: string, changeType: ChangeType, notes: string) => void
}

export function ChangeSimulator({ assets, cis, relationships, onApply }: ChangeSimulatorProps) {
    const [targetId, setTargetId] = useState("")
    const [changeType, setChangeType] = useState<ChangeType>("patch")
    const [notes, setNotes] = useState("")
    const [simResult, setSimResult] = useState<SimulationResult | null>(null)
    const [applying, setApplying] = useState(false)

    const targetOptions = useMemo(() => [
        ...assets.map(a => ({ id: a.id, label: `[HW] ${a.name}`, type: "hardware" })),
        ...cis.map(c => ({ id: c.id, label: `[CI] ${c.name}`, type: "ci" })),
    ], [assets, cis])

    function simulate() {
        if (!targetId) { toast.error("Selectionnez un equipement cible"); return }

        const downstreamIds = getDownstreamIds(targetId, relationships)
        const downstreamCis = downstreamIds
            .map(id => cis.find(c => c.id === id))
            .filter(Boolean) as ConfigurationItem[]

        const inMaint   = isMaintenanceWindow()
        const bizHours  = isBusinessHours()
        const score     = computeRisk(changeType, downstreamIds.length, inMaint, bizHours)

        const warnings: string[] = []
        if (bizHours)                            warnings.push("Changement pendant les heures de bureau — risque eleve d'impact utilisateur")
        if (!inMaint)                            warnings.push("Hors fenetre de maintenance — planifiez de preference le week-end ou entre 00h et 06h")
        if (downstreamIds.length >= 5)           warnings.push(`Impact important : ${downstreamIds.length} services/equipements dependants`)
        if (changeType === "decommission")       warnings.push("DECOMMISSIONNEMENT IRREVERSIBLE — verifier que tous les services sont migres")

        setSimResult({
            riskScore: score,
            riskLabel: riskLabel(score),
            affectedCount: downstreamIds.length,
            affectedNames: downstreamCis.map(c => c.name),
            inMaintenanceWindow: inMaint,
            businessHoursRisk: bizHours,
            warnings,
        })
    }

    async function apply() {
        if (!simResult) return
        setApplying(true)
        await new Promise(r => setTimeout(r, 800))
        onApply?.(targetId, changeType, notes)
        toast.success("Changement planifie / applique")
        setApplying(false)
        setSimResult(null)
        setTargetId("")
        setNotes("")
    }

    const colors = simResult ? riskColors(simResult.riskScore) : null

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <GitBranch className="h-4 w-4 text-primary" />
                    Simulateur d&apos;impact de changement
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Config */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs">Cible</Label>
                        <Select value={targetId} onValueChange={setTargetId}>
                            <SelectTrigger className="mt-1 h-8 text-sm">
                                <SelectValue placeholder="Selectionnez un equipement..." />
                            </SelectTrigger>
                            <SelectContent>
                                {targetOptions.map(o => (
                                    <SelectItem key={o.id} value={o.id} className="text-sm">
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Type de changement</Label>
                        <Select value={changeType} onValueChange={v => setChangeType(v as ChangeType)}>
                            <SelectTrigger className="mt-1 h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CHANGE_TYPES.map(ct => (
                                    <SelectItem key={ct.value} value={ct.value} className="text-sm">
                                        {ct.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Notes / justification</Label>
                    <Textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Raison du changement..."
                        className="mt-1 text-sm"
                        rows={2}
                    />
                </div>
                <Button onClick={simulate} className="w-full" variant="outline">
                    <Zap className="h-4 w-4 mr-2" />
                    Simuler l&apos;impact
                </Button>

                {/* Results */}
                {simResult && colors && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                        {/* Risk score */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Score de risque</span>
                            <Badge className={`${colors.badge} font-bold`}>
                                {simResult.riskScore}/100 — {simResult.riskLabel}
                            </Badge>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all ${colors.bar}`}
                                style={{ width: `${simResult.riskScore}%` }}
                            />
                        </div>

                        {/* Context */}
                        <div className="flex gap-2 flex-wrap">
                            <Badge className={`text-xs gap-1 ${simResult.inMaintenanceWindow
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-orange-500/10 text-orange-600"}`}>
                                <Clock className="h-3 w-3" />
                                {simResult.inMaintenanceWindow ? "Fenetre maintenance" : "Hors maintenance"}
                            </Badge>
                            <Badge className={`text-xs gap-1 ${simResult.businessHoursRisk
                                ? "bg-red-500/10 text-red-600"
                                : "bg-emerald-500/10 text-emerald-600"}`}>
                                {simResult.businessHoursRisk ? "Heures ouvrables" : "Hors heures ouvrables"}
                            </Badge>
                        </div>

                        {/* Affected services */}
                        {simResult.affectedCount > 0 ? (
                            <div>
                                <p className="text-xs font-medium mb-1">
                                    {simResult.affectedCount} element(s) dependant(s) affecte(s) :
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {simResult.affectedNames.slice(0, 8).map(n => (
                                        <Badge key={n} className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                                            {n}
                                        </Badge>
                                    ))}
                                    {simResult.affectedNames.length > 8 && (
                                        <Badge className="text-xs bg-muted text-muted-foreground">
                                            +{simResult.affectedNames.length - 8} autres
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-emerald-600">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Aucun service dependant impacte
                            </div>
                        )}

                        {/* Warnings */}
                        {simResult.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 rounded bg-amber-500/10 px-2 py-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700">{w}</p>
                            </div>
                        ))}

                        {/* Apply button */}
                        <Button
                            onClick={apply}
                            disabled={applying}
                            className={`w-full ${simResult.riskScore >= 70
                                ? "bg-red-600 hover:bg-red-700"
                                : simResult.riskScore >= 50
                                ? "bg-orange-500 hover:bg-orange-600"
                                : ""}`}
                        >
                            {applying
                                ? <><Play className="h-4 w-4 mr-2 animate-spin" />Application...</>
                                : <><ShieldAlert className="h-4 w-4 mr-2" />Appliquer le changement</>
                            }
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
