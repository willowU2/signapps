"use client"

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState, useRef, useCallback } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MonitorSmartphone, Shield, Server, Plug, Settings, History, Lock, Eye, Terminal, X, Trash2, RefreshCw, Edit } from 'lucide-react';
import { remoteApi, RemoteConnection, CreateConnectionRequest, UpdateConnectionRequest } from "@/lib/api-remote"
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

export default function RemoteAccessDashboard() {
    const [connections, setConnections] = useState<RemoteConnection[]>([])
    const [loading, setLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [activeConnection, setActiveConnection] = useState<RemoteConnection | null>(null)
    const [viewerOpen, setViewerOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [editing, setEditing] = useState(false)
    const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    // Form state for new connection
    const [newConnection, setNewConnection] = useState<CreateConnectionRequest>({
        name: '',
        protocol: 'rdp',
        hostname: '',
        port: 3389,
        username: '',
        password: '',
    })

    // Form state for editing
    const [editConnection, setEditConnection] = useState<UpdateConnectionRequest>({})

    const loadConnections = useCallback(async () => {
        try {
            setLoading(true)
            const data = await remoteApi.connections.list()
            setConnections(data)
        } catch (err) {
            console.debug('Failed to load connections:', err)
            toast.error('Impossible de charger les connexions')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadConnections()
    }, [loadConnections])

    const handleCreateConnection = async () => {
        if (!newConnection.name || !newConnection.hostname) {
            toast.error('Nom et hostname requis')
            return
        }

        try {
            setCreating(true)
            const created = await remoteApi.connections.create(newConnection)
            setConnections(prev => [...prev, created])
            setCreateDialogOpen(false)
            setNewConnection({
                name: '',
                protocol: 'rdp',
                hostname: '',
                port: 3389,
                username: '',
                password: '',
            })
            toast.success('Connexion crée avec succs')
        } catch (err) {
            console.debug('Impossible de créer connection:', err)
            toast.error('chec de la cration')
        } finally {
            setCreating(false)
        }
    }

    const handleUpdateConnection = async () => {
        if (!activeConnection) return

        try {
            setEditing(true)
            const updated = await remoteApi.connections.update(activeConnection.id, editConnection)
            setConnections(prev => prev.map(c => c.id === updated.id ? updated : c))
            setEditDialogOpen(false)
            setActiveConnection(null)
            setEditConnection({})
            toast.success('Connexion mise  jour')
        } catch (err) {
            console.debug('Impossible de mettre à jour connection:', err)
            toast.error('chec de la mise  jour')
        } finally {
            setEditing(false)
        }
    }

    const handleDeleteConnection = (id: string) => {
        setDeleteConnectionId(id)
    }

    const handleDeleteConnectionConfirm = async () => {
        if (!deleteConnectionId) return
        setDeleteConnectionId(null)
        try {
            await remoteApi.connections.delete(deleteConnectionId)
            setConnections(prev => prev.filter(c => c.id !== deleteConnectionId))
            toast.success('Connexion supprime')
        } catch (err) {
            console.debug('Impossible de supprimer connection:', err)
            toast.error('chec de la suppression')
        }
    }

    const openEditDialog = (conn: RemoteConnection) => {
        setActiveConnection(conn)
        setEditConnection({
            name: conn.name,
            protocol: conn.protocol,
            hostname: conn.hostname,
            port: conn.port,
            username: conn.username,
        })
        setEditDialogOpen(true)
    }

    const handleConnect = (conn: RemoteConnection) => {
        setActiveConnection(conn)
        setViewerOpen(true)

        // Connect via WebSocket
        const wsUrl = remoteApi.connections.getWebSocketUrl(conn.id)
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            toast.success(`Connect  ${conn.name}`)
        }

        ws.onmessage = (_event) => {
            // Handle Guacamole protocol messages
            // In a real implementation, we would parse and render Guacamole instructions on canvas
        }

        ws.onerror = (error) => {
            console.debug('WebSocket error:', error)
            toast.error('Erreur de connexion')
        }

        ws.onclose = () => {
            // Connection closed
        }
    }

    const handleDisconnect = () => {
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setViewerOpen(false)
        setActiveConnection(null)
        toast.info('Dconnect')
    }

    const getProtocolPort = (protocol: string): number => {
        switch (protocol) {
            case 'rdp': return 3389
            case 'vnc': return 5900
            case 'ssh': return 22
            case 'telnet': return 23
            default: return 3389
        }
    }

    const activeSessionsCount = 0 // Would come from backend in real implementation

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Remote Access</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Accs scuris via navigateur  votre infrastructure (RDP, VNC, SSH).</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadConnections} disabled={loading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Rafrachir
                        </Button>
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white">
                                    <Plug className="mr-2 h-4 w-4" /> Nouvelle connexion
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Nouvelle connexion</DialogTitle>
                                    <DialogDescription>
                                        Configurer une nouvelle connexion remote (RDP, VNC, SSH)
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nom</Label>
                                        <Input
                                            id="name"
                                            placeholder="Mon Serveur"
                                            value={newConnection.name}
                                            onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="protocol">Protocole</Label>
                                        <Select
                                            value={newConnection.protocol}
                                            onValueChange={(v: 'rdp' | 'vnc' | 'ssh' | 'telnet') => setNewConnection(prev => ({
                                                ...prev,
                                                protocol: v,
                                                port: getProtocolPort(v)
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="rdp">RDP (Remote Desktop)</SelectItem>
                                                <SelectItem value="vnc">VNC</SelectItem>
                                                <SelectItem value="ssh">SSH</SelectItem>
                                                <SelectItem value="telnet">Telnet</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 grid gap-2">
                                            <Label htmlFor="hostname">Hostname / IP</Label>
                                            <Input
                                                id="hostname"
                                                placeholder="192.168.1.100"
                                                value={newConnection.hostname}
                                                onChange={(e) => setNewConnection(prev => ({ ...prev, hostname: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="port">Port</Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={newConnection.port}
                                                onChange={(e) => setNewConnection(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="username">Nom d'utilisateur</Label>
                                        <Input
                                            id="username"
                                            placeholder="admin"
                                            value={newConnection.username || ''}
                                            onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Mot de passe</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder=""
                                            value={newConnection.password || ''}
                                            onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                        Annuler
                                    </Button>
                                    <Button onClick={handleCreateConnection} disabled={creating}>
                                        {creating && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                                        Crer
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
                            <Shield className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">Scuris & En ligne</div>
                            <p className="text-xs text-muted-foreground mt-1">Guacamole translation layer actif</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
                            <MonitorSmartphone className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono">{activeSessionsCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Utilisateurs connects</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Endpoints sauvegards</CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{connections.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Configurs pour accs rapide</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Logs d'audit</CardTitle>
                            <History className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">-</div>
                            <p className="text-xs text-muted-foreground mt-1">vnements enregistrs aujourd'hui</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Connections Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
                    </div>
                ) : connections.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Aucune connexion configure</h3>
                        <p className="text-muted-foreground mt-2">Crez votre premire connexion pour accder  vos serveurs.</p>
                        <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                            <Plug className="mr-2 h-4 w-4" /> Nouvelle connexion
                        </Button>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {connections.map((conn) => (
                            <Card key={conn.id} className="group hover:border-blue-500/50 transition-colors overflow-hidden relative">
                                <div className={`absolute top-0 right-0 w-16 h-16 transform translate-x-8 -translate-y-8 rotate-45 ${
                                    conn.protocol === 'rdp' ? 'bg-blue-500/10' :
                                    conn.protocol === 'ssh' ? 'bg-zinc-500/10' :
                                    conn.protocol === 'vnc' ? 'bg-purple-500/10' :
                                    'bg-amber-500/10'
                                }`}></div>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-md ${
                                                conn.protocol === 'rdp' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                conn.protocol === 'ssh' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
                                                conn.protocol === 'vnc' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                            }`}>
                                                {conn.protocol === 'ssh' ? <Terminal className="h-5 w-5" /> : <MonitorSmartphone className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{conn.name}</CardTitle>
                                                <CardDescription className="flex items-center gap-1 mt-0.5">
                                                    {conn.username && <><Lock className="h-3 w-3" /> {conn.username}</>}
                                                    {!conn.username && <span className="text-muted-foreground/50">Pas d'utilisateur</span>}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-1 rounded bg-muted/60 text-muted-foreground border uppercase">
                                            {conn.protocol}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <div className="text-sm text-muted-foreground">
                                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                                            {conn.hostname}:{conn.port}
                                        </code>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-2 border-t mt-4 flex justify-between bg-muted/20">
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(conn)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteConnection(conn.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button size="sm" className="bg-primary/90 hover:bg-primary shadow-sm" onClick={() => handleConnect(conn)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Connecter
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Modifier la connexion</DialogTitle>
                        <DialogDescription>
                            Modifier les paramtres de connexion
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Nom</Label>
                            <Input
                                id="edit-name"
                                value={editConnection.name || ''}
                                onChange={(e) => setEditConnection(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-protocol">Protocole</Label>
                            <Select
                                value={editConnection.protocol}
                                onValueChange={(v: 'rdp' | 'vnc' | 'ssh' | 'telnet') => setEditConnection(prev => ({
                                    ...prev,
                                    protocol: v,
                                    port: getProtocolPort(v)
                                }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="rdp">RDP (Remote Desktop)</SelectItem>
                                    <SelectItem value="vnc">VNC</SelectItem>
                                    <SelectItem value="ssh">SSH</SelectItem>
                                    <SelectItem value="telnet">Telnet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 grid gap-2">
                                <Label htmlFor="edit-hostname">Hostname / IP</Label>
                                <Input
                                    id="edit-hostname"
                                    value={editConnection.hostname || ''}
                                    onChange={(e) => setEditConnection(prev => ({ ...prev, hostname: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-port">Port</Label>
                                <Input
                                    id="edit-port"
                                    type="number"
                                    value={editConnection.port || ''}
                                    onChange={(e) => setEditConnection(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-username">Nom d'utilisateur</Label>
                            <Input
                                id="edit-username"
                                value={editConnection.username || ''}
                                onChange={(e) => setEditConnection(prev => ({ ...prev, username: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-password">Nouveau mot de passe (laisser vide pour garder l'actuel)</Label>
                            <Input
                                id="edit-password"
                                type="password"
                                placeholder=""
                                value={editConnection.password || ''}
                                onChange={(e) => setEditConnection(prev => ({ ...prev, password: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button onClick={handleUpdateConnection} disabled={editing}>
                            {editing && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remote Viewer Dialog (Fullscreen) */}
            <Dialog open={viewerOpen} onOpenChange={(open) => !open && handleDisconnect()}>
                <DialogContent className="max-w-[95vw] h-[90vh] p-0">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-md ${
                                    activeConnection?.protocol === 'rdp' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                    activeConnection?.protocol === 'ssh' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
                                    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                }`}>
                                    {activeConnection?.protocol === 'ssh' ? <Terminal className="h-5 w-5" /> : <MonitorSmartphone className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-semibold">{activeConnection?.name}</h3>
                                    <p className="text-xs text-muted-foreground">{activeConnection?.hostname}:{activeConnection?.port} ({activeConnection?.protocol?.toUpperCase()})</p>
                                </div>
                            </div>
                            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                                <X className="h-4 w-4 mr-2" />
                                Dconnecter
                            </Button>
                        </div>
                        <div className="flex-1 bg-black flex items-center justify-center">
                            <canvas
                                ref={canvasRef}
                                className="max-w-full max-h-full"
                                style={{ imageRendering: 'pixelated' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-white/50">
                                <div className="text-center">
                                    <MonitorSmartphone className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                    <p>Connexion au serveur distant...</p>
                                    <p className="text-sm mt-2 opacity-75">Le rendu Guacamole sera affich ici</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteConnectionId} onOpenChange={() => setDeleteConnectionId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette connexion ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConnectionConfirm}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    )
}
