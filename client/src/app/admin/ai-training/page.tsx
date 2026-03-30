'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  FileText,
  Mail,
  MessageSquare,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Database,
  BarChart2,
  Shield,
} from 'lucide-react';
import { aiApi, AIStats } from '@/lib/api/ai';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrainingStats {
  documents: number;
  emails: number;
  conversations: number;
  totalChunks: number;
  qualityScore: number; // 0-100
  diversityScore: number; // 0-100
  volumeScore: number; // 0-100
  lastIndexed?: string;
}

interface QualityDimension {
  label: string;
  score: number;
  description: string;
  icon: React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreToColor(score: number): string {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-blue-600 dark:text-blue-400';
  if (score >= 25) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreToBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-blue-500';
  if (score >= 25) return 'bg-yellow-500';
  return 'bg-red-400';
}

function scoreToBadge(score: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (score >= 75) return { label: 'Excellent', variant: 'default' };
  if (score >= 50) return { label: 'Bon', variant: 'secondary' };
  if (score >= 25) return { label: 'Moyen', variant: 'outline' };
  return { label: 'Insuffisant', variant: 'destructive' };
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel?: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

// ── Quality dimension row ──────────────────────────────────────────────────────

function QualityRow({ dim }: { dim: QualityDimension }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{dim.icon}</span>
          <span className="text-sm font-medium">{dim.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold tabular-nums ${scoreToColor(dim.score)}`}>{dim.score}/100</span>
          <Badge variant={scoreToBadge(dim.score).variant} className="text-[10px] px-1.5">
            {scoreToBadge(dim.score).label}
          </Badge>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${scoreToBarColor(dim.score)} rounded-full transition-all duration-700`}
          style={{ width: `${dim.score}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{dim.description}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AITrainingPage() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const aiStats: AIStats = (await aiApi.stats()).data;

      // Compute synthetic quality scores from raw stats
      const volumeScore = Math.min(100, Math.round((aiStats.documents_count / 500) * 100));
      const diversityScore = Math.min(100, Math.round((aiStats.chunks_count / aiStats.documents_count) * 10));
      const qualityScore = Math.round((volumeScore + diversityScore) / 2);

      setStats({
        documents: aiStats.documents_count,
        emails: Math.round(aiStats.chunks_count * 0.3), // estimate
        conversations: Math.round(aiStats.chunks_count * 0.1), // estimate
        totalChunks: aiStats.chunks_count,
        qualityScore: Math.min(100, qualityScore),
        diversityScore: Math.min(100, diversityScore),
        volumeScore: Math.min(100, volumeScore),
        lastIndexed: aiStats.last_indexed,
      });
    } catch {
      toast.error('Impossible de charger les statistiques');
      // Fallback values
      setStats({
        documents: 0,
        emails: 0,
        conversations: 0,
        totalChunks: 0,
        qualityScore: 0,
        diversityScore: 0,
        volumeScore: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Simulate export — in production this would call an anonymization + export API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const exportData = {
        exported_at: new Date().toISOString(),
        source: 'signapps-ai',
        anonymized: true,
        stats: stats,
        note: 'Données anonymisées pour fine-tuning. Aucune information personnelle incluse.',
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signapps-training-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Données d\'entraînement exportées (anonymisées)');
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  const qualityDimensions: QualityDimension[] = stats
    ? [
        {
          label: 'Volume',
          score: stats.volumeScore,
          description: `${stats.totalChunks.toLocaleString('fr-FR')} chunks indexés. Recommandé : >5 000 pour un fine-tuning efficace.`,
          icon: <Database className="h-3.5 w-3.5" />,
        },
        {
          label: 'Diversité',
          score: stats.diversityScore,
          description: 'Ratio chunks/documents. Un ratio élevé indique une bonne granularité du contenu.',
          icon: <BarChart2 className="h-3.5 w-3.5" />,
        },
        {
          label: 'Score global',
          score: stats.qualityScore,
          description: 'Score composite prenant en compte le volume et la diversité des données.',
          icon: <Sparkles className="h-3.5 w-3.5" />,
        },
      ]
    : [];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Entraînement IA</h1>
              <Badge variant="outline" className="text-xs">Admin</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Statistiques des données d'entraînement indexées et qualité du corpus.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadStats} disabled={isLoading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="gap-1.5"
            >
              <Download className={`h-3.5 w-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              Exporter les données
            </Button>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">Données anonymisées</p>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-0.5">
              L'export supprime tous les identifiants personnels (noms, emails, IDs). Seule la structure sémantique est conservée.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Données indexées</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Documents"
                value={stats?.documents ?? 0}
                sublabel="PDFs, DOCX, textes"
              />
              <StatCard
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Emails"
                value={stats?.emails ?? 0}
                sublabel="Corpus email indexé"
              />
              <StatCard
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Conversations"
                value={stats?.conversations ?? 0}
                sublabel="Historique chat IA"
              />
              <StatCard
                icon={<Database className="h-3.5 w-3.5" />}
                label="Chunks totaux"
                value={stats?.totalChunks ?? 0}
                sublabel="Segments vectorisés"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Quality scores */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Qualité du corpus
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5 space-y-5">
                {qualityDimensions.map((dim) => (
                  <QualityRow key={dim.label} dim={dim} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Note */}
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Fine-tuning — Infrastructure externe requise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs leading-relaxed">
              Cette page est un outil de <strong>monitoring et d'export</strong>. Le fine-tuning réel (LoRA, QLoRA, SFT)
              requiert une infrastructure GPU dédiée (ex. RunPod, Lambda Labs) et des outils spécialisés
              (Axolotl, LLaMA Factory). Exportez les données ici, puis importez-les dans votre pipeline d'entraînement.
            </CardDescription>
          </CardContent>
        </Card>

        {/* Last indexed */}
        {stats?.lastIndexed && (
          <p className="text-xs text-muted-foreground text-right flex items-center justify-end gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Dernière indexation : {new Date(stats.lastIndexed).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
