'use client';

import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export interface Followup {
  id: string;
  clientName: string;
  quoteRef: string;
  createdAt: string;
  nextActionDate: string;
  status: 'pending' | 'completed' | 'overdue';
  daysSinceCreation: number;
  ruleApplied: 'J+3' | 'J+7' | 'J+14';
}

export interface FollowupManagerProps {
  followups: Followup[];
  onMarkDone: (id: string) => Promise<void>;
}

const FOLLOWUP_RULES = [
  { label: 'J+3', days: 3 },
  { label: 'J+7', days: 7 },
  { label: 'J+14', days: 14 },
];

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'En Attente' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800', label: 'Complété' },
  overdue: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'En Retard' },
};

export function FollowupManager({ followups, onMarkDone }: FollowupManagerProps) {
  const [markingDone, setMarkingDone] = useState<string | null>(null);

  const handleMarkDone = async (id: string) => {
    setMarkingDone(id);
    try {
      await onMarkDone(id);
    } finally {
      setMarkingDone(null);
    }
  };

  const columns: ColumnDef<Followup>[] = useMemo(
    () => [
      {
        accessorKey: 'clientName',
        header: 'Client',
        cell: ({ row }) => <div className="font-medium">{row.original.clientName}</div>,
      },
      {
        accessorKey: 'quoteRef',
        header: 'Ref. Devis',
        cell: ({ row }) => <span className="font-mono text-sm text-muted-foreground">{row.original.quoteRef}</span>,
      },
      {
        accessorKey: 'daysSinceCreation',
        header: 'J+N',
        cell: ({ row }) => <span className="rounded-full bg-muted px-2 py-1 text-sm">{`J+${row.original.daysSinceCreation}`}</span>,
      },
      {
        accessorKey: 'nextActionDate',
        header: 'Prochaine Action',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{format(parseISO(row.original.nextActionDate), 'd MMM yyyy', { locale: fr })}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => {
          const config = STATUS_CONFIG[row.original.status];
          const Icon = config.icon;
          return (
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <Badge className={config.color}>{config.label}</Badge>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (row.original.status === 'completed') {
            return <span className="text-xs text-muted-foreground">Complété</span>;
          }
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={markingDone === row.original.id}>
                  {markingDone === row.original.id ? 'En cours...' : 'Marquer fait'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Marquer comme complété</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir marquer le suivi de <span className="font-medium">{row.original.clientName}</span> ({row.original.quoteRef}) comme complété ?
                </AlertDialogDescription>
                <div className="flex justify-end gap-3">
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleMarkDone(row.original.id)} className="bg-emerald-600 hover:bg-emerald-700">
                    Confirmer
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
      },
    ],
    [markingDone]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h3 className="font-medium text-blue-900 mb-2">Règles de suivi automatique</h3>
        <div className="flex flex-wrap gap-3">
          {FOLLOWUP_RULES.map(rule => (
            <div key={rule.label} className="flex items-center gap-2 text-sm text-blue-800">
              <span className="font-semibold">{rule.label}</span>
              <span className="text-blue-600">→</span>
              <span>{rule.days} jour{rule.days > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={followups} searchKey="clientName" searchPlaceholder="Rechercher un client..." />
    </div>
  );
}
