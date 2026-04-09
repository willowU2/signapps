"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  MapPin,
  Users,
  Clock,
  CalendarPlus,
  ExternalLink,
  Package,
  CalendarDays,
  XCircle,
} from "lucide-react";
import {
  Resource,
  ResourceTypeCategory,
  Reservation,
  getResourceTypeIcon,
  getResourceTypeLabel,
  getReservationStatusColor,
  getReservationStatusLabel,
  resourcesApi,
  reservationsApi,
} from "@/lib/api/resources";
import { calendarApi } from "@/lib/api/calendar";
import { EntityLinks } from "@/components/crosslinks/EntityLinks";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import axios from "axios";

const resourceTypeOptions: {
  value: ResourceTypeCategory;
  label: string;
  icon: string;
}[] = [
  { value: "room", label: "Salle", icon: "door" },
  { value: "equipment", label: "Equipement", icon: "monitor" },
  { value: "vehicle", label: "Vehicule", icon: "car" },
  { value: "desk", label: "Bureau", icon: "armchair" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ResourcesPublicPage() {
  usePageTitle("Ressources");
  const queryClient = useQueryClient();

  // ---- Fetch resources ----
  const { data: resources = [], isLoading: resourcesLoading } = useQuery<
    Resource[]
  >({
    queryKey: ["resources"],
    queryFn: async () => {
      const res = await resourcesApi.list();
      return res.data || [];
    },
  });

  // ---- Fetch my reservations ----
  const { data: myReservations = [], isLoading: reservationsLoading } =
    useQuery<Reservation[]>({
      queryKey: ["my-reservations"],
      queryFn: async () => {
        const res = await reservationsApi.listMine();
        return res.data || [];
      },
    });

  // ---- UI state ----
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResourceTypeCategory | "all">(
    "all",
  );
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null,
  );
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingEndTime, setBookingEndTime] = useState("10:00");
  const [activeTab, setActiveTab] = useState("browse");

  // ---- Filtering ----
  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.name.toLowerCase().includes(search.toLowerCase()) ||
      (resource.description?.toLowerCase() ?? "").includes(
        search.toLowerCase(),
      ) ||
      (resource.location?.toLowerCase() ?? "").includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" || resource.resource_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const groupedResources = resourceTypeOptions.reduce(
    (acc, type) => {
      const typeResources = filteredResources.filter(
        (r) => r.resource_type === type.value,
      );
      if (typeResources.length > 0) {
        acc[type.value] = typeResources;
      }
      return acc;
    },
    {} as Record<ResourceTypeCategory, Resource[]>,
  );

  // ---- Booking handlers ----
  const handleBookResource = (resource: Resource) => {
    setSelectedResource(resource);
    setBookingNotes("");
    setBookingTitle(`Reservation : ${resource.name}`);
    const today = new Date().toISOString().slice(0, 10);
    setBookingDate(today);
    setBookingStartTime("09:00");
    setBookingEndTime("10:00");
    setIsBookingOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedResource) return;
    if (!bookingDate) {
      toast.error("Veuillez selectionner une date.");
      return;
    }
    if (bookingStartTime >= bookingEndTime) {
      toast.error("L'heure de fin doit etre apres l'heure de debut.");
      return;
    }
    setIsSubmitting(true);
    const startIso = `${bookingDate}T${bookingStartTime}:00`;
    const endIso = `${bookingDate}T${bookingEndTime}:00`;
    try {
      const reservationRes = await reservationsApi.create({
        resource_id: selectedResource.id,
        notes: bookingNotes || undefined,
      });
      setIsBookingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });

      // Create calendar event after successful booking
      let calendarEventId: string | undefined;
      try {
        const calendars = await calendarApi.listCalendars();
        const calendarId = calendars.data?.[0]?.id;
        if (calendarId) {
          const event = await calendarApi.createEvent(calendarId, {
            title: bookingTitle || `Reservation : ${selectedResource.name}`,
            start_time: startIso,
            end_time: endIso,
            description: bookingNotes || undefined,
          });
          calendarEventId = event.data?.id;
        }
      } catch {
        // Calendar event creation is best-effort
      }

      setSelectedResource(null);

      if (selectedResource.requires_approval) {
        toast.info(
          "Votre demande de reservation a ete envoyee. Vous serez notifie une fois approuvee.",
        );
      } else if (calendarEventId) {
        toast.success(
          <span>
            Ressource reservee !{" "}
            <a
              href="/cal"
              className="underline font-medium inline-flex items-center gap-1"
            >
              Voir dans le calendrier <ExternalLink className="h-3 w-3" />
            </a>
          </span>,
        );
      } else {
        toast.success("Ressource reservee avec succes !");
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error(
          "Ce creneau est deja reserve. Veuillez choisir un autre creneau horaire.",
        );
      } else {
        toast.error("Erreur lors de la reservation. Veuillez reessayer.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    try {
      await reservationsApi.cancel(reservationId);
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      toast.success("Reservation annulee");
    } catch {
      toast.error("Erreur lors de l'annulation");
    }
  };

  // Helper to find resource name from reservation
  const getResourceName = (resourceId: string) => {
    const resource = resources.find((r) => r.id === resourceId);
    return resource?.name ?? "Ressource inconnue";
  };

  const getResourceForReservation = (resourceId: string) => {
    return resources.find((r) => r.id === resourceId);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ressources</h1>
          <p className="text-muted-foreground mt-1">
            Parcourez et reservez les salles, equipements et vehicules
            disponibles.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="browse">
              <Package className="w-4 h-4 mr-1.5" />
              Ressources
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <CalendarDays className="w-4 h-4 mr-1.5" />
              Mes reservations
              {myReservations.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {myReservations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* Browse resources tab                                         */}
          {/* ============================================================ */}
          <TabsContent value="browse" className="space-y-6 mt-4">
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
                onValueChange={(value) =>
                  setTypeFilter(value as ResourceTypeCategory | "all")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {resourceTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {getResourceTypeIcon(option.value)} {option.label}
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
              <EmptyState
                icon={Package}
                title={
                  resources.length === 0
                    ? "Aucune ressource configuree"
                    : "Aucune ressource trouvee"
                }
                description={
                  resources.length === 0
                    ? "Les ressources (salles, equipements, vehicules) seront affichees ici une fois configurees par un administrateur."
                    : "Essayez de modifier vos criteres de recherche."
                }
                context={resources.length === 0 ? "empty" : "search"}
              />
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedResources).map(
                  ([type, typeResources]) => (
                    <div key={type}>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span>
                          {getResourceTypeIcon(type as ResourceTypeCategory)}
                        </span>
                        {getResourceTypeLabel(type as ResourceTypeCategory)}s
                        <Badge variant="secondary">
                          {typeResources.length}
                        </Badge>
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {typeResources.map((resource) => (
                          <Card key={resource.id} className="flex flex-col">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-lg">
                                  {resource.name}
                                </CardTitle>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant={
                                      resource.is_available
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={`text-xs ${
                                      resource.is_available
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    }`}
                                  >
                                    {resource.is_available
                                      ? "Disponible"
                                      : "Indisponible"}
                                  </Badge>
                                  {resource.requires_approval && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      <Clock className="mr-1 h-3 w-3" />
                                      Approbation
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {resource.description && (
                                <CardDescription className="line-clamp-2">
                                  {resource.description}
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent className="flex-1">
                              <div className="space-y-2 text-sm text-muted-foreground">
                                {(resource.building ||
                                  resource.floor ||
                                  resource.location) && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>
                                      {[
                                        resource.building,
                                        resource.floor,
                                        resource.location,
                                      ]
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
                                {resource.amenities &&
                                  resource.amenities.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {resource.amenities
                                        .slice(0, 3)
                                        .map((amenity, i) => (
                                          <Badge
                                            key={i}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {amenity}
                                          </Badge>
                                        ))}
                                      {resource.amenities.length > 3 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
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
                                disabled={!resource.is_available}
                              >
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                {resource.is_available
                                  ? "Reserver"
                                  : "Indisponible"}
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* My reservations tab                                          */}
          {/* ============================================================ */}
          <TabsContent value="reservations" className="space-y-4 mt-4">
            {reservationsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-1/3 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myReservations.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Aucune reservation"
                description="Vous n'avez aucune reservation en cours. Parcourez les ressources disponibles pour en creer une."
                actionLabel="Parcourir les ressources"
                onAction={() => setActiveTab("browse")}
              />
            ) : (
              <div className="space-y-3">
                {myReservations.map((reservation) => {
                  const resource = getResourceForReservation(
                    reservation.resource_id,
                  );
                  return (
                    <Card key={reservation.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {resource && (
                                <span>
                                  {getResourceTypeIcon(resource.resource_type)}
                                </span>
                              )}
                              <h3 className="font-medium">
                                {getResourceName(reservation.resource_id)}
                              </h3>
                              <Badge
                                className={`text-xs ${getReservationStatusColor(reservation.status)}`}
                              >
                                {getReservationStatusLabel(reservation.status)}
                              </Badge>
                            </div>
                            {resource?.location && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {[
                                  resource.building,
                                  resource.floor,
                                  resource.location,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                            {reservation.notes && (
                              <p className="text-sm text-muted-foreground">
                                {reservation.notes}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Cree le {formatDate(reservation.created_at)}
                            </p>
                            {reservation.rejection_reason && (
                              <p className="text-xs text-destructive">
                                Motif : {reservation.rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {(reservation.status === "pending" ||
                              reservation.status === "approved") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() =>
                                  handleCancelReservation(reservation.id)
                                }
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Annuler
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ============================================================ */}
        {/* Booking dialog                                               */}
        {/* ============================================================ */}
        <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reserver {selectedResource?.name}</DialogTitle>
              <DialogDescription>
                {selectedResource?.requires_approval
                  ? "Cette ressource necessite une approbation. Votre demande sera examinee par un administrateur."
                  : "Confirmez votre reservation pour cette ressource."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedResource && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span>
                      {getResourceTypeIcon(selectedResource.resource_type)}
                    </span>
                    {selectedResource.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedResource.description}
                  </div>
                  {(selectedResource.building || selectedResource.location) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {[
                        selectedResource.building,
                        selectedResource.floor,
                        selectedResource.location,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  {selectedResource.capacity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {selectedResource.capacity} personnes
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="booking-title">Titre *</Label>
                <Input
                  id="booking-title"
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                  placeholder="Titre de la reservation"
                />
              </div>
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
                    <Label htmlFor="booking-start">Heure de debut *</Label>
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
                  placeholder="Ajoutez des informations sur votre reservation..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                />
              </div>
              {selectedResource && (
                <div className="border-t pt-4">
                  <EntityLinks
                    entityType="resource"
                    entityId={selectedResource.id}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBookingOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
                {isSubmitting
                  ? "Reservation..."
                  : selectedResource?.requires_approval
                    ? "Demander"
                    : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
