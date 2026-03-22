'use client';

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

export interface Contract {
  id: string;
  name: string;
  type: 'Fournisseur' | 'Client' | 'Employe';
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring' | 'Expired';
}

interface ContractListProps {
  contracts: Contract[];
}

export function ContractList({ contracts }: ContractListProps) {
  const getTypeColor = (type: Contract['type']) => {
    switch (type) {
      case 'Fournisseur':
        return 'bg-blue-100 text-blue-800';
      case 'Client':
        return 'bg-green-100 text-green-800';
      case 'Employe':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-100 text-emerald-800';
      case 'Expiring':
        return 'bg-yellow-100 text-yellow-800';
      case 'Expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const columns: ColumnDef<Contract>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Nom du Contrat',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900">{row.original.name}</div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge className={getTypeColor(row.original.type)}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'startDate',
        header: 'Date de Démarrage',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {format(parseISO(row.original.startDate), 'd MMM yyyy', { locale: fr })}
          </span>
        ),
      },
      {
        accessorKey: 'endDate',
        header: 'Date de Fin',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {format(parseISO(row.original.endDate), 'd MMM yyyy', { locale: fr })}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => (
          <Badge className={getStatusColor(row.original.status)}>
            {row.original.status === 'Active'
              ? 'Actif'
              : row.original.status === 'Expiring'
                ? 'Expirant'
                : 'Expiré'}
          </Badge>
        ),
      },
      {
        id: 'renewal',
        header: 'Alerte',
        cell: ({ row }) => {
          const daysUntilExpiry = differenceInDays(
            parseISO(row.original.endDate),
            new Date()
          );
          return daysUntilExpiry < 90 && daysUntilExpiry > 0 ? (
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{daysUntilExpiry} jours</span>
            </div>
          ) : null;
        },
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={contracts}
      searchKey="name"
      searchPlaceholder="Rechercher un contrat..."
    />
  );
}
