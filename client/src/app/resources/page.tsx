"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, MapPin, Users, Clock, CalendarPlus } from "lucide-react"
import { useResourcesStore } from "@/stores/resources-store"
import {
    Resource,
    ResourceTypeCategory,
    getResourceTypeIcon,
    getResourceTypeLabel,
} from "@/lib/api/resources"

const resourceTypeOptions: { value: ResourceTypeCategory; label: string; icon: string }[] = [
    { value: "room", label: "Salle", icon: "🚪" },
    { value: "equipment", label: "Équipement", icon: "🖥️" },
    { value: "vehicle", label: "Véhicule", icon: "🚗" },
    { value: "desk", label: "Bureau", icon: "🪑" },
]

export default function ResourcesPublicPage() {
    const {
        resources,
        resourcesLoading,
        fetchResources,
        createReservation,
    } = useResourcesStore()

    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState<ResourceTypeCategory | "all">("all")
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [bookingNotes, setBookingNotes] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchResources()
    }, [fetchResources])

    const filteredResources = resources.filter(resource => {
        if (!resource.is_available) return false
        const matchesSearch =
            resource.name.toLowerCase().includes(search.toLowerCase()) ||
            (resource.description?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
            (resource.location?.toLowerCase() ?? "").includes(search.toLowerCase())
        const matchesType = typeFilter === "all" || resource.resource_type === typeFilter
        return matchesSearch && matchesType
    })

    const handleBookResource = (resource: Resource) => {
        setSelectedResource(resource)
        setBookingNotes("")
        setIsBookingOpen(true)
    }

    const handleConfirmBooking = async () => {
        if (!selectedResource) return
        setIsSubmitting(true)
        try {
            await createReservation(selectedResource.id, undefined, bookingNotes || undefined)
            setIsBookingOpen(false)
            setSelectedResource(null)
            alert(selectedResource.requires_approval
                ? "Votre demande de réservation a été envoyée. Vous serez notifié une fois qu'elle sera approuvée."
                : "Ressource réservée avec succès !"
            )
        } catch (error) {
            console.error("Failed to create reservation:", error)
            alert("Erreur lors de la réservation. Veuillez réessayer.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const groupedResources = resourceTypeOptions.reduce((acc, type) => {
        const typeResources = filteredResources.filter(r => r.resource_type === type.value)
        if (typeResources.length > 0) {
            acc[type.value] = typeResources
        }
        return acc
    }, {} as Record<ResourceTypeCategory, Resource[]>)

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Réserver une ressource</h1>
                    <p className="text-muted-foreground mt-1">
                        Parcourez et réservez les salles, équipements et véhicules disponibles.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher une ressource..."
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
                    <div className="flex items-center justify-center py-12">
                        <div className="text-muted-foreground">Chargement des ressources...</div>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Search className="h-12 w-12 text-muted-foreground mb-4" />
                            <CardTitle className="text-lg">Aucune ressource trouvée</CardTitle>
                            <CardDescription>
                                Essayez de modifier vos critères de recherche.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedResources).map(([type, typeResources]) => (
                            <div key={type}>
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <span>{getResourceTypeIcon(type as ResourceTypeCategory)}</span>
                                    {getResourceTypeLabel(type as ResourceTypeCategory)}s
                                    <Badge variant="secondary">{typeResources.length}</Badge>
                                </h2>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {typeResources.map((resource) => (
                                        <Card key={resource.id} className="flex flex-col">
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <CardTitle className="text-lg">
                                                        {resource.name}
                                                    </CardTitle>
                                                    {resource.requires_approval && (
                                                        <Badge variant="outline" className="text-xs shrink-0">
                                                            <Clock className="mr-1 h-3 w-3" />
                                                            Approbation
                                                        </Badge>
                                                    )}
                                                </div>
                                                {resource.description && (
                                                    <CardDescription className="line-clamp-2">
                                                        {resource.description}
                                                    </CardDescription>
                                                )}
                                            </CardHeader>
                                            <CardContent className="flex-1">
                                                <div className="space-y-2 text-sm text-muted-foreground">
                                                    {(resource.building || resource.floor || resource.location) && (
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-4 w-4" />
                                                            <span>
                                                                {[resource.building, resource.floor, resource.location]
                                                                    .filter(Boolean)
                                                                    .join(", ")}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {resource.capacity && (
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4" />
                                                            <span>{resource.capacity} personnes</span>
                                                        </div>
                                                    )}
                                                    {resource.amenities && resource.amenities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {resource.amenities.slice(0, 3).map((amenity, i) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">
                                                                    {amenity}
                                                                </Badge>
                                                            ))}
                                                            {resource.amenities.length > 3 && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    +{resource.amenities.length - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                            <CardFooter>
                                                <Button
                                                    className="w-full"
                                                    onClick={() => handleBookResource(resource)}
                                                >
                                                    <CalendarPlus className="mr-2 h-4 w-4" />
                                                    Réserver
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Réserver {selectedResource?.name}</DialogTitle>
                            <DialogDescription>
                                {selectedResource?.requires_approval
                                    ? "Cette ressource nécessite une approbation. Votre demande sera examinée par un administrateur."
                                    : "Confirmez votre réservation pour cette ressource."
                                }
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {selectedResource && (
                                <div className="rounded-lg border p-4 space-y-2">
                                    <div className="flex items-center gap-2 font-medium">
                                        <span>{getResourceTypeIcon(selectedResource.resource_type)}</span>
                                        {selectedResource.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {selectedResource.description}
                                    </div>
                                    {(selectedResource.building || selectedResource.location) && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            {[selectedResource.building, selectedResource.floor, selectedResource.location]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (optionnel)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Ajoutez des informations sur votre réservation..."
                                    value={bookingNotes}
                                    onChange={(e) => setBookingNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBookingOpen(false)}>
                                Annuler
                            </Button>
                            <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
                                {isSubmitting ? "Réservation..." : selectedResource?.requires_approval ? "Demander" : "Confirmer"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    )
}
