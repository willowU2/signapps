'use client';

// Feature 30: Visual workflow builder (trigger → conditions → actions)
// Feature 24: Conditional branching
// Feature 27: Schedule recurring automations

import { useState } from 'react';
import { Plus, Trash2, Zap, GitBranch, Clock, Play, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useWorkflowAutomations, type TriggerType, type ActionType } from '@/hooks/use-workflow-automations';
import { toast } from 'sonner';

const TRIGGERS: { value: TriggerType; label: string; icon: string }[] = [
  { value: 'email_received', label: 'Email reçu', icon: '📧' },
  { value: 'deal_won', label: 'Deal gagné', icon: '🏆' },
  { value: 'form_submitted', label: 'Formulaire soumis', icon: '📋' },
  { value: 'task_overdue', label: 'Tâche en retard', icon: '⏰' },
  { value: 'calendar_event', label: 'Événement calendrier', icon: '📅' },
  { value: 'file_uploaded', label: 'Fichier uploadé', icon: '📁' },
  { value: 'approval_requested', label: 'Approbation demandée', icon: '✅' },
  { value: 'schedule', label: 'Planification récurrente', icon: '🔄' },
  { value: 'manual', label: 'Déclenchement manuel', icon: '▶️' },
];

const ACTIONS: { value: ActionType; label: string; icon: string }[] = [
  { value: 'create_task', label: 'Créer une tâche', icon: '✓' },
  { value: 'create_invoice', label: 'Créer une facture', icon: '💰' },
  { value: 'create_contact', label: 'Créer un contact', icon: '👤' },
  { value: 'send_email', label: 'Envoyer un email', icon: '📤' },
  { value: 'create_doc', label: 'Créer un document', icon: '📄' },
  { value: 'auto_tag', label: 'Auto-tagger', icon: '🏷️' },
  { value: 'notify', label: 'Envoyer notification', icon: '🔔' },
];

const CRON_PRESETS = [
  { label: 'Tous les jours à 9h', value: '0 9 * * *' },
  { label: 'Chaque lundi', value: '0 9 * * 1' },
  { label: 'Premier du mois', value: '0 9 1 * *' },
  { label: 'Toutes les heures', value: '0 * * * *' },
];

type BuilderStep = 'trigger' | 'conditions' | 'actions' | 'settings';

