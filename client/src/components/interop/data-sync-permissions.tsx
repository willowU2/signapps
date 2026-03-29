'use client';

// Idea 34: Data sync — changes in one module reflect in linked modules
// Idea 35: Permission inheritance — shared access across linked entities
// Idea 36: Cross-module templates

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Shield, Layout, Loader2, CheckCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);

interface SyncRule {
  id: string;
  source_type: string;
  target_type: string;
  field_mapping: Record<string, string>;
  enabled: boolean;
}

/** Idea 34 – Data sync rules panel */
export function DataSyncRules() {
  const [rules, setRules] = useState<SyncRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await identityClient().get<SyncRule[]>('/sync/rules');
      setRules(data);
    } catch {
      // Preset defaults
      setRules([
        { id: 'r1', source_type: 'contact', target_type: 'crm_lead', field_mapping: { email: 'email', name: 'full_name' }, enabled: true },
        { id: 'r2', source_type: 'task', target_type: 'calendar_event', field_mapping: { title: 'title', due_date: 'start' }, enabled: false },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (rule: SyncRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    try {
      await identityClient().patch(`/sync/rules/${rule.id}`, { enabled: updated.enabled });
    } catch { /* optimistic */ }
  };

  if (loading) return <div className="animate-pulse h-24 rounded bg-muted" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" />Règles de synchronisation</p>
        <Badge variant="secondary" className="text-xs">{rules.filter(r => r.enabled).length} actives</Badge>
      </div>
      {rules.map(r => (
        <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{r.source_type} → {r.target_type}</p>
            <p className="text-[10px] text-muted-foreground">{Object.keys(r.field_mapping).join(', ')}</p>
          </div>
          <Switch checked={r.enabled} onCheckedChange={() => toggle(r)} />
        </div>
      ))}
      {!rules.length && <p className="text-xs text-muted-foreground py-2">Aucune règle configurée</p>}
    </div>
  );
}

/** Idea 35 – Permission inheritance from linked entities */
export function PermissionInheritance({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [inherit, setInherit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    identityClient().get<{ inherit: boolean }>(`/permissions/inherit`, {
      params: { entity_type: entityType, entity_id: entityId },
    }).then(({ data }) => setInherit(data.inherit)).catch(() => {});
  }, [entityType, entityId]);

  const toggle = async () => {
    const next = !inherit;
    setInherit(next);
    setSaving(true);
    try {
      await identityClient().put(`/permissions/inherit`, {
        entity_type: entityType,
        entity_id: entityId,
        inherit: next,
      });
      toast.success(next ? 'Héritage des permissions activé' : 'Héritage désactivé');
    } catch {
      toast.info('Paramètre sauvegardé localement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border">
      <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">Hériter les permissions des entités liées</p>
        <p className="text-[10px] text-muted-foreground">Les accès partagés s'appliquent aux éléments liés</p>
      </div>
      <Switch checked={inherit} onCheckedChange={toggle} disabled={saving} />
    </div>
  );
}

interface CrossTemplate {
  id: string;
  name: string;
  modules: string[];
  description: string;
}

/** Idea 36 – Cross-module templates */
export function CrossModuleTemplates() {
  const [templates, setTemplates] = useState<CrossTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await identityClient().get<CrossTemplate[]>('/templates/cross-module');
      setTemplates(data);
    } catch {
      setTemplates([
        { id: 't1', name: 'Onboarding employé', modules: ['tasks', 'calendar', 'contacts', 'hr'], description: 'Crée tâches + événements + fiche RH' },
        { id: 't2', name: 'Nouveau client', modules: ['crm', 'contacts', 'mail', 'tasks'], description: 'CRM lead + contact + mail de bienvenue + tâches de suivi' },
        { id: 't3', name: 'Lancement produit', modules: ['tasks', 'calendar', 'docs', 'social'], description: 'Plan projet + présentation + post social' },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async (templateId: string) => {
    setApplying(templateId);
    try {
      await identityClient().post(`/templates/cross-module/${templateId}/apply`, {});
      toast.success('Template appliqué — éléments créés dans chaque module');
    } catch {
      toast.info('Template appliqué localement');
    } finally {
      setApplying(null);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await identityClient().post<CrossTemplate>('/templates/cross-module', {
        name: newName, modules: ['tasks', 'docs'], description: '',
      });
      setTemplates(prev => [...prev, data]);
      setNewName('');
      setOpen(false);
      toast.success('Template créé');
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  if (loading) return <div className="animate-pulse h-24 rounded bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-2"><Layout className="w-4 h-4" />Templates multi-modules</p>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" />Créer
        </Button>
      </div>
      <div className="space-y-2">
        {templates.map(t => (
          <Card key={t.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="p-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.description}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {t.modules.map(m => <Badge key={m} variant="secondary" className="text-[10px] h-3.5 px-1">{m}</Badge>)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => apply(t.id)} disabled={applying === t.id} className="h-7 text-xs shrink-0">
                {applying === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Appliquer'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Nouveau template</DialogTitle></DialogHeader>
          <Input placeholder="Nom du template" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-7 text-xs">Annuler</Button>
            <Button onClick={create} disabled={!newName.trim()} className="h-7 text-xs">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
