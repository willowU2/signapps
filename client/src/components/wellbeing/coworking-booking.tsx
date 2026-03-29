'use client';

/**
 * Coworking Booking Component
 *
 * Displays coworking space cards with name, address, and price.
 * Includes date picker and book button for reservations.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MapPin, Euro, Calendar, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface CoworkingSpace {
  id: string;
  name: string;
  address: string;
  city: string;
  pricePerDay: number;
  availableSeats: number;
  amenities: string[];
  image?: string;
}

export interface CoworkingBookingProps {
  spaces: CoworkingSpace[];
  onBook?: (spaceId: string, date: string) => void;
}

function CoworkingSpaceCard({
  space,
  onBookClick,
}: {
  space: CoworkingSpace;
  onBookClick: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {space.image && (
        <div className="h-40 bg-gradient-to-br from-blue-400 to-purple-500 overflow-hidden">
          <img
            src={space.image}
            alt={space.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">{space.name}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-4 h-4" />
              {space.address}, {space.city}
            </div>
          </div>
          <Badge variant="outline" className="whitespace-nowrap">
            {space.availableSeats} places
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Euro className="w-4 h-4 text-green-600" />
            {space.pricePerDay.toFixed(2)}€/jour
          </div>
          <div className="flex flex-wrap gap-1">
            {space.amenities.slice(0, 3).map((amenity, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {space.amenities.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{space.amenities.length - 3}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={onBookClick} className="w-full gap-2">
          <Calendar className="w-4 h-4" />
          Réserver
        </Button>
      </CardContent>
    </Card>
  );
}

function BookingDialog({
  space,
  open,
  onOpenChange,
  onConfirm,
}: {
  space: CoworkingSpace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (spaceId: string, date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = React.useState('');
  const today = new Date().toISOString().split('T')[0];

  const handleConfirm = () => {
    if (!selectedDate) {
      toast.error('Veuillez sélectionner une date');
      return;
    }
    if (space) {
      onConfirm(space.id, selectedDate);
      setSelectedDate('');
      onOpenChange(false);
    }
  };

  if (!space) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réserver un Space</DialogTitle>
          <DialogDescription>
            Réservation pour {space.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Lieu</p>
            <div className="bg-muted p-3 rounded-lg border">
              <p className="font-medium">{space.name}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                {space.address}, {space.city}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Date de réservation</p>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={today}
              className="w-full"
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Prix</p>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-lg font-bold text-green-700">
                {space.pricePerDay.toFixed(2)}€
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} className="gap-2">
            <Check className="w-4 h-4" />
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CoworkingBooking({
  spaces,
  onBook,
}: CoworkingBookingProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedSpace, setSelectedSpace] = React.useState<CoworkingSpace | null>(null);

  const handleBookClick = (space: CoworkingSpace) => {
    setSelectedSpace(space);
    setDialogOpen(true);
  };

  const handleConfirm = (spaceId: string, date: string) => {
    onBook?.(spaceId, date);
    toast.success('Réservation confirmée');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Réservation Coworking</h2>
      </div>

      <BookingDialog
        space={selectedSpace}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirm}
      />

      {spaces.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
            Aucun espace coworking disponible
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <CoworkingSpaceCard
              key={space.id}
              space={space}
              onBookClick={() => handleBookClick(space)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
