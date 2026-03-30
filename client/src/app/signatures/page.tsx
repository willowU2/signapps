'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PenLine, Plus, Search, Eye, Ban, Send, Clock, CheckCircle2, XCircle, Loader2, FileSignature } from 'lucide-react';
import { signaturesApi } from '@/lib/api/crosslinks';
import type { SignatureEnvelope } from '@/types/crosslinks';
import { EnvelopeWizard } from '@/components/signatures/envelope-wizard';
import { EnvelopeDetail } from '@/components/signatures/envelope-detail';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatDistanceToNow } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3" /> },
  sent: { label: 'Envoyé', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  in_progress: { label: 'En cours', color: 'bg-yellow-100 text-yellow-700', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: 'Complété', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
  expired: { label: 'Expiré', color: 'bg-orange-100 text-orange-700', icon: <Clock className="h-3 w-3" /> },
  voided: { label: 'Annulé', color: 'bg-gray-100 text-gray-500', icon: <Ban className="h-3 w-3" /> },
};

export default function SignaturesPage() {
  usePageTitle('Signatures');

  const [envelopes, setEnvelopes] = useState<SignatureEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchEnvelopes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await signaturesApi.list({ limit: 100 });
      setEnvelopes(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Impossible de charger les enveloppes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvelopes();
  }, [fetchEnvelopes]);

  const handleVoid = async (id: string) => {
    try {
      await signaturesApi.void(id);
      toast.success('Enveloppe annulée');
      fetchEnvelopes();
    } catch {
      toast.error("Impossible d'annuler l'enveloppe");
    }
  };

  const filtered = envelopes.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedEnvelope = envelopes.find((e) => e.id === selectedId) ?? null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Signatures électroniques"
          description="Créez et gérez vos enveloppes de signature"
          icon={<PenLine className="h-5 w-5" />}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une enveloppe..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle enveloppe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Créer une enveloppe de signature</DialogTitle>
              </DialogHeader>
              <EnvelopeWizard
                onSuccess={() => {
                  setWizardOpen(false);
                  fetchEnvelopes();
                }}
                onCancel={() => setWizardOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['draft', 'sent', 'in_progress', 'completed'] as const).map((status) => {
            const count = envelopes.filter((e) => e.status === status).length;
            const cfg = STATUS_CONFIG[status];
            return (
              <Card key={status} className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </Card>
            );
          })}
        </div>

        {/* Envelope list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes les enveloppes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileSignature className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">Aucune enveloppe trouvée</p>
                <p className="text-sm mt-1">Créez votre première enveloppe pour commencer</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((env) => {
                  const cfg = STATUS_CONFIG[env.status] ?? STATUS_CONFIG.draft;
                  return (
                    <div
                      key={env.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{env.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(env.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className={`flex items-center gap-1 ${cfg.color} border-0`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedId(env.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(env.status === 'draft' || env.status === 'sent') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                            onClick={() => handleVoid(env.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Envelope detail drawer */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail de l'enveloppe</DialogTitle>
          </DialogHeader>
          {selectedEnvelope && (
            <EnvelopeDetail
              envelope={selectedEnvelope}
              onRefresh={() => {
                fetchEnvelopes();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
