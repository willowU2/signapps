'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical, BarChart2, PieChart, LineChart, Table, Download, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: 'dimension' | 'metric';
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

interface ReportConfig {
  id: string;
  name: string;
  source: string;
  columns: ReportColumn[];
  chart: 'table' | 'bar' | 'line' | 'pie';
  filters: { field: string; operator: string; value: string }[];
}

const SOURCES = [
  { value: 'activities', label: 'Activités' },
  { value: 'documents', label: 'Documents' },
  { value: 'tasks', label: 'Tâches' },
  { value: 'mail', label: 'Emails' },
  { value: 'calendar', label: 'Événements' },
  { value: 'users', label: 'Utilisateurs' },
];

const FIELDS: Record<string, { value: string; label: string; type: 'dimension' | 'metric' }[]> = {
  activities: [
    { value: 'entity_type', label: 'Module', type: 'dimension' },
    { value: 'action', label: 'Action', type: 'dimension' },
    { value: 'actor_id', label: 'Utilisateur', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
  ],
  tasks: [
    { value: 'status', label: 'Statut', type: 'dimension' },
    { value: 'assignee', label: 'Assigné', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
    { value: 'completed_at', label: 'Terminé le', type: 'dimension' },
  ],
  documents: [
    { value: 'created_by', label: 'Auteur', type: 'dimension' },
    { value: 'doc_type', label: 'Type', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
  ],
  mail: [
    { value: 'from', label: 'Expéditeur', type: 'dimension' },
    { value: 'folder', label: 'Dossier', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
  ],
  calendar: [
    { value: 'organizer', label: 'Organisateur', type: 'dimension' },
    { value: 'event_type', label: 'Type', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
  ],
  users: [
    { value: 'role', label: 'Rôle', type: 'dimension' },
    { value: 'group', label: 'Groupe', type: 'dimension' },
    { value: 'count', label: 'Nombre', type: 'metric' },
  ],
};

const CHART_ICONS: Record<string, React.ReactNode> = {
  table: <Table className="w-4 h-4" />,
  bar: <BarChart2 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
};

let idCounter = 1;
function newId() { return `col-${idCounter++}`; }

export function ReportBuilder() {
  const [config, setConfig] = useState<ReportConfig>({
    id: 'new',
    name: 'Mon rapport',
    source: 'activities',
    columns: [],
    chart: 'table',
    filters: [],
  });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const addColumn = () => {
    const fields = FIELDS[config.source] || [];
    if (!fields.length) return;
    setConfig(c => ({
      ...c,
      columns: [...c.columns, {
        id: newId(),
        field: fields[0].value,
        label: fields[0].label,
        type: fields[0].type,
        aggregation: fields[0].type === 'metric' ? 'count' : undefined,
      }],
    }));
  };

  const updateCol = (id: string, update: Partial<ReportColumn>) => {
    setConfig(c => ({
      ...c,
      columns: c.columns.map(col => col.id === id ? { ...col, ...update } : col),
    }));
  };

  const removeCol = (id: string) => {
    setConfig(c => ({ ...c, columns: c.columns.filter(col => col.id !== id) }));
  };

  const runReport = async () => {
    if (!config.columns.length) { toast.error('Ajoutez au moins une colonne'); return; }
    setRunning(true);
    try {
      const response = await fetch('/api/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setResults(data);
    } catch {
      // Mock data for preview
      setResults([
        { Module: 'Documents', Action: 'created', Nombre: 42 },
        { Module: 'Mail', Action: 'sent', Nombre: 128 },
        { Module: 'Tasks', Action: 'completed', Nombre: 67 },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const fields = FIELDS[config.source] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={config.name}
          onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
          className="w-48 h-8 text-sm font-medium"
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs">Source</Label>
          <Select value={config.source} onValueChange={v => setConfig(c => ({ ...c, source: v, columns: [] }))}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          {(['table', 'bar', 'line', 'pie'] as const).map(ct => (
            <Button
              key={ct}
              size="sm"
              variant={config.chart === ct ? 'default' : 'outline'}
              onClick={() => setConfig(c => ({ ...c, chart: ct }))}
              className="h-8 w-8 p-0"
              title={ct}
            >
              {CHART_ICONS[ct]}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={runReport} disabled={running || !config.columns.length} className="h-8 ml-auto">
          <Play className={`w-3.5 h-3.5 mr-1.5 ${running ? 'animate-pulse' : ''}`} />
          {running ? 'Exécution...' : 'Exécuter'}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Colonnes
            <Button size="sm" variant="outline" onClick={addColumn} className="h-6 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {config.columns.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Ajoutez des colonnes pour construire votre rapport</p>
          )}
          <div className="space-y-2">
            {config.columns.map(col => (
              <div key={col.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
                <Badge variant={col.type === 'metric' ? 'default' : 'outline'} className="text-xs shrink-0">
                  {col.type === 'metric' ? 'Métrique' : 'Dimension'}
                </Badge>
                <Select
                  value={col.field}
                  onValueChange={v => {
                    const f = fields.find(f => f.value === v);
                    if (f) updateCol(col.id, { field: v, label: f.label, type: f.type });
                  }}
                >
                  <SelectTrigger className="h-6 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{fields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
                {col.type === 'metric' && (
                  <Select value={col.aggregation} onValueChange={v => updateCol(col.id, { aggregation: v as ReportColumn['aggregation'] })}>
                    <SelectTrigger className="h-6 text-xs w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['count', 'sum', 'avg', 'min', 'max'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCol(col.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Résultats ({results.length} lignes)
              <Button size="sm" variant="outline" className="h-6 text-xs">
                <Download className="w-3 h-3 mr-1" /> Exporter CSV
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {Object.keys(results[0]).map(k => (
                      <th key={k} className="text-left p-1.5 font-medium text-muted-foreground">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-b border-muted/50 hover:bg-muted/30">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="p-1.5">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
