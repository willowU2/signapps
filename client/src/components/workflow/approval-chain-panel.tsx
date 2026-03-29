'use client';

// Feature 18: Approval chain UI — request → approve → execute

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Send, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApprovalChain } from '@/hooks/use-approval-chain';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_CONFIG = {
  pending: { label: 'En attente', class: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approuvé', class: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejeté', class: 'bg-red-100 text-red-700', icon: XCircle },
  executed: { label: 'Exécuté', class: 'bg-blue-100 text-blue-700', icon: CheckCircle },
};

export function ApprovalChainPanel({ entityType = 'document', entityId = '' }: { entityType?: string; entityId?: string }) {
  const { requests, pending, loading, submit, decide, refresh } = useApprovalChain(entityId || undefined);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newApprovers, setNewApprovers] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    if (!newTitle.trim()) return;
    const approverIds = newApprovers.split(',').map(s => s.trim()).filter(Boolean);
    if (approverIds.length === 0) { toast.error('Ajoutez au moins un approbateur'); return; }
    try {
      await submit(newTitle, newDesc, entityType, entityId, approverIds);
      setNewTitle(''); setNewDesc(''); setNewApprovers('');
      toast.success('Demande d\'approbation envoyée');
    } catch { toast.error('Erreur lors de l\'envoi'); }
  };

  const handleDecide = async (id: string, approved: boolean) => {
    try {
      await decide(id, approved, comment);
      setDeciding(null); setComment('');
      toast.success(approved ? 'Approuvé' : 'Rejeté');
    } catch { toast.error('Erreur lors de la décision'); }
  };

  return (
    <div className="space-y-4">
      {/* New request form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Send className="w-4 h-4 text-primary" />
            Nouvelle demande d'approbation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Titre *</Label>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Approbation contrat client ABC" className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Détails de la demande…" className="mt-1 text-sm" rows={2} />
          </div>
          <div>
            <Label className="text-xs">Approbateurs (IDs séparés par virgules) *</Label>
            <Input value={newApprovers} onChange={e => setNewApprovers(e.target.value)} placeholder="user_1, user_2, user_3" className="mt-1 h-8 text-sm" />
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={!newTitle.trim()}>
            <Send className="w-3.5 h-3.5" />
            Soumettre
          </Button>
        </CardContent>
      </Card>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-yellow-600" />
              En attente de votre décision
              <Badge className="bg-yellow-100 text-yellow-700 text-xs h-4 px-1">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending.slice(0, 3).map(r => (
                <div key={r.id} className="p-2 bg-muted/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  {deciding === r.id ? (
                    <div className="space-y-2">
                      <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (optionnel)…" rows={2} className="text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1 flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleDecide(r.id, true)}>
                          <CheckCircle className="w-3.5 h-3.5" />Approuver
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1 flex-1" onClick={() => handleDecide(r.id, false)}>
                          <XCircle className="w-3.5 h-3.5" />Rejeter
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeciding(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setDeciding(r.id)}>
                      <ChevronRight className="w-3 h-3" />Décider
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All requests */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Historique</p>
        <ScrollArea className="max-h-64">
          <div className="space-y-1.5">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune demande</p>
            ) : requests.map(r => {
              const cfg = STATUS_CONFIG[r.status];
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg border">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${r.status === 'approved' || r.status === 'executed' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-500' : 'text-yellow-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{r.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-xs h-4 px-1 ${cfg.class}`}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
