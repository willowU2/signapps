"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Plus, Trash2, Power, Moon, Calculator, Sun } from "lucide-react"
import { HardwareAsset } from "@/lib/api/it-assets"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PowerSchedule {
    id: string
    assetId: string
    action: "wake" | "sleep"
    time: string          // HH:MM
    days: number[]        // 0=Sun, 1=Mon, ... 6=Sat
    enabled: boolean
}

interface PowerProfile {
    assetId: string
    watts: number
    hoursPerDay: number
    costPerKwh: number    // e.g. 0.15
}

const LS_SCHEDULES = "it.power.schedules"
const LS_PROFILES  = "it.power.profiles"

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadSchedules(): PowerSchedule[] {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(LS_SCHEDULES) ?? "[]") }
    catch { return [] }
}

function saveSchedules(s: PowerSchedule[]) { localStorage.setItem(LS_SCHEDULES, JSON.stringify(s)) }

function loadProfiles(): PowerProfile[] {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(LS_PROFILES) ?? "[]") }
    catch { return [] }
}

function saveProfiles(p: PowerProfile[]) { localStorage.setItem(LS_PROFILES, JSON.stringify(p)) }

// ─── Calculator ───────────────────────────────────────────────────────────────

function calcMonthlyCost(watts: number, hoursPerDay: number, costPerKwh: number): number {
    const kwhPerDay  = (watts / 1000) * hoursPerDay
    const kwhPerMonth = kwhPerDay * 30.44
    return kwhPerMonth * costPerKwh
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PowerManagementProps {
    assets: HardwareAsset[]
}

export function PowerManagement({ assets }: PowerManagementProps) {
    const [schedules, setSchedules] = useState<PowerSchedule[]>([])
    const [profiles, setProfiles]   = useState<PowerProfile[]>([])

    // New schedule form
    const [sAssetId, setSAssetId] = useState("")
    const [sAction, setSAction]   = useState<"wake" | "sleep">("wake")
    const [sTime, setSTime]       = useState("08:00")
    const [sDays, setSDays]       = useState<number[]>([1, 2, 3, 4, 5])

    // Profile form
    const [pAssetId, setPAssetId]     = useState("")
    const [pWatts, setPWatts]         = useState(65)
    const [pHours, setPHours]         = useState(8)
    const [pCost, setPCost]           = useState(0.15)

    useEffect(() => {
        setSchedules(loadSchedules())
        setProfiles(loadProfiles())
    }, [])

    // ── Schedules ─────────────────────────────────────────────────────────────

    function addSchedule() {
        if (!sAssetId) { toast.error("Selectionnez un equipement"); return }
        const s: PowerSchedule = {
            id: `ps-${Date.now()}`,
            assetId: sAssetId,
            action: sAction,
            time: sTime,
            days: sDays,
            enabled: true,
        }
        const updated = [...schedules, s]
        setSchedules(updated)
        saveSchedules(updated)
        toast.success("Planning ajoute")
    }

    function toggleSchedule(id: string) {
        const updated = schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
        setSchedules(updated)
        saveSchedules(updated)
    }

    function removeSchedule(id: string) {
        const updated = schedules.filter(s => s.id !== id)
        setSchedules(updated)
        saveSchedules(updated)
        toast.success("Planning supprime")
    }

    function toggleDay(day: number) {
        setSDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    }

    // ── Profiles ──────────────────────────────────────────────────────────────

    function saveProfile() {
        if (!pAssetId) { toast.error("Selectionnez un equipement"); return }
        const existing = profiles.findIndex(p => p.assetId === pAssetId)
        let updated: PowerProfile[]
        if (existing >= 0) {
            updated = profiles.map((p, i) => i === existing ? { ...p, watts: pWatts, hoursPerDay: pHours, costPerKwh: pCost } : p)
        } else {
            updated = [...profiles, { assetId: pAssetId, watts: pWatts, hoursPerDay: pHours, costPerKwh: pCost }]
        }
        setProfiles(updated)
        saveProfiles(updated)
        toast.success("Profil energetique sauvegarde")
    }

    const totalMonthlyCost = profiles.reduce((sum, p) =>
        sum + calcMonthlyCost(p.watts, p.hoursPerDay, p.costPerKwh), 0)

    function getAssetName(id: string) {
        return assets.find(a => a.id === id)?.name ?? id
    }

    return (
        <div className="space-y-4">
            {/* Total cost banner */}
            {profiles.length > 0 && (
                <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-600" />
                        <div>
                            <p className="text-sm font-medium">Cout energetique estimé du parc</p>
                            <p className="text-2xl font-bold text-amber-700">
                                {totalMonthlyCost.toFixed(2)} €<span className="text-sm font-normal text-muted-foreground">/mois</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Schedule builder */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Power className="h-4 w-4 text-primary" />
                            Planification Wake / Sleep
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label className="text-xs">Equipement</Label>
                            <Select value={sAssetId} onValueChange={setSAssetId}>
                                <SelectTrigger className="mt-1 h-8 text-sm">
                                    <SelectValue placeholder="Selectionnez..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assets.map(a => (
                                        <SelectItem key={a.id} value={a.id} className="text-sm">{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Action</Label>
                                <Select value={sAction} onValueChange={v => setSAction(v as "wake" | "sleep")}>
                                    <SelectTrigger className="mt-1 h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="wake">
                                            <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5 text-yellow-500" />Wake (WoL)</span>
                                        </SelectItem>
                                        <SelectItem value="sleep">
                                            <span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5 text-blue-500" />Sleep</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">Heure</Label>
                                <Input type="time" value={sTime} onChange={e => setSTime(e.target.value)}
                                    className="mt-1 h-8 text-sm" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Jours</Label>
                            <div className="mt-1 flex gap-1">
                                {DAYS.map((d, i) => (
                                    <button
                                        key={i}
                                        onClick={() => toggleDay(i)}
                                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                            sDays.includes(i)
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button size="sm" className="w-full" onClick={addSchedule}>
                            <Plus className="h-3.5 w-3.5 mr-2" />
                            Ajouter ce planning
                        </Button>

                        {/* Schedule list */}
                        {schedules.length > 0 && (
                            <div className="space-y-2 border-t pt-3">
                                {schedules.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 rounded border px-3 py-2">
                                        {s.action === "wake"
                                            ? <Sun className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                                            : <Moon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{getAssetName(s.assetId)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {s.action === "wake" ? "Allumer" : "Eteindre"} à {s.time} — {s.days.map(d => DAYS[d]).join(", ")}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => toggleSchedule(s.id)}
                                            className={`h-5 w-9 rounded-full transition-colors ${s.enabled ? "bg-primary" : "bg-muted"}`}
                                        >
                                            <span className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${s.enabled ? "translate-x-4" : "translate-x-0"}`} />
                                        </button>
                                        <button onClick={() => removeSchedule(s.id)}
                                            className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Power calculator */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Calculator className="h-4 w-4 text-primary" />
                            Calculateur de consommation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label className="text-xs">Equipement</Label>
                            <Select value={pAssetId} onValueChange={setPAssetId}>
                                <SelectTrigger className="mt-1 h-8 text-sm">
                                    <SelectValue placeholder="Selectionnez..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assets.map(a => (
                                        <SelectItem key={a.id} value={a.id} className="text-sm">{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label className="text-xs">Watts</Label>
                                <Input type="number" value={pWatts} min={1}
                                    onChange={e => setPWatts(+e.target.value)} className="mt-1 h-8 text-sm" />
                            </div>
                            <div>
                                <Label className="text-xs">H/jour</Label>
                                <Input type="number" value={pHours} min={0} max={24}
                                    onChange={e => setPHours(+e.target.value)} className="mt-1 h-8 text-sm" />
                            </div>
                            <div>
                                <Label className="text-xs">€/kWh</Label>
                                <Input type="number" value={pCost} min={0} step={0.01}
                                    onChange={e => setPCost(+e.target.value)} className="mt-1 h-8 text-sm" />
                            </div>
                        </div>

                        {/* Live estimate */}
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Consommation/jour</span>
                                <span>{((pWatts / 1000) * pHours).toFixed(3)} kWh</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Consommation/mois</span>
                                <span>{((pWatts / 1000) * pHours * 30.44).toFixed(2)} kWh</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                                <span>Cout mensuel estimé</span>
                                <span className="text-amber-700">
                                    {calcMonthlyCost(pWatts, pHours, pCost).toFixed(2)} €
                                </span>
                            </div>
                        </div>

                        <Button size="sm" className="w-full" onClick={saveProfile}>
                            <Zap className="h-3.5 w-3.5 mr-2" />
                            Sauvegarder le profil
                        </Button>

                        {/* Profiles list */}
                        {profiles.length > 0 && (
                            <div className="space-y-1.5 border-t pt-3">
                                <p className="text-xs font-medium text-muted-foreground">Profils enregistres :</p>
                                {profiles.map(p => (
                                    <div key={p.assetId} className="flex items-center justify-between text-xs rounded border px-2 py-1.5">
                                        <span className="truncate max-w-[120px]">{getAssetName(p.assetId)}</span>
                                        <span className="text-muted-foreground">{p.watts}W / {p.hoursPerDay}h</span>
                                        <Badge className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                                            {calcMonthlyCost(p.watts, p.hoursPerDay, p.costPerKwh).toFixed(2)} €/mois
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
