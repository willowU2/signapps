'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LiveBinding {
  field: string;
  dataSource: string;
  value: string;
  status: 'synced' | 'syncing' | 'error';
}

interface DigitalTwinProps {
  documentName?: string;
  bindings?: LiveBinding[];
  lastSyncTime?: Date;
}

export function DigitalTwin({ documentName = 'Contract_2024.pdf', bindings, lastSyncTime }: DigitalTwinProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(lastSyncTime || new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const defaultBindings: LiveBinding[] = [
    {
      field: 'Contract Amount',
      dataSource: 'ERP System',
      value: '€150,000.00',
      status: 'synced',
    },
    {
      field: 'Effective Date',
      dataSource: 'Contract Database',
      value: '2024-01-15',
      status: 'synced',
    },
    {
      field: 'Currency',
      dataSource: 'Financial Configuration',
      value: 'EUR',
      status: 'synced',
    },
    {
      field: 'Payment Terms',
      dataSource: 'Supplier Master',
      value: 'Net 30',
      status: 'syncing',
    },
    {
      field: 'Tax Rate',
      dataSource: 'Tax Tables',
      value: '20%',
      status: 'synced',
    },
  ];

  const displayBindings = bindings || defaultBindings;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsSyncing(true);
    try {
      // Simulate sync delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setLastSync(new Date());
      setIsSyncing(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'bg-green-100 text-green-700';
      case 'syncing':
        return 'bg-blue-100 text-blue-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'synced':
        return '✓ Synced';
      case 'syncing':
        return '⟳ Syncing...';
      case 'error':
        return '✗ Error';
      default:
        return status;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins === 0) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Digital Twin
            </CardTitle>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </Button>
          </div>
          <p className="text-sm text-slate-600 mt-2">{documentName}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-600 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <Clock className="h-3.5 w-3.5" />
            <span>Last sync: {formatTime(lastSync)}</span>
          </div>

          <div className="space-y-3">
            {displayBindings.map((binding, index) => (
              <Card key={index} className="border-slate-200 bg-card">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{binding.field}</p>
                      <p className="text-xs text-slate-600 mt-1">From: {binding.dataSource}</p>
                    </div>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${getStatusColor(binding.status)}`}>
                      {getStatusLabel(binding.status)}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <p className="text-sm font-mono text-slate-700">{binding.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isSyncing && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">Synchronizing live bindings with data sources...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
