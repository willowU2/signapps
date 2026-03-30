'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePageTitle } from '@/hooks/use-page-title';
import { WorkflowAnalytics } from '@/components/workflows/workflow-analytics';
import { Plus, GitBranch, Trash2, ChevronRight, Zap, BarChart2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowState {
  id: string;
  name: string;
  color: string;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

export interface WorkflowAction {
  type: 'send_notification' | 'create_task';
  payload: string;
}

export interface WorkflowTransition {
  id: string;
  from: string;
  to: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export interface Workflow {
  id: string;
  name: string;
  entity: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  createdAt: string;
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Array<{
  name: string;
  description: string;
  entity: string;
  states: Array<{ name: string; color: string }>;
}> = [
  {
    name: 'Validation de conges',
    description: 'Soumission → Manager → RH → Approuve/Refuse',
    entity: 'Conges',
    states: [
      { name: 'Soumission', color: '#6366f1' },
      { name: 'Manager', color: '#f59e0b' },
      { name: 'RH', color: '#3b82f6' },
      { name: 'Approuve', color: '#22c55e' },
      { name: 'Refuse', color: '#ef4444' },
    ],
  },
  {
    name: 'Approbation devis',
    description: 'Commercial → Directeur commercial → Client',
    entity: 'Devis',
    states: [
      { name: 'Brouillon', color: '#94a3b8' },
      { name: 'Commercial', color: '#6366f1' },
      { name: 'Directeur', color: '#f59e0b' },
      { name: 'Client', color: '#3b82f6' },
      { name: 'Signe', color: '#22c55e' },
    ],
  },
  {
    name: 'Onboarding employe',
    description: 'RH → IT setup → Manager → Formation',
    entity: 'Employe',
    states: [
      { name: 'Nouveau', color: '#6366f1' },
      { name: 'RH', color: '#f59e0b' },
      { name: 'IT Setup', color: '#3b82f6' },
      { name: 'Manager', color: '#8b5cf6' },
      { name: 'Formation', color: '#f97316' },
      { name: 'Actif', color: '#22c55e' },
    ],
  },
  {
    name: 'Publication contenu',
    description: 'Redacteur → Relecteur → Approbateur → Publie',
    entity: 'Contenu',
    states: [
      { name: 'Redaction', color: '#6366f1' },
      { name: 'Relecture', color: '#f59e0b' },
      { name: 'Approbation', color: '#3b82f6' },
      { name: 'Publie', color: '#22c55e' },
      { name: 'Rejete', color: '#ef4444' },
    ],
  },
];

const STATE_COLORS = [
  '#6366f1', '#3b82f6', '#22c55e', '#f59e0b',
  '#ef4444', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#94a3b8',
];

const LS_KEY = 'signapps_workflows';

function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkflows(wfs: Workflow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(wfs));
}

// ─── SVG Flow Diagram ─────────────────────────────────────────────────────────

function FlowDiagram({ workflow }: { workflow: Workflow }) {
  const { states, transitions } = workflow;
  const W = 120, H = 44, GAP = 60;
  const cols = Math.min(states.length, 5);
  const rows = Math.ceil(states.length / cols);
  const svgW = cols * (W + GAP) + 40;
  const svgH = rows * (H + GAP) + 20;

  const posOf = (idx: number) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return { x: 20 + col * (W + GAP), y: 20 + row * (H + GAP) };
  };

  return (
    <svg width={svgW} height={svgH} className="overflow-visible">
      {/* Arrows */}
      {transitions.map((tr) => {
        const fi = states.findIndex((s) => s.id === tr.from);
        const ti = states.findIndex((s) => s.id === tr.to);
        if (fi < 0 || ti < 0) return null;
        const fp = posOf(fi);
        const tp = posOf(ti);
        const x1 = fp.x + W;
        const y1 = fp.y + H / 2;
        const x2 = tp.x;
        const y2 = tp.y + H / 2;
        const mx = (x1 + x2) / 2;
        return (
          <g key={tr.id}>
            <path
              d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {/* States */}
      {states.map((s, idx) => {
        const { x, y } = posOf(idx);
        return (
          <g key={s.id}>
            <rect x={x} y={y} width={W} height={H} rx={22} fill={s.color} opacity={0.15} stroke={s.color} strokeWidth={2} />
            <text x={x + W / 2} y={y + H / 2 + 5} textAnchor="middle" fontSize={12} fill={s.color} fontWeight="600">
              {s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  usePageTitle('Workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // New workflow form
  const [newName, setNewName] = useState('');
  const [newEntity, setNewEntity] = useState('');
  const [newStates, setNewStates] = useState<WorkflowState[]>([
    { id: crypto.randomUUID(), name: 'Nouveau', color: '#6366f1' },
    { id: crypto.randomUUID(), name: 'En cours', color: '#f59e0b' },
    { id: crypto.randomUUID(), name: 'Valide', color: '#22c55e' },
    { id: crypto.randomUUID(), name: 'Termine', color: '#94a3b8' },
  ]);

  // Transition dialog
  const [showTransition, setShowTransition] = useState(false);
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trCondField, setTrCondField] = useState('');
  const [trCondVal, setTrCondVal] = useState('');
  const [trActionType, setTrActionType] = useState<'send_notification' | 'create_task'>('send_notification');
  const [trActionPayload, setTrActionPayload] = useState('');

  const persist = useCallback((wfs: Workflow[]) => {
    setWorkflows(wfs);
    saveWorkflows(wfs);
  }, []);

  const handleAddState = () => {
    setNewStates([...newStates, { id: crypto.randomUUID(), name: 'Etat', color: STATE_COLORS[newStates.length % STATE_COLORS.length] }]);
  };

  const handleCreateWorkflow = () => {
    if (!newName.trim()) { toast.error('Nom requis'); return; }
    const wf: Workflow = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      entity: newEntity.trim() || 'Entite',
      states: newStates,
      transitions: [],
      createdAt: new Date().toISOString(),
    };
    persist([...workflows, wf]);
    toast.success('Workflow créé');
    setShowNew(false);
    setSelected(wf);
  };

  const handleFromTemplate = (tpl: typeof TEMPLATES[number]) => {
    const states: WorkflowState[] = tpl.states.map(s => ({ id: crypto.randomUUID(), name: s.name, color: s.color }));
    const transitions: WorkflowTransition[] = [];
    for (let i = 0; i < states.length - 1; i++) {
      transitions.push({ id: crypto.randomUUID(), from: states[i].id, to: states[i + 1].id, conditions: [], actions: [] });
    }
    const wf: Workflow = {
      id: crypto.randomUUID(),
      name: tpl.name,
      entity: tpl.entity,
      states,
      transitions,
      createdAt: new Date().toISOString(),
    };
    persist([...workflows, wf]);
    toast.success(`Workflow "${tpl.name}" créé depuis le modèle`);
    setShowTemplates(false);
    setSelected(wf);
  };

  const handleAddTransition = () => {
    if (!selected || !trFrom || !trTo) return;
    const tr: WorkflowTransition = {
      id: crypto.randomUUID(),
      from: trFrom,
      to: trTo,
      conditions: trCondField.trim() ? [{ field: trCondField, operator: 'equals', value: trCondVal }] : [],
      actions: trActionPayload.trim() ? [{ type: trActionType, payload: trActionPayload }] : [],
    };
    const updated = { ...selected, transitions: [...selected.transitions, tr] };
    const wfs = workflows.map(w => w.id === selected.id ? updated : w);
    persist(wfs);
    setSelected(updated);
    setShowTransition(false);
    toast.success('Transition ajoutée');
  };

  const handleDeleteWorkflow = (id: string) => {
    persist(workflows.filter(w => w.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('Workflow supprimé');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
              <p className="text-muted-foreground text-sm mt-1">Moteur d&apos;états et de transitions pour vos entités</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAnalytics(true)}>
              <BarChart2 className="h-4 w-4 mr-2" />Analytiques
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
              <BookOpen className="h-4 w-4 mr-2" />Modèles
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" />Nouveau workflow
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* List */}
          <div className="col-span-12 md:col-span-4 space-y-2">
            {workflows.length === 0 ? (
              <div className="border rounded-xl p-8 text-center text-muted-foreground">
                <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun workflow. Créez-en un ou partez d&apos;un modèle.</p>
              </div>
            ) : (
              workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => setSelected(wf)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === wf.id ? 'border-primary bg-primary/5' : 'hover:border-border/80 hover:bg-muted/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{wf.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{wf.entity} · {wf.states.length} états · {wf.transitions.length} transitions</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wf.states.slice(0, 4).map(s => (
                      <span key={s.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: s.color }}>{s.name}</span>
                    ))}
                    {wf.states.length > 4 && <span className="text-xs text-muted-foreground">+{wf.states.length - 4}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detail */}
          <div className="col-span-12 md:col-span-8">
            {selected ? (
              <div className="border rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <Badge variant="outline">{selected.entity}</Badge>
                </div>

                {/* Diagram */}
                <div className="overflow-x-auto bg-muted/30 rounded-lg p-4">
                  <FlowDiagram workflow={selected} />
                </div>

                {/* States */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">États</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.states.map(s => (
                      <span key={s.id} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: s.color }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Transitions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Transitions</h3>
                    <Button size="sm" variant="outline" onClick={() => { setTrFrom(''); setTrTo(''); setTrCondField(''); setTrCondVal(''); setTrActionPayload(''); setShowTransition(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                    </Button>
                  </div>
                  {selected.transitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune transition définie.</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.transitions.map(tr => {
                        const fromState = selected.states.find(s => s.id === tr.from);
                        const toState = selected.states.find(s => s.id === tr.to);
                        return (
                          <div key={tr.id} className="flex items-center gap-2 text-sm p-2 bg-muted/40 rounded-lg">
                            {fromState && <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ backgroundColor: fromState.color }}>{fromState.name}</span>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            {toState && <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ backgroundColor: toState.color }}>{toState.name}</span>}
                            {tr.conditions.length > 0 && <Badge variant="secondary" className="text-xs ml-auto">Si {tr.conditions[0].field}={tr.conditions[0].value}</Badge>}
                            {tr.actions.length > 0 && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border rounded-xl p-12 text-center text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Sélectionnez un workflow pour l&apos;afficher</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New workflow dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau workflow</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nom du workflow</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Approbation facture" />
            </div>
            <div className="space-y-1.5">
              <Label>Entité cible</Label>
              <Input value={newEntity} onChange={e => setNewEntity(e.target.value)} placeholder="Ex: Devis, Ticket, Document" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>États</Label>
                <Button size="sm" variant="ghost" onClick={handleAddState}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter</Button>
              </div>
              {newStates.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input type="color" value={s.color} onChange={e => setNewStates(ns => ns.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} className="h-8 w-8 rounded cursor-pointer border" />
                  <Input value={s.name} onChange={e => setNewStates(ns => ns.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setNewStates(ns => ns.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
            <Button onClick={handleCreateWorkflow}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Choisir un modèle</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.name}
                onClick={() => handleFromTemplate(tpl)}
                className="w-full text-left p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <p className="font-semibold text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tpl.states.map(s => (
                    <span key={s.name} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: s.color }}>{s.name}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add transition dialog */}
      <Dialog open={showTransition} onOpenChange={setShowTransition}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une transition</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Select value={trFrom} onValueChange={setTrFrom}>
                  <SelectTrigger><SelectValue placeholder="État source" /></SelectTrigger>
                  <SelectContent>
                    {selected?.states.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vers</Label>
                <Select value={trTo} onValueChange={setTrTo}>
                  <SelectTrigger><SelectValue placeholder="État cible" /></SelectTrigger>
                  <SelectContent>
                    {selected?.states.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Condition (optionnel)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Champ (ex: statut)" value={trCondField} onChange={e => setTrCondField(e.target.value)} />
                <Input placeholder="Valeur" value={trCondVal} onChange={e => setTrCondVal(e.target.value)} />
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Action automatique (optionnel)</p>
              <Select value={trActionType} onValueChange={v => setTrActionType(v as 'send_notification' | 'create_task')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_notification">Envoyer une notification</SelectItem>
                  <SelectItem value="create_task">Créer une tâche</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Message / titre de la tâche" value={trActionPayload} onChange={e => setTrActionPayload(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransition(false)}>Annuler</Button>
            <Button onClick={handleAddTransition} disabled={!trFrom || !trTo}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics */}
      {showAnalytics && selected && (
        <WorkflowAnalytics workflow={selected} onClose={() => setShowAnalytics(false)} />
      )}
    </AppLayout>
  );
}
