'use client';

import { useCallback, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Monitor,
  Car,
  DoorOpen,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

interface Resource {
  id: string;
  name: string;
  type: 'room' | 'equipment' | 'vehicle';
  capacity?: number;
}

interface Reservation {
  id: string;
  resourceId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
  description: string;
  user: string;
}

// --- Constants ---

const RESOURCES: Resource[] = [
  { id: '1', name: 'Salle de réunion A', type: 'room', capacity: 10 },
  { id: '2', name: 'Salle de réunion B', type: 'room', capacity: 6 },
  { id: '3', name: 'Salle de conférence', type: 'room', capacity: 20 },
  { id: '4', name: 'Projecteur HD', type: 'equipment' },
  { id: '5', name: 'Caméra visioconférence', type: 'equipment' },
  { id: '6', name: 'Véhicule de service', type: 'vehicle' },
  { id: '7', name: 'Fourgonnette', type: 'vehicle' },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8h to 18h

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  room: <DoorOpen className="h-4 w-4" />,
  equipment: <Monitor className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  room: 'Salle',
  equipment: 'Équipement',
  vehicle: 'Véhicule',
};

const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: '1',
    resourceId: '1',
    date: getMonday(new Date()).toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    title: 'Réunion d\'équipe',
    description: 'Point hebdomadaire',
    user: 'Admin',
  },
  {
    id: '2',
    resourceId: '3',
    date: getWednesday(new Date()).toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '16:00',
    title: 'Présentation client',
    description: 'Démo du nouveau produit',
    user: 'Admin',
  },
  {
    id: '3',
    resourceId: '6',
    date: getThursday(new Date()).toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '12:00',
    title: 'Livraison matériel',
    description: 'Livraison chez le client XYZ',
    user: 'Admin',
  },
];

// --- Helpers ---

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function getWednesday(d: Date): Date {
  const monday = getMonday(d);
  monday.setDate(monday.getDate() + 2);
  return monday;
}

function getThursday(d: Date): Date {
  const monday = getMonday(d);
  monday.setDate(monday.getDate() + 3);
  return monday;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `${monday.toLocaleDateString('fr-FR', opts)} — ${sunday.toLocaleDateString('fr-FR', opts)} ${monday.getFullYear()}`;
}

// Color palette for resource backgrounds
const RESOURCE_COLORS: Record<string, string> = {
  '1': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  '2': 'bg-green-500/20 border-green-500/40 text-green-300',
  '3': 'bg-purple-500/20 border-purple-500/40 text-purple-300',
  '4': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  '5': 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  '6': 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  '7': 'bg-orange-500/20 border-orange-500/40 text-orange-300',
};

// --- Component ---

