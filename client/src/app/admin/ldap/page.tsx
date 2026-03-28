"use client"

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { identityApiClient as identityApi } from "@/lib/api"
import { Server, RefreshCw, Users, Shield, CheckCircle2, XCircle, FolderTree, Play, Settings, Lock, Eye, EyeOff } from 'lucide-react';

interface LdapConfig {
    id: string
    enabled: boolean
    server_url: string
    bind_dn: string
    base_dn: string
    user_filter?: string
    group_filter?: string
    admin_groups: string[]
    user_groups: string[]
    use_tls: boolean
    skip_tls_verify: boolean
    sync_interval_minutes: number
    fallback_local_auth: boolean
    created_at: string
    updated_at: string
}

interface LdapGroup {
    dn: string
    name: string
    description?: string
    member_count: number
}

interface LdapTestResult {
    success: boolean
    message: string
    connection_time_ms?: number
    users_found?: number
    groups_found?: number
}

interface SyncResult {
    users_created: number
    users_updated: number
    users_disabled: number
    groups_synced: number
    errors: string[]
}

export default function LdapPage() {
    const [config, setConfig] = useState<LdapConfig | null>(null)
    const [groups, setGroups] = useState<LdapGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [testResult, setTestResult] = useState<LdapTestResult | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        enabled: false,
        server_url: "",
        bind_dn: "",
        bind_password: "",
        base_dn: "",
        user_filter: "(&(objectClass=user)(objectCategory=person))",
        group_filter: "(objectClass=group)",
        admin_groups: [] as string[],
        user_groups: [] as string[],
        use_tls: true,
        skip_tls_verify: false,
        sync_interval_minutes: 60,
        fallback_local_auth: true,
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            const res = await identityApi.get<LdapConfig>("/api/v1/auth/ldap/config")
            setConfig(res.data)
            setFormData({
                enabled: res.data.enabled,
                server_url: res.data.server_url,
                bind_dn: res.data.bind_dn,
                bind_password: "", // Don't show existing password
                base_dn: res.data.base_dn,
                user_filter: res.data.user_filter || "(&(objectClass=user)(objectCategory=person))",
                group_filter: res.data.group_filter || "(objectClass=group)",
                admin_groups: res.data.admin_groups || [],
                user_groups: res.data.user_groups || [],
                use_tls: res.data.use_tls,
                skip_tls_verify: res.data.skip_tls_verify,
                sync_interval_minutes: res.data.sync_interval_minutes,
                fallback_local_auth: res.data.fallback_local_auth,
            })
        } catch {
            // No config yet, that's OK
        } finally {
            setLoading(false)
        }
    }

    const loadGroups = async () => {
        try {
            const res = await identityApi.get<LdapGroup[]>("/api/v1/auth/ldap/groups")
            setGroups(res.data)
        } catch (err: any) {
            toast.error("Erreur chargement groupes: " + (err.response?.data?.message || err.message))
        }
    }

    const saveConfig = async () => {
        setSaving(true)
        try {
            if (config) {
                // Update existing config
                await identityApi.put("/api/v1/auth/ldap/config", {
                    ...formData,
                    bind_password: formData.bind_password || undefined, // Don't send empty password
                })
            } else {
                // Create new config
                await identityApi.post("/api/v1/auth/ldap/config", formData)
            }
            toast.success("Configuration LDAP enregistree")
            loadConfig()
        } catch (err: any) {
            toast.error("Erreur: " + (err.response?.data?.message || err.message))
        } finally {
            setSaving(false)
        }
    }

    const testConnection = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const res = await identityApi.post<LdapTestResult>("/api/v1/auth/ldap/test")
            setTestResult(res.data)
            if (res.data.success) {
                toast.success("Connexion LDAP reussie!")
                loadGroups()
            } else {
                toast.error("Echec: " + res.data.message)
            }
        } catch (err: any) {
            toast.error("Erreur test: " + (err.response?.data?.message || err.message))
        } finally {
            setTesting(false)
        }
    }

    const syncUsers = async () => {
        setSyncing(true)
        try {
            const res = await identityApi.post<SyncResult>("/api/v1/auth/ldap/sync")
            const r = res.data
            toast.success(`Sync terminee: ${r.users_created} crees, ${r.users_updated} mis a jour`)
            if (r.errors.length > 0) {
                console.error("Sync errors:", r.errors)
                toast.error(`Erreurs de synchronisation: ${r.errors.length} utilisateur(s)`)
            }
        } catch (err: any) {
            toast.error("Erreur sync: " + (err.response?.data?.message || err.message))
        } finally {
            setSyncing(false)
        }
    }

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-64">
                    <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="w-8 h-8  text-muted-foreground" />
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">LDAP / Active Directory</h1>
                        <p className="text-muted-foreground">Configurez l'authentification et la synchronisation LDAP</p>
                    </div>
                    <div className="flex gap-2">
                        {config?.enabled && (
                            <>
                                <Button variant="outline" onClick={testConnection} disabled={testing}>
                                    {testing ? <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " /> : <Play className="mr-2 h-4 w-4" />}
                                    Tester
                                </Button>
                                <Button variant="outline" onClick={syncUsers} disabled={syncing}>
                                    {syncing ? <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Synchroniser
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {testResult && (
                    <Card className={testResult.success ? "border-green-500" : "border-red-500"}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                {testResult.success ? (
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                ) : (
                                    <XCircle className="w-8 h-8 text-red-500" />
                                )}
                                <div>
                                    <p className="font-medium">{testResult.message}</p>
                                    {testResult.success && (
                                        <p className="text-sm text-muted-foreground">
                                            {testResult.users_found} utilisateurs, {testResult.groups_found} groupes trouves
                                            {testResult.connection_time_ms && ` (${testResult.connection_time_ms}ms)`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="config">
                    <TabsList>
                        <TabsTrigger value="config">
                            <Settings className="w-4 h-4 mr-2" />
                            Configuration
                        </TabsTrigger>
                        <TabsTrigger value="groups" disabled={!config?.enabled}>
                            <FolderTree className="w-4 h-4 mr-2" />
                            Groupes ({groups.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="config" className="space-y-6 mt-6">
                        {/* Enable Switch */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Server className="w-5 h-5" />
                                            Activer LDAP
                                        </CardTitle>
                                        <CardDescription>
                                            Permettre l'authentification via LDAP/Active Directory
                                        </CardDescription>
                                    </div>
                                    <Switch
                                        checked={formData.enabled}
                                        onCheckedChange={(v) => setFormData({ ...formData, enabled: v })}
                                    />
                                </div>
                            </CardHeader>
                        </Card>

                        {/* Connection Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Connexion</CardTitle>
                                <CardDescription>Parametres du serveur LDAP</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>URL du serveur</Label>
                                        <Input
                                            placeholder="ldap://dc.example.com:389 ou ldaps://..."
                                            value={formData.server_url}
                                            onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Base DN</Label>
                                        <Input
                                            placeholder="DC=example,DC=com"
                                            value={formData.base_dn}
                                            onChange={(e) => setFormData({ ...formData, base_dn: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bind DN (compte service)</Label>
                                        <Input
                                            placeholder="CN=service,OU=Users,DC=example,DC=com"
                                            value={formData.bind_dn}
                                            onChange={(e) => setFormData({ ...formData, bind_dn: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Mot de passe Bind</Label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder={config ? "(inchange)" : "Mot de passe"}
                                                value={formData.bind_password}
                                                onChange={(e) => setFormData({ ...formData, bind_password: e.target.value })}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={formData.use_tls}
                                            onCheckedChange={(v) => setFormData({ ...formData, use_tls: v })}
                                        />
                                        <Label>Utiliser TLS/STARTTLS</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={formData.skip_tls_verify}
                                            onCheckedChange={(v) => setFormData({ ...formData, skip_tls_verify: v })}
                                        />
                                        <Label>Ignorer verification certificat</Label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Filters */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Filtres LDAP</CardTitle>
                                <CardDescription>Filtres de recherche pour utilisateurs et groupes</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Filtre utilisateurs</Label>
                                    <Input
                                        placeholder="(&(objectClass=user)(objectCategory=person))"
                                        value={formData.user_filter}
                                        onChange={(e) => setFormData({ ...formData, user_filter: e.target.value })}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Filtre groupes</Label>
                                    <Input
                                        placeholder="(objectClass=group)"
                                        value={formData.group_filter}
                                        onChange={(e) => setFormData({ ...formData, group_filter: e.target.value })}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Role Mapping */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5" />
                                    Mapping des Roles
                                </CardTitle>
                                <CardDescription>Associez les groupes LDAP aux roles SignApps</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Groupes Administrateurs</Label>
                                    <Input
                                        placeholder="Domain Admins, IT-Admins (separes par virgules)"
                                        value={formData.admin_groups.join(", ")}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            admin_groups: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                                        })}
                                    />
                                    <p className="text-xs text-muted-foreground">Membres de ces groupes auront le role Admin</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Groupes Utilisateurs</Label>
                                    <Input
                                        placeholder="Domain Users (separes par virgules)"
                                        value={formData.user_groups.join(", ")}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            user_groups: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                                        })}
                                    />
                                    <p className="text-xs text-muted-foreground">Seuls les membres de ces groupes pourront se connecter</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sync Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5" />
                                    Synchronisation
                                </CardTitle>
                                <CardDescription>Parametres de synchronisation automatique</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Intervalle de sync (minutes)</Label>
                                        <Input
                                            type="number"
                                            min={5}
                                            max={1440}
                                            value={formData.sync_interval_minutes}
                                            onChange={(e) => setFormData({ ...formData, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-8">
                                        <Switch
                                            checked={formData.fallback_local_auth}
                                            onCheckedChange={(v) => setFormData({ ...formData, fallback_local_auth: v })}
                                        />
                                        <Label>Fallback auth locale si LDAP indisponible</Label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <Button onClick={saveConfig} disabled={saving}>
                                {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                                Enregistrer la configuration
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="groups" className="mt-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="w-5 h-5" />
                                            Groupes LDAP
                                        </CardTitle>
                                        <CardDescription>Groupes trouves dans l'annuaire</CardDescription>
                                    </div>
                                    <Button variant="outline" onClick={loadGroups}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Actualiser
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {groups.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FolderTree className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>Aucun groupe trouve.</p>
                                        <p className="text-sm">Testez la connexion pour charger les groupes.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nom</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Membres</TableHead>
                                                <TableHead>Role</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groups.map((group) => {
                                                const isAdminGroup = formData.admin_groups.some(g => group.name.includes(g) || group.dn.includes(g))
                                                const isUserGroup = formData.user_groups.some(g => group.name.includes(g) || group.dn.includes(g))
                                                return (
                                                    <TableRow key={group.dn}>
                                                        <TableCell className="font-medium">{group.name}</TableCell>
                                                        <TableCell className="text-muted-foreground">{group.description || "-"}</TableCell>
                                                        <TableCell>{group.member_count}</TableCell>
                                                        <TableCell>
                                                            {isAdminGroup && <Badge variant="destructive">Admin</Badge>}
                                                            {isUserGroup && !isAdminGroup && <Badge variant="secondary">User</Badge>}
                                                            {!isAdminGroup && !isUserGroup && <Badge variant="outline">Non mappe</Badge>}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    )
}
