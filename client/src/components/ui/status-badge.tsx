'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type StatusValue = 'actif' | 'en_attente' | 'erreur' | 'inactif' | 'active' | 'inactive' | 'pending' | 'error' | 'enabled' | 'disabled' | boolean;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  actif:      { label: 'Actif',       className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
  active:     { label: 'Actif',       className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
  enabled:    { label: 'Actif',       className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
  en_attente: { label: 'En attente',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  pending:    { label: 'En attente',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  erreur:     { label: 'Erreur',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  error:      { label: 'Erreur',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  inactif:    { label: 'Inactif',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  inactive:   { label: 'Inactif',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  disabled:   { label: 'Inactif',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
};

interface StatusBadgeProps {
  status: StatusValue;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = typeof status === 'boolean'
    ? (status ? 'active' : 'inactive')
    : String(status).toLowerCase().replace(/\s+/g, '_');

  const config = STATUS_CONFIG[key] ?? {
    label: String(status),
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  };

  return (
    <Badge
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border font-medium',
        config.className,
        className
      )}
    >
      {label ?? config.label}
    </Badge>
  );
}