export default function SchedulingPage() {
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formResourceId, setFormResourceId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const filteredReservations = useMemo(() => {
    if (!selectedResource) return reservations;
    return reservations.filter((r) => r.resourceId === selectedResource);
  }, [reservations, selectedResource]);

  const goToPreviousWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const goToToday = () => {
    setWeekStart(getMonday(new Date()));
  };

  const resetForm = useCallback(() => {
    setFormResourceId('');
    setFormDate('');
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormTitle('');
    setFormDescription('');
    setEditingReservation(null);
  }, []);

  const openCreateDialog = (date?: string, hour?: number, resourceId?: string) => {
    resetForm();
    if (date) setFormDate(date);
    if (hour !== undefined) {
      setFormStartTime(`${String(hour).padStart(2, '0')}:00`);
      setFormEndTime(`${String(hour + 1).padStart(2, '0')}:00`);
    }
    if (resourceId) setFormResourceId(resourceId);
    setDialogOpen(true);
  };

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormResourceId(reservation.resourceId);
    setFormDate(reservation.date);
    setFormStartTime(reservation.startTime);
    setFormEndTime(reservation.endTime);
    setFormTitle(reservation.title);
    setFormDescription(reservation.description);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formResourceId || !formDate || !formTitle || !formStartTime || !formEndTime) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formStartTime >= formEndTime) {
      toast.error('L\'heure de fin doit être après l\'heure de début');
      return;
    }

    if (editingReservation) {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === editingReservation.id
            ? {
                ...r,
                resourceId: formResourceId,
                date: formDate,
                startTime: formStartTime,
                endTime: formEndTime,
                title: formTitle,
                description: formDescription,
              }
            : r
        )
      );
      toast.success('Réservation modifiée');
    } else {
      const newReservation: Reservation = {
        id: Date.now().toString(),
        resourceId: formResourceId,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        title: formTitle,
        description: formDescription,
        user: 'Admin',
      };
      setReservations((prev) => [...prev, newReservation]);
      toast.success('Réservation créée');
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
    toast.success('Réservation supprimée');
  };

  const getReservationsForCell = (date: string, hour: number) => {
    return filteredReservations.filter((r) => {
      if (r.date !== date) return false;
      const startHour = parseInt(r.startTime.split(':')[0], 10);
      const endHour = parseInt(r.endTime.split(':')[0], 10);
      return hour >= startHour && hour < endHour;
    });
  };

  const isFirstHourOfReservation = (reservation: Reservation, hour: number) => {
    return parseInt(reservation.startTime.split(':')[0], 10) === hour;
  };

  const getReservationSpan = (reservation: Reservation) => {
    const startHour = parseInt(reservation.startTime.split(':')[0], 10);
    const endHour = parseInt(reservation.endTime.split(':')[0], 10);
    return endHour - startHour;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const resourceName = (id: string) =>
    RESOURCES.find((r) => r.id === id)?.name || 'Inconnu';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Planification des ressources</h1>
            <p className="text-sm text-muted-foreground">
              {reservations.length} réservation{reservations.length > 1 ? 's' : ''} au total
            </p>
          </div>
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle réservation
          </Button>
        </div>

        <div className="flex gap-6">
          {/* Resource sidebar */}
          <Card className="w-64 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ressources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-1 px-4 pb-4">
                  <button
                    onClick={() => setSelectedResource(null)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      !selectedResource
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    Toutes les ressources
                  </button>
                  {Object.entries(
                    RESOURCES.reduce(
                      (acc, r) => {
                        if (!acc[r.type]) acc[r.type] = [];
                        acc[r.type].push(r);
                        return acc;
                      },
                      {} as Record<string, Resource[]>
                    )
                  ).map(([type, resources]) => (
                    <div key={type} className="pt-2">
                      <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {RESOURCE_ICONS[type]}
                        {RESOURCE_TYPE_LABELS[type]}
                      </div>
                      {resources.map((resource) => {
                        const count = reservations.filter(
                          (r) => r.resourceId === resource.id
                        ).length;
                        return (
                          <button
                            key={resource.id}
                            onClick={() =>
                              setSelectedResource(
                                selectedResource === resource.id ? null : resource.id
                              )
                            }
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                              selectedResource === resource.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <span className="truncate">{resource.name}</span>
                            <div className="flex items-center gap-1.5">
                              {resource.capacity && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {resource.capacity}p
                                </Badge>
                              )}
                              {count > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {count}
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            {/* Week navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Aujourd&apos;hui
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-lg font-semibold">{getWeekLabel(weekStart)}</h2>
            </div>

            {/* Grid */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-18rem)]">
                  <div className="min-w-[800px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
                      <div className="p-2 text-xs text-muted-foreground border-r flex items-center justify-center">
                        <Clock className="h-3 w-3" />
                      </div>
                      {weekDays.map((day) => (
                        <div
                          key={formatDate(day)}
                          className={`p-2 text-center text-sm font-medium border-r last:border-r-0 ${
                            isToday(day)
                              ? 'bg-primary/10 text-primary'
                              : ''
                          }`}
                        >
                          {formatDateDisplay(day)}
                        </div>
                      ))}
                    </div>

                    {/* Time rows */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0"
                      >
                        <div className="p-2 text-xs text-muted-foreground border-r text-center font-mono">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        {weekDays.map((day) => {
                          const dateStr = formatDate(day);
                          const cellReservations = getReservationsForCell(dateStr, hour);

                          return (
                            <div
                              key={`${dateStr}-${hour}`}
                              className={`relative min-h-[48px] border-r last:border-r-0 cursor-pointer transition-colors hover:bg-muted/50 ${
                                isToday(day) ? 'bg-primary/5' : ''
                              }`}
                              onClick={() => {
                                if (cellReservations.length === 0) {
                                  openCreateDialog(
                                    dateStr,
                                    hour,
                                    selectedResource || undefined
                                  );
                                }
                              }}
                            >
                              {cellReservations.map((reservation) => {
                                if (!isFirstHourOfReservation(reservation, hour)) return null;
                                const span = getReservationSpan(reservation);
                                const colorClass =
                                  RESOURCE_COLORS[reservation.resourceId] ||
                                  'bg-primary/20 border-primary/40 text-primary';
                                return (
                                  <div
                                    key={reservation.id}
                                    className={`absolute inset-x-1 rounded-md border px-2 py-1 text-xs cursor-pointer z-10 overflow-hidden ${colorClass}`}
                                    style={{
                                      top: '2px',
                                      height: `calc(${span * 48}px - 4px)`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(reservation);
                                    }}
                                  >
                                    <div className="font-medium truncate">
                                      {reservation.title}
                                    </div>
                                    {span > 1 && (
                                      <div className="truncate opacity-80">
                                        {resourceName(reservation.resourceId)}
                                      </div>
                                    )}
                                    <div className="truncate opacity-60">
                                      {reservation.startTime} - {reservation.endTime}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create / Edit Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReservation ? 'Modifier la réservation' : 'Nouvelle réservation'}
            </DialogTitle>
            <DialogDescription>
              {editingReservation
                ? 'Modifiez les détails de la réservation'
                : 'Remplissez les informations pour réserver une ressource'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="res-resource">Ressource *</Label>
              <Select value={formResourceId} onValueChange={setFormResourceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner une ressource" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCES.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name}
                      {resource.capacity && ` (${resource.capacity} pers.)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="res-title">Titre *</Label>
              <Input
                id="res-title"
                placeholder="Ex: Réunion d'équipe"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="res-date">Date *</Label>
              <Input
                id="res-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="res-start">Début *</Label>
                <Select value={formStartTime} onValueChange={setFormStartTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={`${String(h).padStart(2, '0')}:00`}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-end">Fin *</Label>
                <Select value={formEndTime} onValueChange={setFormEndTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={`${String(h).padStart(2, '0')}:00`}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                    <SelectItem value="19:00">19:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="res-desc">Description</Label>
              <Input
                id="res-desc"
                placeholder="Détails supplémentaires..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            {editingReservation && (
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirmId(editingReservation.id)}
                className="mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>
              {editingReservation ? (
                <>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Modifier
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. La réservation sera définitivement supprimée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                  setDialogOpen(false);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
