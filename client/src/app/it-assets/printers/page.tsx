"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Printer, Plus, Trash2, Edit, AlertTriangle, WifiOff, Wifi, CheckCircle } from "lucide-react"
import { usePageTitle } from "@/hooks/use-page-title"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrinterEntry {
    id: string
    name: string
    model: string
    location: string
    ipAddress: string
    status: "online" | "offline" | "error" | "idle"
    tonerBlack: number    // 0-100
    tonerColor: number    // 0-100 (for color printers)
    paperLevel: number    // 0-100
    isColor: boolean
    queueCount: number
    lastSeen: string
}

const LS_KEY = "it.printers"

const STATUS_META: Record<PrinterEntry["status"], { badge: string; label: string; icon: React.ReactNode }> = {
    online:  { badge: "bg-emerald-500/10 text-emerald-600", label: "En ligne",   icon: <Wifi className="h-3.5 w-3.5 text-emerald-500" /> },
    idle:    { badge: "bg-blue-500/10 text-blue-600",       label: "Inactif",    icon: <CheckCircle className="h-3.5 w-3.5 text-blue-500" /> },
    offline: { badge: "bg-muted text-muted-foreground",     label: "Hors ligne", icon: <WifiOff className="h-3.5 w-3.5 text-muted-foreground" /> },
    error:   { badge: "bg-red-500/10 text-red-600",         label: "Erreur",     icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> },
}

const EMPTY_FORM: Omit<PrinterEntry, "id" | "lastSeen"> = {
    name: "", model: "", location: "", ipAddress: "",
    status: "online", tonerBlack: 80, tonerColor: 80,
    paperLevel: 90, isColor: false, queueCount: 0,
}

// ─── Local storage ────────────────────────────────────────────────────────────

function loadPrinters(): PrinterEntry[] {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") }
    catch { return [] }
}

function savePrinters(p: PrinterEntry[]) { localStorage.setItem(LS_KEY, JSON.stringify(p)) }

// ─── Toner bar ────────────────────────────────────────────────────────────────

function TonerBar({ label, value, color }: { label: string; value: number; color: string }) {
    const cls = value < 10 ? "bg-red-500" : value < 25 ? "bg-orange-400" : color
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-10 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${cls}`} style={{ width: `${value}%` }} />
            </div>
            <span className={`text-xs w-8 text-right ${value < 10 ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                {value}%
            </span>
        </div>
    )
}

// ─── Alert generator ──────────────────────────────────────────────────────────

