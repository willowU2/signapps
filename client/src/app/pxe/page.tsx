"use client"

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState, useCallback } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Terminal, Upload, Play, Settings, RefreshCw, HardDrive, Cpu, FileJson, CheckCircle2, Trash2, Edit, Plus, Network, Clock } from 'lucide-react';
import { pxeApi, PxeProfile, PxeAsset, CreatePxeProfileRequest, UpdatePxeProfileRequest, RegisterPxeAssetRequest, UpdatePxeAssetRequest } from "@/lib/api/pxe"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { usePageTitle } from '@/hooks/use-page-title';

export default function PXEDashboard() {
  usePageTitle('Deploiement PXE');
    const [profiles, setProfiles] = useState<PxeProfile[]>([])
    const [assets, setAssets] = useState<PxeAsset[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("profiles")

    // Profile form state
    const [profileDialogOpen, setProfileDialogOpen] = useState(false)
    const [editingProfile, setEditingProfile] = useState<PxeProfile | null>(null)
    const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null)
    const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null)
    const [profileForm, setProfileForm] = useState<CreatePxeProfileRequest>({
        name: '',
        description: '',
        boot_script: '#!ipxe\necho Booting...\nexit',
        os_type: 'Linux',
        os_version: '',
        is_default: false,
    })
    const [saving, setSaving] = useState(false)

    // Asset form state
    const [assetDialogOpen, setAssetDialogOpen] = useState(false)
    const [editingAsset, setEditingAsset] = useState<PxeAsset | null>(null)
    const [assetForm, setAssetForm] = useState<RegisterPxeAssetRequest>({
        mac_address: '',
        hostname: '',
        profile_id: undefined,
    })

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [profilesRes, assetsRes] = await Promise.all([
                pxeApi.listProfiles(),
                pxeApi.listAssets(),
            ])
            const [profilesData, assetsData] = [profilesRes.data, assetsRes.data]
            setProfiles(profilesData)
            setAssets(assetsData)
        } catch (err) {
            console.debug('Failed to load PXE data:', err)
            toast.error('Impossible de charger les donnes PXE')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Profile handlers
    const openCreateProfile = () => {
        setEditingProfile(null)
        setProfileForm({
            name: '',
            description: '',
            boot_script: '#!ipxe\ndhcp\nchain http://${next-server}/boot/${mac}.ipxe || exit',
            os_type: 'Linux',
            os_version: '',
            is_default: false,
        })
        setProfileDialogOpen(true)
    }

    const openEditProfile = (profile: PxeProfile) => {
        setEditingProfile(profile)
        setProfileForm({
            name: profile.name,
            description: profile.description || '',
            boot_script: profile.boot_script,
            os_type: profile.os_type || 'Linux',
            os_version: profile.os_version || '',
            is_default: profile.is_default || false,
        })
        setProfileDialogOpen(true)
    }

    const handleSaveProfile = async () => {
        if (!profileForm.name || !profileForm.boot_script) {
            toast.error('Nom et script de boot requis')
            return
        }

        try {
            setSaving(true)
            if (editingProfile) {
                const updated = (await pxeApi.updateProfile(editingProfile.id, profileForm as UpdatePxeProfileRequest)).data
                setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p))
                toast.success('Profil mis  jour')
            } else {
                const created = (await pxeApi.createProfile(profileForm)).data
                setProfiles(prev => [...prev, created])
                toast.success('Profil cr')
            }
            setProfileDialogOpen(false)
        } catch (err) {
            console.debug("Impossible d'enregistrer profile:", err)
            toast.error('chec de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteProfile = (id: string) => {
        setDeleteProfileId(id)
    }

    const handleDeleteProfileConfirm = async () => {
        if (!deleteProfileId) return
        setDeleteProfileId(null)
        try {
            await pxeApi.deleteProfile(deleteProfileId)
            setProfiles(prev => prev.filter(p => p.id !== deleteProfileId))
            toast.success('Profil supprim')
        } catch (err) {
            console.debug('Impossible de supprimer profile:', err)
            toast.error('chec de la suppression')
        }
    }

    // Asset handlers
    const openCreateAsset = () => {
        setEditingAsset(null)
        setAssetForm({
            mac_address: '',
            hostname: '',
            profile_id: undefined,
        })
        setAssetDialogOpen(true)
    }

    const openEditAsset = (asset: PxeAsset) => {
        setEditingAsset(asset)
        setAssetForm({
            mac_address: asset.mac_address,
            hostname: asset.hostname || '',
            profile_id: asset.profile_id,
        })
        setAssetDialogOpen(true)
    }

    const handleSaveAsset = async () => {
        if (!assetForm.mac_address) {
            toast.error('Adresse MAC requise')
            return
        }

        try {
            setSaving(true)
            if (editingAsset) {
                const updateData: UpdatePxeAssetRequest = {
                    hostname: assetForm.hostname || undefined,
                    profile_id: assetForm.profile_id,
                }
                const updated = (await pxeApi.updateAsset(editingAsset.id, updateData)).data
                setAssets(prev => prev.map(a => a.id === updated.id ? updated : a))
                toast.success('Asset mis  jour')
            } else {
                const created = (await pxeApi.registerAsset(assetForm)).data
                setAssets(prev => [...prev, created])
                toast.success('Asset enregistr')
            }
            setAssetDialogOpen(false)
        } catch (err) {
            console.debug("Impossible d'enregistrer asset:", err)
            toast.error('chec de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteAsset = (id: string) => {
        setDeleteAssetId(id)
    }

    const handleDeleteAssetConfirm = async () => {
        if (!deleteAssetId) return
        setDeleteAssetId(null)
        try {
            await pxeApi.deleteAsset(deleteAssetId)
            setAssets(prev => prev.filter(a => a.id !== deleteAssetId))
            toast.success('Asset supprim')
        } catch (err) {
            console.debug('Impossible de supprimer asset:', err)
            toast.error('chec de la suppression')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'deployed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            case 'provisioning': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
            case 'discovered': return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            case 'offline': return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20'
            default: return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20'
        }
    }

    const deployedCount = assets.filter(a => a.status === 'deployed').length
    const defaultProfile = profiles.find(p => p.is_default)

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent">PXE Deployment Server</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Grer les profils de boot rseau, images ISO et installations automatises.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadData} disabled={loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Rafrachir
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">TFTP Status</CardTitle>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono">Online</div>
                            <p className="text-xs text-muted-foreground mt-1">coute sur UDP port 69</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Profils de boot</CardTitle>
                            <FileJson className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{profiles.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Scripts iPXE configurs</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Assets dcouverts</CardTitle>
                            <Network className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{assets.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Machines traces par MAC</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Dploiements</CardTitle>
                            <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{deployedCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Machines installes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs for Profiles and Assets */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="profiles" className="gap-2">
                            <Terminal className="h-4 w-4" />
                            Profils de boot
                        </TabsTrigger>
                        <TabsTrigger value="assets" className="gap-2">
                            <HardDrive className="h-4 w-4" />
                            Assets rseau
                        </TabsTrigger>
                    </TabsList>

                    {/* Profiles Tab */}
                    <TabsContent value="profiles" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Profils de boot</CardTitle>
                                    <CardDescription>Configurations de boot rseau iPXE disponibles pour les clients.</CardDescription>
                                </div>
                                <Button onClick={openCreateProfile}>
                                    <Plus className="mr-2 h-4 w-4" /> Nouveau profil
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
                                    </div>
                                ) : profiles.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold">Aucun profil configur</h3>
                                        <p className="text-muted-foreground mt-2">Crez votre premier profil de boot iPXE.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nom du profil</TableHead>
                                                    <TableHead>Type d'OS</TableHead>
                                                    <TableHead>Version</TableHead>
                                                    <TableHead>Mis  jour</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {profiles.map(profile => (
                                                    <TableRow key={profile.id} className="group">
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                                {profile.name}
                                                                {profile.is_default && (
                                                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-semibold uppercase">Dfaut</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{profile.os_type || '-'}</TableCell>
                                                        <TableCell>{profile.os_version || '-'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            {profile.updated_at ? formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true, locale: fr }) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProfile(profile)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProfile(profile.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Assets Tab */}
                    <TabsContent value="assets" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Assets rseau</CardTitle>
                                    <CardDescription>Machines traces par adresse MAC pour le dploiement PXE.</CardDescription>
                                </div>
                                <Button onClick={openCreateAsset}>
                                    <Plus className="mr-2 h-4 w-4" /> Ajouter un asset
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
                                    </div>
                                ) : assets.length === 0 ? (
                                    <div className="text-center py-12">
                                        <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold">Aucun asset dcouvert</h3>
                                        <p className="text-muted-foreground mt-2">Les machines qui bootent via PXE apparatront automatiquement ici.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Adresse MAC</TableHead>
                                                    <TableHead>Hostname</TableHead>
                                                    <TableHead>Profil</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Dernire activit</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {assets.map(asset => (
                                                    <TableRow key={asset.id} className="group">
                                                        <TableCell className="font-mono text-sm">{asset.mac_address}</TableCell>
                                                        <TableCell>{asset.hostname || '-'}</TableCell>
                                                        <TableCell>
                                                            {asset.profile_id ? profiles.find(p => p.id === asset.profile_id)?.name || '-' : <span className="text-muted-foreground">Dfaut</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium text-xs ${getStatusColor(asset.status)}`}>
                                                                {asset.status === 'deployed' && <CheckCircle2 className="h-3 w-3" />}
                                                                {asset.status === 'provisioning' && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3 w-3 " />}
                                                                {asset.status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            {asset.last_seen ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {formatDistanceToNow(new Date(asset.last_seen), { addSuffix: true, locale: fr })}
                                                                </span>
                                                            ) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditAsset(asset)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteAsset(asset.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Profile Dialog */}
            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingProfile ? 'Modifier le profil' : 'Nouveau profil de boot'}</DialogTitle>
                        <DialogDescription>
                            Configurer un script iPXE pour le boot rseau
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nom</Label>
                                <Input
                                    id="name"
                                    placeholder="Ubuntu 24.04 LTS"
                                    value={profileForm.name}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="os_type">Type d'OS</Label>
                                <Select
                                    value={profileForm.os_type}
                                    onValueChange={(v) => setProfileForm(prev => ({ ...prev, os_type: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Linux">Linux</SelectItem>
                                        <SelectItem value="Windows">Windows</SelectItem>
                                        <SelectItem value="BSD">BSD</SelectItem>
                                        <SelectItem value="Tool">Tool/Diagnostic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="os_version">Version</Label>
                            <Input
                                id="os_version"
                                placeholder="24.04"
                                value={profileForm.os_version}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, os_version: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                placeholder="Installation automatise..."
                                value={profileForm.description}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="boot_script">Script iPXE</Label>
                            <Textarea
                                id="boot_script"
                                className="font-mono text-sm min-h-[200px]"
                                placeholder="#!ipxe\ndhcp\nboot http://..."
                                value={profileForm.boot_script}
                                onChange={(e) => setProfileForm(prev => ({ ...prev, boot_script: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="is_default"
                                checked={profileForm.is_default}
                                onCheckedChange={(checked) => setProfileForm(prev => ({ ...prev, is_default: checked }))}
                            />
                            <Label htmlFor="is_default">Profil par dfaut</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleSaveProfile} disabled={saving}>
                            {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                            {editingProfile ? 'Sauvegarder' : 'Crer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Asset Dialog */}
            <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingAsset ? 'Modifier l\'asset' : 'Ajouter un asset'}</DialogTitle>
                        <DialogDescription>
                            Enregistrer une machine par son adresse MAC
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="mac_address">Adresse MAC</Label>
                            <Input
                                id="mac_address"
                                placeholder="00:1A:2B:3C:4D:5E"
                                value={assetForm.mac_address}
                                onChange={(e) => setAssetForm(prev => ({ ...prev, mac_address: e.target.value.toUpperCase() }))}
                                disabled={!!editingAsset}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="hostname">Hostname</Label>
                            <Input
                                id="hostname"
                                placeholder="srv-web-01"
                                value={assetForm.hostname}
                                onChange={(e) => setAssetForm(prev => ({ ...prev, hostname: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="profile_id">Profil de boot</Label>
                            <Select
                                value={assetForm.profile_id || 'default'}
                                onValueChange={(v) => setAssetForm(prev => ({ ...prev, profile_id: v === 'default' ? undefined : v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Utiliser le profil par dfaut" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Profil par dfaut</SelectItem>
                                    {profiles.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleSaveAsset} disabled={saving}>
                            {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                            {editingAsset ? 'Sauvegarder' : 'Enregistrer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteProfileId} onOpenChange={() => setDeleteProfileId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce profil ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProfileConfirm}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteAssetId} onOpenChange={() => setDeleteAssetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cet asset ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAssetConfirm}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    )
}
