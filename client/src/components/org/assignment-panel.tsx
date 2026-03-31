'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { orgApi } from '@/lib/api/org';
import type { Person, PersonRole, Assignment, AssignmentHistory } from '@/types/org';
import {
  Plus,
  Link2,
  Link2Off,
  Clock,
  Briefcase,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AssignmentPanelProps {
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonUpdated?: () => void;
}

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: 'Titulaire',
  interim: 'Intérimaire',
  deputy: 'Adjoint',
  intern: 'Stagiaire',
  contractor: 'Prestataire',
};

const RESPONSIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  hierarchical: { label: 'Hiérarchique', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  functional: { label: 'Fonctionnel', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  matrix: { label: 'Matriciel', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export function AssignmentPanel({
  person,
  open,
  onOpenChange,
  onPersonUpdated,
}: AssignmentPanelProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [roles, setRoles] = useState<PersonRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [addAssignOpen, setAddAssignOpen] = useState(false);
  const [linkUserOpen, setLinkUserOpen] = useState(false);
  const [linkUserId, setLinkUserId] = useState('');
  const [linking, setLinking] = useState(false);

  // New assignment form
  const [nodeId, setNodeId] = useState('');
  const [assignmentType, setAssignmentType] = useState<string>('holder');
  const [responsibilityType, setResponsibilityType] = useState<string>('hierarchical');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [fteRatio, setFteRatio] = useState('1.0');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!person) return;
    setLoading(true);
    try {
      const [assignRes, histRes, detailRes] = await Promise.allSettled([
        orgApi.persons.assignments(person.id),
        orgApi.persons.history(person.id),
        orgApi.persons.get(person.id),
      ]);
      if (assignRes.status === 'fulfilled') setAssignments(assignRes.value.data ?? []);
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data ?? []);
      if (detailRes.status === 'fulfilled') setRoles(detailRes.value.data?.roles ?? []);
    } finally {
      setLoading(false);
    }
  }, [person]);

  useEffect(() => {
    if (open && person) loadData();
  }, [open, person, loadData]);

  const handleAddAssignment = async () => {
    if (!person || !nodeId.trim()) return;
    setSubmitting(true);
    try {
      await orgApi.assignments.create({
        person_id: person.id,
        node_id: nodeId.trim(),
        assignment_type: assignmentType as Assignment['assignment_type'],
        responsibility_type: responsibilityType as Assignment['responsibility_type'],
        start_date: startDate,
        end_date: endDate || undefined,
        fte_ratio: parseFloat(fteRatio) || 1.0,
        is_primary: assignments.length === 0,
      });
      toast.success('Affectation créée');
      setAddAssignOpen(false);
      setNodeId('');
      loadData();
      onPersonUpdated?.();
    } catch {
      toast.error("Erreur lors de la création de l'affectation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    try {
      await orgApi.assignments.end(assignmentId);
      toast.success('Affectation terminée');
      loadData();
      onPersonUpdated?.();
    } catch {
      toast.error("Erreur lors de la fin de l'affectation");
    }
  };

  const handleLinkUser = async () => {
    if (!person || !linkUserId.trim()) return;
    setLinking(true);
    try {
      await orgApi.persons.linkUser(person.id, linkUserId.trim());
      toast.success('Compte utilisateur lié');
      setLinkUserOpen(false);
      setLinkUserId('');
      onPersonUpdated?.();
    } catch {
      toast.error('Erreur lors du lien');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkUser = async () => {
    if (!person) return;
    try {
      await orgApi.persons.unlinkUser(person.id);
      toast.success('Compte utilisateur délié');
      onPersonUpdated?.();
    } catch {
      toast.error('Erreur lors du délien');
    }
  };

  if (!person) return null;

  const initials = `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase();
  const activeAssignments = assignments.filter((a) => !a.end_date || new Date(a.end_date) > new Date());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{person.first_name} {person.last_name}</SheetTitle>
              <SheetDescription>{person.email ?? 'Pas d\'email'}</SheetDescription>
            </div>
          </div>

          {/* Link/unlink user account */}
          <div className="flex items-center gap-2 pt-2">
            {person.user_id ? (
              <Button size="sm" variant="outline" onClick={handleUnlinkUser}>
                <Link2Off className="h-4 w-4 mr-1" />
                Délier le compte
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setLinkUserOpen(true)}>
                <Link2 className="h-4 w-4 mr-1" />
                Lier un compte
              </Button>
            )}
            {person.user_id && (
              <Badge variant="secondary" className="text-xs text-green-600">
                Compte lié
              </Badge>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Active assignments ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">
                    Affectations actives ({activeAssignments.length})
                  </h4>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddAssignOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Affecter
                </Button>
              </div>

              {activeAssignments.length === 0 ? (
                <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                  Aucune affectation active
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAssignments.map((a) => {
                    const respCfg = RESPONSIBILITY_LABELS[a.responsibility_type];
                    return (
                      <div key={a.id} className="p-3 rounded-lg border border-border bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{a.node_id}</p>
                              {a.is_primary && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {ASSIGNMENT_TYPE_LABELS[a.assignment_type] ?? a.assignment_type}
                              </Badge>
                              {respCfg && (
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', respCfg.color)}>
                                  {respCfg.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Depuis {new Date(a.start_date).toLocaleDateString('fr-FR')}
                            </p>
                            {/* FTE bar */}
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(a.fte_ratio * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {(a.fte_ratio * 100).toFixed(0)}% ETP
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                            onClick={() => handleEndAssignment(a.id)}
                          >
                            Terminer
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* ── History timeline ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Historique ({history.length})</h4>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun historique disponible
                </p>
              ) : (
                <div className="relative space-y-4 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {history.slice(0, 10).map((h) => (
                    <div key={h.id} className="relative flex gap-3">
                      <div className="absolute -left-4 mt-1 h-3 w-3 rounded-full border-2 border-primary bg-background shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {h.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.effective_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        {h.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.reason}</p>
                        )}
                        {h.changed_by && (
                          <p className="text-[10px] text-muted-foreground">par {h.changed_by}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>

      {/* ── Add assignment dialog ── */}
      <Dialog open={addAssignOpen} onOpenChange={setAddAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une affectation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assign-node">ID du noeud *</Label>
              <Input
                id="assign-node"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                placeholder="UUID du noeud organisationnel"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type d'affectation</Label>
                <Select value={assignmentType} onValueChange={setAssignmentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsabilité</Label>
                <Select value={responsibilityType} onValueChange={setResponsibilityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESPONSIBILITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date">Date de début *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Date de fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fte">Taux ETP (0-1)</Label>
              <Input
                id="fte"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={fteRatio}
                onChange={(e) => setFteRatio(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAssignOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddAssignment} disabled={submitting || !nodeId.trim()}>
              {submitting ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link user dialog ── */}
      <Dialog open={linkUserOpen} onOpenChange={setLinkUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lier un compte utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Entrez l'UUID du compte utilisateur à associer à cette personne.
            </p>
            <div className="space-y-2">
              <Label htmlFor="user-id">ID utilisateur *</Label>
              <Input
                id="user-id"
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
                placeholder="UUID du compte utilisateur"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkUserOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleLinkUser} disabled={linking || !linkUserId.trim()}>
              {linking ? 'Liaison...' : 'Lier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
