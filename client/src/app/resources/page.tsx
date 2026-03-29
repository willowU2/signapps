"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Search, MapPin, Users, Clock, CalendarPlus, ExternalLink } from "lucide-react"
import { useResourcesStore } from "@/stores/resources-store"
import {
    Resource,
    ResourceTypeCategory,
    getResourceTypeIcon,
    getResourceTypeLabel,
} from "@/lib/api/resources"
import { calendarApi } from "@/lib/api/calendar"
import { EntityLinks } from "@/components/crosslinks/EntityLinks"
import { toast } from "sonner"
import { usePageTitle } from '@/hooks/use-page-title';

const resourceTypeOptions: { value: ResourceTypeCategory; label: string; icon: string }[] = [
    { value: "room", label: "Salle", icon: "🚪" },
    { value: "equipment", label: "Équipement", icon: "🖥️" },
    { value: "vehicle", label: "Véhicule", icon: "🚗" },
    { value: "desk", label: "Bureau", icon: "🪑" },
]

export default function ResourcesPublicPage() {
  usePageTitle('Ressources');
    const {
        createReservation,
    } = useResourcesStore()

    const { data: resources = [], isLoading: resourcesLoading } = useQuery<Resource[]>({
        queryKey: ['resources'],
        queryFn: async () => {
            const { resourcesApi } = await import("@/lib/api/resources")
            const res = await resourcesApi.list()
            return res.data || []
        },
    })

    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState<ResourceTypeCategory | "all">("all")
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [isBookingOpen, setIsBookingOpen] = useState(false)
    const [bookingNotes, setBookingNotes] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [bookingDate, setBookingDate] = useState("")
    const [bookingStartTime, setBookingStartTime] = useState("09:00")
    const [bookingEndTime, setBookingEndTime] = useState("10:00")

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
        // Pre-fill with today's date
        const today = new Date().toISOString().slice(0, 10)
        setBookingDate(today)
        setBookingStartTime("09:00")
        setBookingEndTime("10:00")
        setIsBookingOpen(true)
    }

    const handleConfirmBooking = async () => {
        if (!selectedResource) return
        if (!bookingDate) {
            toast.error("Veuillez sélectionner une date.")
            return
        }
        if (bookingStartTime >= bookingEndTime) {
            toast.error("L'heure de fin doit être après l'heure de début.")
            return
        }
        setIsSubmitting(true)
        const startIso = `${bookingDate}T${bookingStartTime}:00`
        const endIso = `${bookingDate}T${bookingEndTime}:00`
        try {
            const reservation = await createReservation(selectedResource.id, undefined, bookingNotes || undefined)
            setIsBookingOpen(false)

            // Create calendar event after successful booking
            let calendarEventId: string | undefined
            try {
                const calendars = await calendarApi.listCalendars()
                const calendarId = calendars.data?.[0]?.id
                if (calendarId) {
                    const event = await calendarApi.createEvent(calendarId, {
                        title: `Réservation : ${selectedResource.name}`,
                        start_time: startIso,
                        end_time: endIso,
                        description: bookingNotes || undefined,
                    })
                    calendarEventId = event.data?.id
                }
            } catch {
                // Calendar event creation is best-effort
            }

            setSelectedResource(null)

            if (selectedResource.requires_approval) {
                toast.info("Votre demande de réservation a été envoyée. Vous serez notifié une fois approuvée.")
            } else if (calendarEventId) {
                toast.success(
                    <span>
                        Ressource réservée !{" "}
                        <a href="/cal" className="underline font-medium inline-flex items-center gap-1">
                            Voir dans le calendrier <ExternalLink className="h-3 w-3" />
                        </a>
                    </span>
                )
            } else {
                toast.success("Ressource réservée avec succès !")
            }
        } catch (error) {
            console.error("Impossible de créer reservation:", error)
            toast.error("Erreur lors de la réservation. Veuillez réessayer.")
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
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} className="overflow-hidden">
                                <CardHeader className="pb-2">
                                    <Skeleton className="h-5 w-2/3" />
                                    <Skeleton className="h-3 w-full mt-1" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-4 w-1/2 mb-2" />
                                    <Skeleton className="h-4 w-1/3" />
                                </CardContent>
                                <CardFooter>
                                    <Skeleton className="h-9 w-full" />
                                </CardFooter>
                            </Card>
                        ))}
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
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="booking-date">Date *</Label>
                                    <Input
                                        id="booking-date"
                                        type="date"
                                        value={bookingDate}
                                        onChange={(e) => setBookingDate(e.target.value)}
                                        min={new Date().toISOString().slice(0, 10)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="booking-start">Heure de début *</Label>
                                        <Input
                                            id="booking-start"
                                            type="time"
                                            value={bookingStartTime}
                                            onChange={(e) => setBookingStartTime(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="booking-end">Heure de fin *</Label>
                                        <Input
                                            id="booking-end"
                                            type="time"
                                            value={bookingEndTime}
                                            onChange={(e) => setBookingEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes (optionnel)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Ajoutez des informations sur votre réservation..."
                                    value={bookingNotes}
                                    onChange={(e) => setBookingNotes(e.target.value)}
                                />
                            </div>
                            {selectedResource && (
                                <div className="border-t pt-4">
                                    <EntityLinks entityType="resource" entityId={selectedResource.id} />
                                </div>
                            )}
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
