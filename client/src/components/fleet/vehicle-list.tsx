'use client';

import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VehicleFormDialog } from './vehicle-form-dialog';

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  assignedDriver: string | null;
  status: 'Available' | 'Reserved' | 'Maintenance';
  nextServiceDate: string;
  kmCounter: number;
}

interface VehicleListProps {
  vehicles: Vehicle[];
  onAddVehicle?: (vehicle: Omit<Vehicle, 'id'>) => void;
}

export function VehicleList({ vehicles, onAddVehicle }: VehicleListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const getStatusColor = (status: Vehicle['status']) => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-100 text-emerald-800';
      case 'Reserved':
        return 'bg-blue-100 text-blue-800';
      case 'Maintenance':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-gray-800';
    }
  };

  const getStatusLabel = (status: Vehicle['status']) => {
    switch (status) {
      case 'Available':
        return 'Disponible';
      case 'Reserved':
        return 'Réservé';
      case 'Maintenance':
        return 'Maintenance';
      default:
        return status;
    }
  };

  const columns: ColumnDef<Vehicle>[] = useMemo(
    () => [
      {
        accessorKey: 'plateNumber',
        header: 'Plaque d\'immatriculation',
        cell: ({ row }) => (
          <div className="font-medium text-foreground">{row.original.plateNumber}</div>
        ),
      },
      {
        accessorKey: 'model',
        header: 'Modèle',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.model}</span>
        ),
      },
      {
        accessorKey: 'assignedDriver',
        header: 'Conducteur Assigné',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.assignedDriver || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => (
          <Badge className={getStatusColor(row.original.status)}>
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: 'nextServiceDate',
        header: 'Date Prochain Entretien',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.nextServiceDate}
          </span>
        ),
      },
      {
        accessorKey: 'kmCounter',
        header: 'Kilométrage',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.kmCounter.toLocaleString('fr-FR')} km
          </span>
        ),
      },
    ],
    []
  );

  const handleAddVehicle = (vehicleData: Omit<Vehicle, 'id'>) => {
    onAddVehicle?.(vehicleData);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Gestion de Flotte</h2>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Ajouter Véhicule
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={vehicles}
        searchKey="plateNumber"
        searchPlaceholder="Rechercher par plaque..."
      />

      <VehicleFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleAddVehicle}
      />
    </div>
  );
}
