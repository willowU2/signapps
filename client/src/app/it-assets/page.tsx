"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Server, MonitorSmartphone, Cpu, Network, Printer,
  Plus, Trash, Edit, Target, ShieldCheck, Wrench, Archive,
  Search, Filter, HardDrive, ArrowUpDown, QrCode, ScanLine,
  Layers, TrendingDown, BarChart2, Radar,
} from "lucide-react"
import { itAssetsApi, HardwareAsset, CreateHardwareRequest, UpdateHardwareRequest } from "@/lib/api/it-assets"
import { EntityLinks } from "@/components/crosslinks/EntityLinks"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AssetQrLabel } from "@/components/it-assets/asset-qr-label"
import { AssetMaintenance } from "@/components/it-assets/asset-maintenance"
import { AssetWarranty } from "@/components/it-assets/asset-warranty"
import { AssetDepreciation } from "@/components/it-assets/asset-depreciation"
import { AssetAssignment } from "@/components/it-assets/asset-assignment"
import { AssetCategories } from "@/components/it-assets/asset-categories"
import { AssetIncidentTickets } from "@/components/it-assets/asset-incident-ticket"
import { AssetNbvReport } from "@/components/it-assets/asset-nbv-report"
import { AssetRemoteActions } from "@/components/it-assets/asset-remote-actions"
import { AssetMonitorInfo } from "@/components/it-assets/asset-monitor-info"
import { ActiveSessions } from "@/components/it-assets/active-sessions"
import { PatchHistory } from "@/components/it-assets/patch-history"
import Link from "next/link"
import { usePageTitle } from '@/hooks/use-page-title';

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "laptop",      label: "Laptop / Notebook" },
  { value: "workstation", label: "Desktop Workstation" },
  { value: "server",      label: "Server Rack" },
  { value: "switch",      label: "Network Switch" },
  { value: "printer",     label: "Printer" },
  { value: "other",       label: "Other" },
]

