"use client";

/**
 * ResourcesView Component
 *
 * Main view for resource management and booking.
 * Shows resource list with filtering and booking calendar.
 */

import * as React from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Building2,
  Monitor,
  Car,
  Box,
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResourceCard,
  ResourceCardCompact,
} from "@/components/scheduling/resources/ResourceCard";
import { BookingSheet } from "@/components/scheduling/resources/BookingSheet";
import { FloorPlan } from "./FloorPlan";
import {
  useResources,
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useFloorPlans,
} from "@/lib/scheduling/api/resources";
import type { Resource, Booking } from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface ResourcesViewProps {
  className?: string;
}

type ViewMode = "grid" | "list" | "calendar" | "floorplan";
type ResourceType = Resource["type"];

// ============================================================================
// Resource Type Filter
// ============================================================================

const resourceTypes: {
  value: ResourceType;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "room", label: "Salles", icon: Building2 },
  { value: "equipment", label: "Équipements", icon: Monitor },
  { value: "vehicle", label: "Véhicules", icon: Car },
  { value: "other", label: "Autres", icon: Box },
];

// ============================================================================
// Resource Calendar
// ============================================================================

function ResourceCalendar({
  resources,
  bookings,
  currentDate,
  onDateChange,
  onBookingClick,
  onSlotClick,
}: {
  resources: Resource[];
  bookings: Booking[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (resource: Resource, date: Date) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    onDateChange(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    onDateChange(newDate);
  };

  const getBookingsForResourceAndDay = (resourceId: string, day: Date) => {
    return bookings.filter(
      (b) => b.resourceId === resourceId && isSameDay(new Date(b.start), day),
    );
  };

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousWeek}
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {format(weekStart, "d MMM", { locale: fr })} -{" "}
          {format(weekEnd, "d MMM yyyy", { locale: fr })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextWeek}
          aria-label="Suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-background z-10">
            <tr>
              <th className="w-40 p-2 text-left text-sm font-medium border-b border-r">
                Ressource
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className={cn(
                    "p-2 text-center text-sm font-medium border-b min-w-[120px]",
                    isSameDay(day, new Date()) && "bg-primary/5",
                  )}
                >
                  <div>{format(day, "EEE", { locale: fr })}</div>
                  <div
                    className={cn(
                      "text-lg",
                      isSameDay(day, new Date()) &&
                        "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource.id} className="hover:bg-muted/30">
                <td className="p-2 border-b border-r">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {resource.name}
                    </span>
                  </div>
                </td>
                {days.map((day) => {
                  const dayBookings = getBookingsForResourceAndDay(
                    resource.id,
                    day,
                  );
                  return (
                    <td
                      key={day.toISOString()}
                      className={cn(
                        "p-1 border-b min-h-[60px] align-top cursor-pointer hover:bg-muted/50",
                        isSameDay(day, new Date()) && "bg-primary/5",
                      )}
                      onClick={() => onSlotClick(resource, day)}
                    >
                      <div className="space-y-1">
                        {dayBookings.map((booking) => (
                          <div
                            key={booking.id}
                            className="text-xs p-1 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookingClick(booking);
                            }}
                          >
                            <div className="font-medium truncate">
                              {booking.title}
                            </div>
                            <div className="text-muted-foreground">
                              {format(new Date(booking.start), "HH:mm")} -{" "}
                              {booking.end &&
                                format(new Date(booking.end), "HH:mm")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourcesView({ className }: ResourcesViewProps) {
  // State
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [search, setSearch] = React.useState("");
  const [selectedTypes, setSelectedTypes] = React.useState<ResourceType[]>([]);
  const [showOnlyAvailable, setShowOnlyAvailable] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isBookingSheetOpen, setIsBookingSheetOpen] = React.useState(false);
  const [selectedResource, setSelectedResource] =
    React.useState<Resource | null>(null);
  const [editingBooking, setEditingBooking] = React.useState<Booking | null>(
    null,
  );
  const [bookingDate, setBookingDate] = React.useState<Date | null>(null);

  // Data
  const { data: resources = [], isLoading: resourcesLoading } = useResources();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: floorPlans = [], isLoading: floorPlansLoading } =
    useFloorPlans();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  // Filter resources
  const filteredResources = React.useMemo(() => {
    return resources.filter((r) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(searchLower) &&
          !r.location?.toLowerCase().includes(searchLower) &&
          !r.description?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.type)) {
        return false;
      }

      // Availability filter
      if (showOnlyAvailable && !r.available) {
        return false;
      }

      return true;
    });
  }, [resources, search, selectedTypes, showOnlyAvailable]);

  // Handlers
  const handleBook = (resource: Resource) => {
    setSelectedResource(resource);
    setEditingBooking(null);
    setBookingDate(null);
    setIsBookingSheetOpen(true);
  };

  const handleViewSchedule = (resource: Resource) => {
    setSelectedResource(resource);
    setViewMode("calendar");
  };

  const handleBookingClick = (booking: Booking) => {
    setEditingBooking(booking);
    setSelectedResource(null);
    setIsBookingSheetOpen(true);
  };

  const handleSlotClick = (resource: Resource, date: Date) => {
    setSelectedResource(resource);
    setEditingBooking(null);
    setBookingDate(date);
    setIsBookingSheetOpen(true);
  };

  const handleFloorPlanBook = (
    resourceId: string,
    slot: { start: Date; end: Date },
  ) => {
    const resource = resources.find((r) => r.id === resourceId);
    if (resource) {
      setSelectedResource(resource);
      setEditingBooking(null);
      setBookingDate(slot.start);
      setIsBookingSheetOpen(true);
    }
  };

  const handleSaveBooking = (data: Partial<Booking>) => {
    if (editingBooking) {
      updateBooking.mutate({ id: editingBooking.id, updates: data });
    } else {
      createBooking.mutate({
        type: "booking",
        allDay: false,
        start: data.start ?? new Date(),
        organizerId: "current-user",
        ...data,
      } as Omit<Booking, "id" | "createdAt" | "updatedAt">);
    }
    setIsBookingSheetOpen(false);
    setSelectedResource(null);
    setEditingBooking(null);
    setBookingDate(null);
  };

  const handleDeleteBooking = () => {
    if (editingBooking) {
      deleteBooking.mutate(editingBooking.id);
      setIsBookingSheetOpen(false);
      setEditingBooking(null);
    }
  };

  const isLoading = resourcesLoading || bookingsLoading || floorPlansLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">
          Chargement des ressources...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une ressource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Type
              {selectedTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTypes.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Type de ressource</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {resourceTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type.value}
                checked={selectedTypes.includes(type.value)}
                onCheckedChange={(checked) => {
                  setSelectedTypes(
                    checked
                      ? [...selectedTypes, type.value]
                      : selectedTypes.filter((t) => t !== type.value),
                  );
                }}
              >
                <type.icon className="h-4 w-4 mr-2" />
                {type.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={showOnlyAvailable}
              onCheckedChange={setShowOnlyAvailable}
            >
              Uniquement disponibles
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Mode */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <Building2 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="floorplan">
              <Map className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* New Booking */}
        <Button size="sm" onClick={() => setIsBookingSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Réserver
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {viewMode === "grid" && (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isAvailable={resource.available}
                  onBook={handleBook}
                  onViewSchedule={handleViewSchedule}
                />
              ))}
              {filteredResources.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  Aucune ressource trouvée
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {viewMode === "list" && (
          <ScrollArea className="h-full">
            <div className="space-y-2 max-w-2xl">
              {filteredResources.map((resource) => (
                <ResourceCardCompact
                  key={resource.id}
                  resource={resource}
                  isAvailable={resource.available}
                  onBook={handleBook}
                />
              ))}
              {filteredResources.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Aucune ressource trouvée
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {viewMode === "calendar" && (
          <ResourceCalendar
            resources={filteredResources}
            bookings={bookings}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onBookingClick={handleBookingClick}
            onSlotClick={handleSlotClick}
          />
        )}

        {viewMode === "floorplan" && (
          <div className="h-full border rounded-lg overflow-hidden bg-background">
            {floorPlans.length > 0 ? (
              <FloorPlan
                floorPlan={floorPlans[0]}
                resources={filteredResources}
                bookings={bookings}
                currentTime={currentDate}
                onResourceBook={handleFloorPlanBook}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun plan au sol configuré.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Sheet */}
      <BookingSheet
        isOpen={isBookingSheetOpen}
        onClose={() => {
          setIsBookingSheetOpen(false);
          setSelectedResource(null);
          setEditingBooking(null);
          setBookingDate(null);
        }}
        resource={selectedResource}
        booking={editingBooking}
        availableResources={resources}
        onSave={handleSaveBooking}
        onDelete={editingBooking ? handleDeleteBooking : undefined}
      />
    </div>
  );
}

export default ResourcesView;