export function WorkflowBuilder({ onSave }: { onSave?: (id: string) => void }) {
  const { add } = useWorkflowAutomations();
  const [step, setStep] = useState<BuilderStep>('trigger');
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('email_received');
  const [schedule, setSchedule] = useState('');
  const [conditions, setConditions] = useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [actions, setActions] = useState<Array<{ type: ActionType; params: Record<string, string> }>>([]);
  const [branchCondition, setBranchCondition] = useState({ field: '', operator: 'gt', value: '' });
  const [hasBranch, setHasBranch] = useState(false);

  const steps: { key: BuilderStep; label: string }[] = [
    { key: 'trigger', label: 'Déclencheur' },
    { key: 'conditions', label: 'Conditions' },
    { key: 'actions', label: 'Actions' },
    { key: 'settings', label: 'Paramètres' },
  ];

  const addCondition = () =>
    setConditions(c => [...c, { field: '', operator: 'contains', value: '' }]);

  const updateCondition = (i: number, patch: Partial<typeof conditions[0]>) =>
    setConditions(c => c.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const removeCondition = (i: number) =>
    setConditions(c => c.filter((_, idx) => idx !== i));

  const addAction = () =>
    setActions(a => [...a, { type: 'send_email', params: {} }]);

  const updateAction = (i: number, type: ActionType) =>
    setActions(a => a.map((x, idx) => idx === i ? { ...x, type } : x));

  const removeAction = (i: number) =>
    setActions(a => a.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!name.trim()) { toast.error('Donnez un nom au workflow'); return; }
    if (actions.length === 0) { toast.error('Ajoutez au moins une action'); return; }
    const id = add({
      name: name.trim(),
      enabled: false,
      trigger: { type: triggerType, config: triggerType === 'schedule' ? { cron: schedule } : {} },
      conditions: hasBranch
        ? [{ field: branchCondition.field, operator: branchCondition.operator as any, value: branchCondition.value }]
        : conditions.map(c => ({ field: c.field, operator: c.operator as any, value: c.value })),
      actions: actions.map((a, i) => ({ id: `a_${i}`, type: a.type, params: a.params })),
      ...(triggerType === 'schedule' ? { schedule } : {}),
    });
    toast.success('Workflow créé !');
    onSave?.(id!);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Step nav */}
      <div className="flex gap-1 border-b pb-3">
        {steps.map((s, i) => (
          <Button
            key={s.key}
            variant={step === s.key ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setStep(s.key)}
          >
            <span className="w-4 h-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
            {s.label}
          </Button>
        ))}
      </div>

      {/* TRIGGER STEP */}
      {step === 'trigger' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-500" />
              Choisir le déclencheur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {TRIGGERS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTriggerType(t.value)}
                  className={`p-2.5 rounded-lg border text-left transition-all hover:border-primary ${triggerType === t.value ? 'border-primary bg-primary/5' : ''}`}
                >
                  <span className="text-lg block mb-1">{t.icon}</span>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            {triggerType === 'schedule' && (
              <div>
                <Label className="text-xs">Expression cron</Label>
                <div className="flex gap-1 flex-wrap mt-1 mb-1">
                  {CRON_PRESETS.map(p => (
                    <Button key={p.value} variant="outline" size="sm" className="h-6 text-xs" onClick={() => setSchedule(p.value)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                <Input value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="0 9 * * 1" className="font-mono text-sm" />
              </div>
            )}
            <Button onClick={() => setStep('conditions')} size="sm" className="w-full">Suivant →</Button>
          </CardContent>
        </Card>
      )}

      {/* CONDITIONS STEP */}
      {step === 'conditions' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-blue-500" />
              Conditions (optionnel)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={hasBranch} onCheckedChange={setHasBranch} id="branch-toggle" />
              <Label htmlFor="branch-toggle" className="text-sm cursor-pointer">
                Branchement conditionnel (si montant &gt; X → approuver sinon rejeter)
              </Label>
            </div>

            {hasBranch ? (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium">Condition de branchement</p>
                <div className="flex gap-2">
                  <Input placeholder="Champ (ex: amount)" value={branchCondition.field} onChange={e => setBranchCondition(b => ({ ...b, field: e.target.value }))} className="h-7 text-xs" />
                  <Select value={branchCondition.operator} onValueChange={v => setBranchCondition(b => ({ ...b, operator: v }))}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['gt', 'lt', 'eq', 'contains'].map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Valeur" value={branchCondition.value} onChange={e => setBranchCondition(b => ({ ...b, value: e.target.value }))} className="h-7 text-xs" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="Champ" value={c.field} onChange={e => updateCondition(i, { field: e.target.value })} className="h-7 text-xs" />
                    <Select value={c.operator} onValueChange={v => updateCondition(i, { operator: v })}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['contains', 'eq', 'gt', 'lt'].map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Valeur" value={c.value} onChange={e => updateCondition(i, { value: e.target.value })} className="h-7 text-xs" />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeCondition(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCondition}>
                  <Plus className="w-3 h-3" />Ajouter condition
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('trigger')}>← Retour</Button>
              <Button size="sm" className="flex-1" onClick={() => setStep('actions')}>Suivant →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACTIONS STEP */}
      {step === 'actions' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Play className="w-4 h-4 text-green-500" />
              Actions à exécuter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Ajoutez au moins une action</p>
            )}
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center p-2 border rounded-lg">
                  <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}.</span>
                  <Select value={a.type} onValueChange={v => updateAction(i, v as ActionType)}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map(act => (
                        <SelectItem key={act.value} value={act.value} className="text-xs">
                          {act.icon} {act.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeAction(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={addAction}>
              <Plus className="w-3 h-3" />Ajouter une action
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('conditions')}>← Retour</Button>
              <Button size="sm" className="flex-1" onClick={() => setStep('settings')}>Suivant →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SETTINGS STEP */}
      {step === 'settings' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              Paramètres finaux
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nom du workflow *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Email client → Tâche de suivi" className="mt-1" />
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium">Récapitulatif</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{TRIGGERS.find(t => t.value === triggerType)?.label}</Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="outline" className="text-xs">{conditions.length + (hasBranch ? 1 : 0)} condition(s)</Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="outline" className="text-xs">{actions.length} action(s)</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('actions')}>← Retour</Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleSave} disabled={!name.trim() || actions.length === 0}>
                <Zap className="w-3.5 h-3.5" />
                Créer le workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