const ASSET_STATUSES = [
  { value: "active",      label: "Active",      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "maintenance", label: "Maintenance", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { value: "retired",     label: "Retired",     color: "bg-muted text-muted-foreground border-border" },
  { value: "stock",       label: "In Stock",    color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
]

const EMPTY_FORM: Partial<CreateHardwareRequest & { status: string }> = {
  name: "", type: "laptop", manufacturer: "", model: "", serial_number: "", location: "", notes: "", status: "active",
}

function getTypeIcon(type: string) {
  switch (type) {
    case "server":      return <Server className="h-4 w-4 text-blue-500 shrink-0" />
    case "switch":      return <Network className="h-4 w-4 text-purple-500 shrink-0" />
    case "workstation": return <Cpu className="h-4 w-4 text-indigo-500 shrink-0" />
    case "printer":     return <Printer className="h-4 w-4 text-amber-500 shrink-0" />
    default:            return <MonitorSmartphone className="h-4 w-4 text-emerald-500 shrink-0" />
  }
}

function getTypeLabel(type: string) {
  return ASSET_TYPES.find(t => t.value === type)?.label ?? type
}

function getStatusMeta(status?: string) {
  return ASSET_STATUSES.find(s => s.value === status) ?? {
    value: status ?? "unknown", label: status ?? "Unknown", color: "bg-muted text-muted-foreground border-border",
  }
}

// ─── Asset Detail Panel ──────────────────────────────────────────────────────

function AssetDetailPanel({ asset }: { asset: HardwareAsset }) {
  return (
    <div className="space-y-4">
      <AssetRemoteActions asset={asset} />
      <AssetMonitorInfo hardwareId={asset.id} />
      <AssetAssignment asset={asset} />
      <AssetMaintenance assetId={asset.id} assetName={asset.name} />
      <AssetWarranty assetId={asset.id} assetName={asset.name} />
      <AssetIncidentTickets asset={asset} />
      <AssetDepreciation assetName={asset.name} purchaseDate={asset.purchase_date} />
      <PatchHistory hardwareId={asset.id} />
    </div>
  )
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ITAssetsPage() {
  usePageTitle('Parc informatique');
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<HardwareAsset | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteAsset, setDeleteAsset] = useState<HardwareAsset | null>(null)
  const [qrAsset, setQrAsset] = useState<HardwareAsset | null>(null)
  const [detailAsset, setDetailAsset] = useState<HardwareAsset | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortField, setSortField] = useState<string>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [activeTab, setActiveTab] = useState("inventory")

  const { data: assets = [], isLoading } = useQuery<HardwareAsset[]>({
    queryKey: ["it-assets"],
    queryFn: async () => {
      const response = await itAssetsApi.listHardware()
      return response.data || []
    },
  })

  const loadAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["it-assets"] })
  }, [queryClient])

  const filteredAssets = useMemo(() => assets.filter(asset => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || asset.name.toLowerCase().includes(q) ||
      (asset.serial_number ?? "").toLowerCase().includes(q) ||
      (asset.location ?? "").toLowerCase().includes(q)
    return matchesSearch && (filterType === "all" || asset.type === filterType) && (filterStatus === "all" || asset.status === filterStatus)
  }), [assets, searchQuery, filterType, filterStatus])

  const sortedAssets = useMemo(() => [...filteredAssets].sort((a, b) => {
    const cmp = String(a[sortField as keyof HardwareAsset] ?? "").localeCompare(String(b[sortField as keyof HardwareAsset] ?? ""), "fr", { numeric: true })
    return sortDir === "asc" ? cmp : -cmp
  }), [filteredAssets, sortField, sortDir])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter(a => a.status === "active").length,
    maintenance: assets.filter(a => a.status === "maintenance").length,
    retired: assets.filter(a => a.status === "retired").length,
  }), [assets])

  const openCreate = () => { setEditingAsset(null); setFormData(EMPTY_FORM); setDialogOpen(true) }
  const openEdit = (asset: HardwareAsset) => {
    setEditingAsset(asset)
    setFormData({ name: asset.name, type: asset.type, manufacturer: asset.manufacturer ?? "", model: asset.model ?? "", serial_number: asset.serial_number ?? "", location: asset.location ?? "", notes: asset.notes ?? "", status: asset.status ?? "active" })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name?.trim()) return
    setIsSaving(true)
    try {
      if (editingAsset) {
        await itAssetsApi.updateHardware(editingAsset.id, { name: formData.name, status: formData.status, location: formData.location, notes: formData.notes })
      } else {
        await itAssetsApi.createHardware({
          name: formData.name!, type: formData.type ?? "laptop",
          manufacturer: formData.manufacturer || undefined, model: formData.model || undefined,
          serial_number: formData.serial_number || undefined, location: formData.location || undefined, notes: formData.notes || undefined,
        })
      }
      setDialogOpen(false)
      loadAssets()
    } catch { console.warn("Impossible d'enregistrer asset") }
    finally { setIsSaving(false) }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteAsset) return
    setDeleteAsset(null)
    try {
      await itAssetsApi.deleteHardware(deleteAsset.id)
      loadAssets()
    } catch {
      queryClient.setQueryData<HardwareAsset[]>(["it-assets"], (prev = []) => prev.filter(a => a.id !== deleteAsset.id))
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
              <HardDrive className="h-8 w-8 text-primary" />
              IT Assets
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Hardware inventory — track, manage and assign physical devices.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/it-assets/scan"><ScanLine className="h-4 w-4 mr-1" />QR Scan</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/it-assets/network"><Radar className="h-4 w-4 mr-1" />Decouverte</Link>
            </Button>
            <Button onClick={openCreate} className="shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />Add Asset
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Assets", value: stats.total, icon: Target, gradient: "from-blue-500 to-indigo-500" },
            { label: "Active", value: stats.active, icon: ShieldCheck, gradient: "from-emerald-500 to-teal-500" },
            { label: "Maintenance", value: stats.maintenance, icon: Wrench, gradient: "from-orange-500 to-amber-500" },
            { label: "Retired", value: stats.retired, icon: Archive, gradient: "from-slate-400 to-slate-500" },
          ].map(({ label, value, icon: Icon, gradient }) => (
            <Card key={label} className="border-border/50 bg-card overflow-hidden relative group">
              <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${gradient} transform translate-y-1 group-hover:translate-y-0 transition-transform`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inventory" className="gap-1.5"><HardDrive className="h-3.5 w-3.5" />Inventory</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Categories</TabsTrigger>
            <TabsTrigger value="nbv" className="gap-1.5"><BarChart2 className="h-3.5 w-3.5" />NBV Report</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {ASSET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Hardware Inventory
                  {filteredAssets.length !== assets.length && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{filteredAssets.length} of {assets.length}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-b-md border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {["name", "type", "serial_number", "status"].map(field => (
                          <TableHead key={field} className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
                            <span className="flex items-center gap-1 capitalize">
                              {field.replace("_", " ")} {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                            </span>
                          </TableHead>
                        ))}
                        <TableHead>Location</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Chargement...</TableCell></TableRow>
                      ) : sortedAssets.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          {assets.length === 0 ? "No hardware found. Add your first asset." : "No assets match the current filters."}
                        </TableCell></TableRow>
                      ) : sortedAssets.map(asset => {
                        const status = getStatusMeta(asset.status)
                        return (
                          <TableRow key={asset.id} className="group cursor-pointer" onClick={() => setDetailAsset(detailAsset?.id === asset.id ? null : asset)}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">{getTypeIcon(asset.type)}<span>{asset.name}</span></div>
                              {asset.manufacturer && asset.model && (
                                <p className="text-xs text-muted-foreground mt-0.5 ml-6">{asset.manufacturer} {asset.model}</p>
                              )}
                            </TableCell>
                            <TableCell className="capitalize text-sm">{getTypeLabel(asset.type)}</TableCell>
                            <TableCell className="font-mono text-sm">{asset.serial_number ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>{status.label}</span>
                            </TableCell>
                            <TableCell className="text-sm">{asset.location ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-sm">{asset.assigned_user_id ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Étiquette QR" onClick={() => setQrAsset(asset)}>
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Modifier" onClick={() => openEdit(asset)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Supprimer" onClick={() => setDeleteAsset(asset)}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Detail panel for selected asset */}
            {detailAsset && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{detailAsset.name} — Details</h3>
                  <Button size="sm" variant="ghost" onClick={() => setDetailAsset(null)}>Fermer</Button>
                </div>
                <AssetDetailPanel asset={detailAsset} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <AssetCategories />
          </TabsContent>

          <TabsContent value="nbv">
            <AssetNbvReport assets={assets} />
          </TabsContent>
        </Tabs>

        {/* Active Remote Sessions — shown below main tabs */}
        <ActiveSessions />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingAsset ? "Edit Asset" : "Add Hardware Asset"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="asset-name">Name / Hostname *</Label>
              <Input id="asset-name" placeholder="e.g. WKST-JDOE-01" value={formData.name ?? ""} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formData.type ?? "laptop"} onValueChange={v => setFormData(f => ({ ...f, type: v }))} disabled={!!editingAsset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formData.status ?? "active"} onValueChange={v => setFormData(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-manufacturer">Manufacturer</Label>
              <Input id="asset-manufacturer" placeholder="e.g. Dell" value={formData.manufacturer ?? ""} onChange={e => setFormData(f => ({ ...f, manufacturer: e.target.value }))} disabled={!!editingAsset} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-model">Model</Label>
              <Input id="asset-model" placeholder="e.g. Latitude 5540" value={formData.model ?? ""} onChange={e => setFormData(f => ({ ...f, model: e.target.value }))} disabled={!!editingAsset} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input id="asset-serial" placeholder="e.g. SN-123456" value={formData.serial_number ?? ""} onChange={e => setFormData(f => ({ ...f, serial_number: e.target.value }))} disabled={!!editingAsset} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-location">Location</Label>
              <Input id="asset-location" placeholder="e.g. Office 2B" value={formData.location ?? ""} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="asset-notes">Notes</Label>
              <Textarea id="asset-notes" placeholder="Optional notes…" rows={2} value={formData.notes ?? ""} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {editingAsset && (
            <div className="border-t pt-4">
              <EntityLinks entityType="it_asset" entityId={editingAsset.id} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!formData.name?.trim() || isSaving}>
              {isSaving ? "Enregistrement…" : editingAsset ? "Enregistrer" : "Créer l'équipement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAsset} onOpenChange={() => setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteAsset?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {qrAsset && <AssetQrLabel asset={qrAsset} open={!!qrAsset} onOpenChange={open => !open && setQrAsset(null)} />}
    </AppLayout>
  )
}
