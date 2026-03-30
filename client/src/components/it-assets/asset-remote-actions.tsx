"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Power, PowerOff, Lock, Zap, Upload, Download, FolderOpen,
    CheckCircle, Clock, AlertCircle, RefreshCw,
} from "lucide-react"
import { itAssetsApi, HardwareAsset, AgentCommand, FileTransfer, CommandType } from "@/lib/api/it-assets"
import { toast } from "sonner"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRemoteActionsProps {
    asset: HardwareAsset
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function commandStatusBadge(status: AgentCommand['status']) {
    const map: Record<AgentCommand['status'], { label: string; className: string }> = {
        pending:      { label: "En attente",    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
        sent:         { label: "Envoye",        className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
        acknowledged: { label: "Recu",          className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
        done:         { label: "Execute",       className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
        failed:       { label: "Echec",         className: "bg-red-500/10 text-red-600 border-red-500/20" },
    }
    const meta = map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" }
    return <Badge className={`text-xs border ${meta.className}`}>{meta.label}</Badge>
}

function fileStatusIcon(status: FileTransfer['status']) {
    switch (status) {
        case "done":        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        case "failed":      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        case "transferring": return <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        default:            return <Clock className="h-3.5 w-3.5 text-yellow-500" />
    }
}

function formatBytes(bytes?: number): string {
    if (!bytes) return "?"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssetRemoteActions({ asset }: AssetRemoteActionsProps) {
    const [commands, setCommands] = useState<AgentCommand[]>([])
    const [files, setFiles] = useState<FileTransfer[]>([])
    const [loadingCmds, setLoadingCmds] = useState(false)
    const [loadingFiles, setLoadingFiles] = useState(false)

    // WoL state
    const [waking, setWaking] = useState(false)

    // Command confirm dialogs
    const [pendingCmd, setPendingCmd] = useState<CommandType | null>(null)

    // File push dialog
    const [fileDialogOpen, setFileDialogOpen] = useState(false)
    const [pushFile, setPushFile] = useState({ filename: "", target_path: "", content_base64: "" })
    const [pushing, setPushing] = useState(false)

    // Drag-and-drop state
    const [dragOver, setDragOver] = useState(false)

    // Load commands
    const loadCommands = useCallback(async () => {
        setLoadingCmds(true)
        try {
            const res = await itAssetsApi.listHardwareCommands(asset.id)
            setCommands(res.data || [])
        } catch {
            toast.error("Impossible de charger les commandes")
        } finally {
            setLoadingCmds(false)
        }
    }, [asset.id])

    // Load file transfers
    const loadFiles = useCallback(async () => {
        setLoadingFiles(true)
        try {
            const res = await itAssetsApi.listHardwareFiles(asset.id)
            setFiles(res.data || [])
        } catch {
            toast.error("Impossible de charger les fichiers")
        } finally {
            setLoadingFiles(false)
        }
    }, [asset.id])

    // RM2: Wake-on-LAN
    const handleWakeOnLan = async () => {
        setWaking(true)
        try {
            const res = await itAssetsApi.wakeOnLan(asset.id)
            toast.success(res.data?.message ?? "Magic packet envoye")
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erreur WoL"
            toast.error(msg.includes("MAC") ? "Aucune adresse MAC enregistree pour cette machine" : msg)
        } finally {
            setWaking(false)
        }
    }

    // RM3: Queue command
    const confirmCommand = (cmd: CommandType) => setPendingCmd(cmd)

    const handleQueueCommand = async (cmd: CommandType) => {
        setPendingCmd(null)
        try {
            await itAssetsApi.queueCommand({ hardware_id: asset.id, command: cmd })
            toast.success(`Commande "${cmd}" envoyee a l'agent`)
            loadCommands()
        } catch {
            toast.error(`Impossible d'envoyer la commande`)
        }
    }

    // RM4: File push via drag-and-drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            const b64 = (ev.target?.result as string).split(",")[1] ?? ""
            setPushFile({
                filename: file.name,
                target_path: `/tmp/${file.name}`,
                content_base64: b64,
            })
        }
        reader.readAsDataURL(file)
        setFileDialogOpen(true)
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const b64 = (ev.target?.result as string).split(",")[1] ?? ""
            setPushFile({
                filename: file.name,
                target_path: `/tmp/${file.name}`,
                content_base64: b64,
            })
        }
        reader.readAsDataURL(file)
        setFileDialogOpen(true)
    }

    const handlePushFile = async () => {
        if (!pushFile.filename || !pushFile.target_path) {
            toast.error("Nom de fichier et chemin requis")
            return
        }
        setPushing(true)
        try {
            await itAssetsApi.pushFile({
                hardware_id: asset.id,
                filename: pushFile.filename,
                target_path: pushFile.target_path,
                content_base64: pushFile.content_base64 || undefined,
            })
            toast.success(`Fichier "${pushFile.filename}" mis en file pour transfert`)
            setFileDialogOpen(false)
            setPushFile({ filename: "", target_path: "", content_base64: "" })
            loadFiles()
        } catch {
            toast.error("Impossible de planifier le transfert")
        } finally {
            setPushing(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* RM2 + RM3: Quick Actions */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Power className="h-4 w-4 text-blue-500" />
                        Actions distantes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {/* Wake-on-LAN */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleWakeOnLan}
                            disabled={waking}
                            className="gap-1.5 text-xs"
                        >
                            <Zap className={`h-3.5 w-3.5 text-amber-500 ${waking ? "animate-pulse" : ""}`} />
                            {waking ? "Envoi..." : "Demarrer (WoL)"}
                        </Button>

                        {/* Reboot */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmCommand("reboot")}
                            className="gap-1.5 text-xs"
                        >
                            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                            Redemarrer
                        </Button>

                        {/* Shutdown */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmCommand("shutdown")}
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                        >
                            <PowerOff className="h-3.5 w-3.5" />
                            Eteindre
                        </Button>

                        {/* Lock */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmCommand("lock")}
                            className="gap-1.5 text-xs"
                        >
                            <Lock className="h-3.5 w-3.5 text-zinc-500" />
                            Verrouiller
                        </Button>
                    </div>

                    {/* Commands history */}
                    <div className="mt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadCommands}
                            disabled={loadingCmds}
                            className="text-xs text-muted-foreground h-6 px-2 gap-1"
                        >
                            <RefreshCw className={`h-3 w-3 ${loadingCmds ? "animate-spin" : ""}`} />
                            Historique des commandes
                        </Button>

                        {commands.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {commands.slice(0, 5).map((cmd) => (
                                    <div
                                        key={cmd.id}
                                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/40"
                                    >
                                        <span className="font-mono text-muted-foreground">{cmd.command}</span>
                                        {commandStatusBadge(cmd.status)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* RM4: File Transfer */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-purple-500" />
                        Transfert de fichiers
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Drag-and-drop zone */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                            dragOver
                                ? "border-purple-500 bg-purple-500/5"
                                : "border-border hover:border-purple-400 hover:bg-purple-500/5"
                        }`}
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onClick={() => document.getElementById(`file-input-${asset.id}`)?.click()}
                    >
                        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                            Glisser un fichier ici ou cliquer pour selectionner
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                            L'agent recevra le fichier lors de sa prochaine connexion
                        </p>
                        <input
                            id={`file-input-${asset.id}`}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* File transfers list */}
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadFiles}
                            disabled={loadingFiles}
                            className="text-xs text-muted-foreground h-6 px-2 gap-1"
                        >
                            <Download className={`h-3 w-3 ${loadingFiles ? "animate-spin" : ""}`} />
                            Afficher les transferts
                        </Button>

                        {files.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {files.slice(0, 5).map((f) => (
                                    <div
                                        key={f.id}
                                        className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/40"
                                    >
                                        {fileStatusIcon(f.status)}
                                        <span className="flex-1 truncate font-mono text-muted-foreground">
                                            {f.filename}
                                        </span>
                                        <span className="text-muted-foreground/60 shrink-0">
                                            {formatBytes(f.size_bytes)}
                                        </span>
                                        <Badge variant="outline" className="text-xs py-0 h-4">
                                            {f.direction === "push" ? "envoi" : "reception"}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Confirm reboot/shutdown/lock dialog */}
            <AlertDialog open={!!pendingCmd} onOpenChange={() => setPendingCmd(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Confirmer: {pendingCmd === "reboot" ? "Redemarrage" : pendingCmd === "shutdown" ? "Extinction" : "Verrouillage"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingCmd === "reboot" && "La machine va redemarrer. Les sessions en cours seront fermees."}
                            {pendingCmd === "shutdown" && "La machine va s'eteindre. L'action est irreversible depuis le logiciel."}
                            {pendingCmd === "lock" && "La session en cours sera verrouilee."}
                            {" "}Cette commande sera executee par l'agent lors de sa prochaine connexion.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => pendingCmd && handleQueueCommand(pendingCmd)}
                            className={pendingCmd === "shutdown" ? "bg-destructive hover:bg-destructive/90" : ""}
                        >
                            Confirmer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* File push details dialog */}
            <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Transferer un fichier</DialogTitle>
                        <DialogDescription>
                            Le fichier sera livre a la machine via l'agent.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Nom du fichier</Label>
                            <Input
                                value={pushFile.filename}
                                onChange={(e) => setPushFile(f => ({ ...f, filename: e.target.value }))}
                                placeholder="fichier.txt"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Chemin de destination (machine)</Label>
                            <Input
                                value={pushFile.target_path}
                                onChange={(e) => setPushFile(f => ({ ...f, target_path: e.target.value }))}
                                placeholder="C:\Users\user\Desktop\fichier.txt"
                                className="font-mono text-sm"
                            />
                        </div>
                        {pushFile.content_base64 && (
                            <p className="text-xs text-emerald-600">
                                Fichier charge ({Math.round(pushFile.content_base64.length * 0.75 / 1024)} KB)
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFileDialogOpen(false)}>Annuler</Button>
                        <Button
                            onClick={handlePushFile}
                            disabled={pushing || !pushFile.filename || !pushFile.target_path}
                        >
                            {pushing ? "Transfert..." : "Planifier le transfert"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
