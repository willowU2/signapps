"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Check, X, Clock } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResourcesStore } from "@/stores/resources-store"
import {
    Resource,
    ResourceTypeCategory,
    getResourceTypeIcon,
    getResourceTypeLabel,
    getReservationStatusColor,
    getReservationStatusLabel,
} from "@/lib/api/resources"
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

const resourceTypeOptions: { value: ResourceTypeCategory; label: string; icon: string }[] = [
    { value: "room", label: "Salle", icon: "🚪" },
    { value: "equipment", label: "Équipement", icon: "🖥️" },
    { value: "vehicle", label: "Véhicule", icon: "🚗" },
    { value: "desk", label: "Bureau", icon: "🪑" },
]

export default function ResourcesPage() {
    const {
        resources,
        resourcesLoading,
        resourceTypes,
        resourceTypesLoading,
        pendingReservations,
        pendingLoading,
        fetchResources,
        fetchResourceTypes,
        fetchPendingReservations,
        createResource,
        deleteResource,
        approveReservation,
        rejectReservation,
    } = useResourcesStore()

    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState<ResourceTypeCategory | "all">("all")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deleteResourceTarget, setDeleteResourceTarget] = useState<Resource | null>(null)
    const [rejectReservationId, setRejectReservationId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const [newResource, setNewResource] = useState({
        name: "",
        resource_type: "room" as ResourceTypeCategory,
        description: "",
        capacity: "",
        location: "",
        floor: "",
        building: "",
        requires_approval: false,
    })

    useEffect(() => {
        fetchResources()
        fetchResourceTypes()
        fetchPendingReservations()
    }, [fetchResources, fetchResourceTypes, fetchPendingReservations])

    const filteredResources = resources.filter(resource => {
        const matchesSearch =
            resource.name.toLowerCase().includes(search.toLowerCase()) ||
            (resource.description?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
            (resource.location?.toLowerCase() ?? "").includes(search.toLowerCase())
        const matchesType = typeFilter === "all" || resource.resource_type === typeFilter
        return matchesSearch && matchesType
    })

    const handleCreate = async () => {
        if (!newResource.name.trim()) return
        setIsSubmitting(true)
        try {
            await createResource({
                name: newResource.name,
                resource_type: newResource.resource_type,
                description: newResource.description || undefined,
                capacity: newResource.capacity ? parseInt(newResource.capacity, 10) : undefined,
                location: newResource.location || undefined,
                floor: newResource.floor || undefined,
                building: newResource.building || undefined,
                requires_approval: newResource.requires_approval,
            })
            setIsCreateOpen(false)
            setNewResource({
                name: "",
                resource_type: "room",
                description: "",
                capacity: "",
                location: "",
                floor: "",
                building: "",
                requires_approval: false,
            })
        } catch {
            toast.error("Erreur lors de la création de la ressource")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = (resource: Resource) => {
        setDeleteResourceTarget(resource)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteResourceTarget) return
        setDeleteResourceTarget(null)
        try {
            await deleteResource(deleteResourceTarget.id)
        } catch {
            toast.error("Erreur lors de la suppression de la ressource")
        }
    }

    const handleApprove = async (reservationId: string) => {
        try {
            await approveReservation(reservationId)
        } catch {
            toast.error("Erreur lors de l'approbation de la réservation")
        }
    }

    const handleReject = (reservationId: string) => {
        setRejectReason("")
        setRejectReservationId(reservationId)
    }

    const handleRejectConfirm = async () => {
        if (!rejectReservationId) return
        setRejectReservationId(null)
        try {
            await rejectReservation(rejectReservationId, rejectReason || undefined)
        } catch {
            toast.error("Erreur lors du refus de la réservation")
        }
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Ressources</h1>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Nouvelle ressource
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Créer une ressource</DialogTitle>
                                <DialogDescription>
                                    Ajoutez une nouvelle ressource réservable (salle, équipement, véhicule, bureau).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nom *</Label>
                                    <Input
                                        id="name"
                                        placeholder="Salle de réunion A"
                                        value={newResource.name}
                                        onChange={(e) => setNewResource(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type *</Label>
                                    <Select
                                        value={newResource.resource_type}
                                        onValueChange={(value: ResourceTypeCategory) =>
                                            setNewResource(prev => ({ ...prev, resource_type: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {resourceTypeOptions.map(option => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.icon} {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Description de la ressource..."
                                        value={newResource.description}
                                        onChange={(e) => setNewResource(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="capacity">Capacité</Label>
                                        <Input
                                            id="capacity"
                                            type="number"
                                            placeholder="10"
                                            value={newResource.capacity}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, capacity: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="floor">Étage</Label>
                                        <Input
                                            id="floor"
                                            placeholder="2"
                                            value={newResource.floor}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, floor: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="building">Bâtiment</Label>
                                        <Input
                                            id="building"
                                            placeholder="Bâtiment A"
                                            value={newResource.building}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, building: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="location">Emplacement</Label>
                                        <Input
                                            id="location"
                                            placeholder="Aile Est"
                                            value={newResource.location}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, location: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label>Approbation requise</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Les réservations doivent être approuvées
                                        </p>
                                    </div>
                                    <Switch
                                        checked={newResource.requires_approval}
                                        onCheckedChange={(checked) =>
                                            setNewResource(prev => ({ ...prev, requires_approval: checked }))
                                        }
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleCreate} disabled={isSubmitting || !newResource.name.trim()}>
                                    {isSubmitting ? "Création..." : "Créer"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Tabs defaultValue="resources" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="resources">Ressources</TabsTrigger>
                        <TabsTrigger value="pending" className="relative">
                            Réservations en attente
                            {pendingReservations.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                                    {pendingReservations.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="resources" className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher..."
                                    className="pl-8"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Select
                                value={typeFilter}
                                onValueChange={(value) => setTypeFilter(value as ResourceTypeCategory | "all")}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Tous les types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les types</SelectItem>
                                    {resourceTypeOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.icon} {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {resourcesLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-muted-foreground">Chargement...</div>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nom</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Emplacement</TableHead>
                                            <TableHead>Capacité</TableHead>
                                            <TableHead>Statut</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredResources.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    Aucune ressource trouvée
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredResources.map((resource) => (
                                                <TableRow key={resource.id}>
                                                    <TableCell className="font-medium">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span>{getResourceTypeIcon(resource.resource_type)}</span>
                                                                {resource.name}
                                                            </div>
                                                            {resource.description && (
                                                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                                    {resource.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {getResourceTypeLabel(resource.resource_type)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {[resource.building, resource.floor, resource.location]
                                                            .filter(Boolean)
                                                            .join(", ") || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {resource.capacity ? `${resource.capacity} pers.` : "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant={resource.is_available ? "default" : "secondary"}>
                                                                {resource.is_available ? "Disponible" : "Indisponible"}
                                                            </Badge>
                                                            {resource.requires_approval && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    <Clock className="mr-1 h-3 w-3" />
                                                                    Approbation
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(resource.id)}>
                                                                    Copier l&apos;ID
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Modifier
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => handleDelete(resource)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Supprimer
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="pending" className="space-y-4">
                        {pendingLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-muted-foreground">Chargement...</div>
                            </div>
                        ) : pendingReservations.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Check className="h-12 w-12 text-green-500 mb-4" />
                                    <CardTitle className="text-lg">Aucune réservation en attente</CardTitle>
                                    <CardDescription>
                                        Toutes les demandes de réservation ont été traitées.
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {pendingReservations.map((reservation) => (
                                    <Card key={reservation.id}>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="text-base">
                                                        Réservation #{reservation.id.slice(0, 8)}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Demandée le {new Date(reservation.created_at).toLocaleDateString("fr-FR", {
                                                            day: "numeric",
                                                            month: "long",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </CardDescription>
                                                </div>
                                                <Badge className={getReservationStatusColor(reservation.status)}>
                                                    {getReservationStatusLabel(reservation.status)}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Ressource: </span>
                                                    <span className="font-medium">{reservation.resource_id}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Demandeur: </span>
                                                    <span className="font-medium">{reservation.requested_by}</span>
                                                </div>
                                                {reservation.notes && (
                                                    <div>
                                                        <span className="text-muted-foreground">Notes: </span>
                                                        <span>{reservation.notes}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(reservation.id)}
                                                >
                                                    <Check className="mr-2 h-4 w-4" />
                                                    Approuver
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReject(reservation.id)}
                                                >
                                                    <X className="mr-2 h-4 w-4" />
                                                    Refuser
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Delete resource confirm */}
            <AlertDialog open={!!deleteResourceTarget} onOpenChange={() => setDeleteResourceTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer &quot;{deleteResourceTarget?.name}&quot; ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject reservation dialog */}
            <AlertDialog open={!!rejectReservationId} onOpenChange={() => setRejectReservationId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Refuser la réservation</AlertDialogTitle>
                        <AlertDialogDescription>
                            <Input
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="Motif du refus (optionnel)"
                                className="mt-2"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRejectConfirm}>Refuser</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    )
}