function getAlerts(p: PrinterEntry): string[] {
    const alerts: string[] = []
    if (p.status === "offline") alerts.push("Imprimante hors ligne")
    if (p.status === "error")   alerts.push("Erreur detectee")
    if (p.tonerBlack < 10)     alerts.push("Toner noir critique (<10%)")
    else if (p.tonerBlack < 25) alerts.push("Toner noir faible (<25%)")
    if (p.isColor && p.tonerColor < 10)  alerts.push("Toner couleur critique (<10%)")
    else if (p.isColor && p.tonerColor < 25) alerts.push("Toner couleur faible (<25%)")
    if (p.paperLevel < 10)     alerts.push("Papier epuise (<10%)")
    else if (p.paperLevel < 20) alerts.push("Papier faible (<20%)")
    return alerts
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintersPage() {
    usePageTitle("Imprimantes")

    const [printers, setPrinters] = useState<PrinterEntry[]>([])
    const [showDialog, setShowDialog] = useState(false)
    const [editing, setEditing] = useState<PrinterEntry | null>(null)
    const [form, setForm] = useState<Omit<PrinterEntry, "id" | "lastSeen">>(EMPTY_FORM)

    useEffect(() => { setPrinters(loadPrinters()) }, [])

    function openCreate() {
        setEditing(null)
        setForm({ ...EMPTY_FORM })
        setShowDialog(true)
    }

    function openEdit(p: PrinterEntry) {
        setEditing(p)
        setForm({
            name: p.name, model: p.model, location: p.location, ipAddress: p.ipAddress,
            status: p.status, tonerBlack: p.tonerBlack, tonerColor: p.tonerColor,
            paperLevel: p.paperLevel, isColor: p.isColor, queueCount: p.queueCount,
        })
        setShowDialog(true)
    }

    function save() {
        if (!form.name.trim()) { toast.error("Nom requis"); return }
        const updated = editing
            ? printers.map(p => p.id === editing.id ? { ...p, ...form } : p)
            : [...printers, { id: `pr-${Date.now()}`, ...form, lastSeen: new Date().toISOString() }]
        setPrinters(updated)
        savePrinters(updated)
        setShowDialog(false)
        toast.success(editing ? "Imprimante mise a jour" : "Imprimante ajoutee")
    }

    function remove(id: string) {
        const updated = printers.filter(p => p.id !== id)
        setPrinters(updated)
        savePrinters(updated)
        toast.success("Imprimante supprimee")
    }

    const totalAlerts = printers.reduce((sum, p) => sum + getAlerts(p).length, 0)
    const online = printers.filter(p => p.status === "online" || p.status === "idle").length

    return (
        <AppLayout>
            <div className="container mx-auto max-w-6xl space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold">
                            <Printer className="h-6 w-6 text-primary" />
                            Gestion des imprimantes
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Inventaire, niveaux de toner et alertes
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter imprimante
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: "Total", value: printers.length, cls: "" },
                        { label: "En ligne", value: online, cls: "text-emerald-600" },
                        { label: "Hors ligne", value: printers.filter(p => p.status === "offline").length, cls: "text-muted-foreground" },
                        { label: "Alertes", value: totalAlerts, cls: totalAlerts > 0 ? "text-red-600" : "text-emerald-600" },
                    ].map(({ label, value, cls }) => (
                        <Card key={label}>
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Alerts banner */}
                {totalAlerts > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-700">
                                    {totalAlerts} alerte(s) en attente
                                </p>
                                <div className="mt-1 space-y-0.5">
                                    {printers.flatMap(p =>
                                        getAlerts(p).map((a, i) => (
                                            <p key={`${p.id}-${i}`} className="text-xs text-red-600">
                                                <strong>{p.name}</strong> — {a}
                                            </p>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Printer list */}
                {printers.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-16 text-center">
                        <Printer className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-sm text-muted-foreground">
                            Aucune imprimante enregistree.
                        </p>
                        <Button variant="outline" className="mt-4" onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter une imprimante
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {printers.map(p => {
                            const sm = STATUS_META[p.status]
                            const alerts = getAlerts(p)
                            return (
                                <Card key={p.id} className={alerts.length > 0 ? "border-orange-500/30" : ""}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {sm.icon}
                                                <div>
                                                    <p className="text-sm font-semibold leading-tight">{p.name}</p>
                                                    <p className="text-xs text-muted-foreground">{p.model}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}>
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                    onClick={() => remove(p.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <Badge className={`text-xs ${sm.badge}`}>{sm.label}</Badge>
                                            {p.isColor && <Badge className="text-xs bg-purple-500/10 text-purple-600">Couleur</Badge>}
                                            {p.location && <span className="text-xs text-muted-foreground">{p.location}</span>}
                                        </div>

                                        <div className="space-y-1.5">
                                            <TonerBar label="Noir" value={p.tonerBlack} color="bg-slate-700" />
                                            {p.isColor && (
                                                <TonerBar label="Coul." value={p.tonerColor} color="bg-purple-500" />
                                            )}
                                            <TonerBar label="Papier" value={p.paperLevel} color="bg-blue-400" />
                                        </div>

                                        {p.queueCount > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                File: <strong>{p.queueCount}</strong> document(s) en attente
                                            </p>
                                        )}

                                        {alerts.length > 0 && (
                                            <div className="space-y-0.5">
                                                {alerts.map((a, i) => (
                                                    <p key={i} className="flex items-center gap-1 text-xs text-orange-600">
                                                        <AlertTriangle className="h-3 w-3 shrink-0" />
                                                        {a}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}

                {/* Add/Edit Dialog */}
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? "Modifier l'imprimante" : "Ajouter une imprimante"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Nom *</Label>
                                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Imprimante Bureau 1" className="mt-1" />
                                </div>
                                <div>
                                    <Label>Modele</Label>
                                    <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                                        placeholder="HP LaserJet Pro 400" className="mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Localisation</Label>
                                    <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                        placeholder="Salle 204" className="mt-1" />
                                </div>
                                <div>
                                    <Label>Adresse IP</Label>
                                    <Input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))}
                                        placeholder="192.168.1.50" className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <Label>Statut</Label>
                                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PrinterEntry["status"] }))}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(["online", "idle", "offline", "error"] as PrinterEntry["status"][]).map(s => (
                                            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs">Toner noir (%)</Label>
                                    <Input type="number" min={0} max={100} value={form.tonerBlack}
                                        onChange={e => setForm(f => ({ ...f, tonerBlack: Math.min(100, Math.max(0, +e.target.value)) }))}
                                        className="mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs">Toner coul. (%)</Label>
                                    <Input type="number" min={0} max={100} value={form.tonerColor}
                                        onChange={e => setForm(f => ({ ...f, tonerColor: Math.min(100, Math.max(0, +e.target.value)) }))}
                                        className="mt-1" disabled={!form.isColor} />
                                </div>
                                <div>
                                    <Label className="text-xs">Papier (%)</Label>
                                    <Input type="number" min={0} max={100} value={form.paperLevel}
                                        onChange={e => setForm(f => ({ ...f, paperLevel: Math.min(100, Math.max(0, +e.target.value)) }))}
                                        className="mt-1" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is-color"
                                    checked={form.isColor}
                                    onChange={e => setForm(f => ({ ...f, isColor: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="is-color">Imprimante couleur</Label>
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
                            <Button onClick={save}>
                                {editing ? "Mettre a jour" : "Ajouter"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    )
}
