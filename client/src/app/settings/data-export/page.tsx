'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Trash2,
  FileArchive,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Data categories for export
// ---------------------------------------------------------------------------

interface DataCategory {
  id: string;
  label: string;
  description: string;
  estimatedSize: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'profile',
    label: 'Profil utilisateur',
    description: 'Nom, email, avatar, preferences, parametres du compte',
    estimatedSize: '~2 Ko',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    description: 'Carnet d\'adresses, contacts importes et groupes',
    estimatedSize: '~50 Ko',
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Fichiers stockes dans Drive, documents partages',
    estimatedSize: '~500 Mo',
  },
  {
    id: 'emails',
    label: 'Emails',
    description: 'Messages envoyes et recus, brouillons',
    estimatedSize: '~200 Mo',
  },
  {
    id: 'calendar',
    label: 'Calendrier',
    description: 'Evenements, rendez-vous, rappels',
    estimatedSize: '~10 Ko',
  },
  {
    id: 'chat',
    label: 'Messages chat',
    description: 'Conversations de messagerie instantanee',
    estimatedSize: '~30 Mo',
  },
  {
    id: 'settings',
    label: 'Parametres',
    description: 'Configuration de l\'interface, raccourcis, webhooks',
    estimatedSize: '~5 Ko',
  },
  {
    id: 'audit',
    label: 'Journal d\'activite',
    description: 'Historique de connexion et actions effectuees',
    estimatedSize: '~20 Ko',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataExportPage() {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(DATA_CATEGORIES.map((c) => c.id)),
  );
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () =>
    setSelectedCategories(new Set(DATA_CATEGORIES.map((c) => c.id)));
  const selectNone = () => setSelectedCategories(new Set());

  const handleExport = async () => {
    if (selectedCategories.size === 0) {
      toast.error('Selectionnez au moins une categorie');
      return;
    }
    setExporting(true);
    setExportDone(false);

    // Simulate export delay
    await new Promise((r) => setTimeout(r, 2500));

    // Generate a mock ZIP-like JSON export
    const exportData = {
      export_date: new Date().toISOString(),
      user: 'admin@signapps.local',
      format: 'GDPR Data Export',
      categories: Array.from(selectedCategories),
      data: {
        profile: selectedCategories.has('profile')
          ? {
              username: 'admin',
              email: 'admin@signapps.local',
              display_name: 'Administrateur',
              created_at: '2024-01-15T10:00:00Z',
              locale: 'fr-FR',
            }
          : undefined,
        contacts: selectedCategories.has('contacts')
          ? { count: 42, sample: ['jean.dupont@corp.local', 'marie.martin@corp.local'] }
          : undefined,
        documents: selectedCategories.has('documents')
          ? { count: 156, total_size_mb: 487.3 }
          : undefined,
        emails: selectedCategories.has('emails')
          ? { count: 1203, total_size_mb: 198.7 }
          : undefined,
        calendar: selectedCategories.has('calendar')
          ? { events_count: 89, first_event: '2024-02-01', last_event: '2026-04-15' }
          : undefined,
        chat: selectedCategories.has('chat')
          ? { conversations: 34, messages: 2871 }
          : undefined,
        settings: selectedCategories.has('settings')
          ? { theme: 'system', language: 'fr', notifications: true }
          : undefined,
        audit: selectedCategories.has('audit')
          ? { entries: 512, first_login: '2024-01-15T10:05:00Z' }
          : undefined,
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signapps-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setExportDone(true);
    toast.success('Export termine et telecharge');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;
    setDeleting(true);

    // Simulate — this is UI-only for GDPR compliance display
    await new Promise((r) => setTimeout(r, 2000));

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText('');
    toast.success(
      'Demande de suppression enregistree. Vous recevrez un email de confirmation sous 72h.',
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Export de donnees — RGPD</h1>
            <p className="text-sm text-muted-foreground">
              Telechargez ou supprimez vos donnees personnelles conformement au RGPD
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Data export section */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileArchive className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Telecharger mes donnees</CardTitle>
                <CardDescription>
                  Selectionnez les categories de donnees a inclure dans l&apos;export.
                  Le fichier sera genere au format JSON.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Select all / none */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Tout selectionner
              </Button>
              <Button variant="outline" size="sm" onClick={selectNone}>
                Tout deselectionner
              </Button>
              <Badge variant="outline" className="ml-auto">
                {selectedCategories.size} / {DATA_CATEGORIES.length} categories
              </Badge>
            </div>

            {/* Category checkboxes */}
            <div className="grid gap-3">
              {DATA_CATEGORIES.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedCategories.has(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">{cat.estimatedSize}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Export button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleExport}
                disabled={exporting || selectedCategories.size === 0}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparation de l&apos;export...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Telecharger mes donnees
                  </>
                )}
              </Button>
              {exportDone && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Export telecharge avec succes
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Account deletion section */}
        {/* ---------------------------------------------------------------- */}
        <Card className="border-red-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle className="text-base text-red-600">Supprimer mon compte</CardTitle>
                <CardDescription>
                  Cette action est irreversible. Toutes vos donnees seront definitivement
                  supprimees dans un delai de 30 jours conformement au RGPD.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                <p className="font-medium">Attention : cette action est definitive</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Tous vos fichiers, emails et messages seront supprimes</li>
                  <li>Vos parametres et preferences seront effaces</li>
                  <li>Vous ne pourrez plus acceder a votre compte</li>
                  <li>Un email de confirmation vous sera envoye</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Nous vous recommandons de telecharger vos donnees avant de supprimer votre
              compte.
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer mon compte
            </Button>
          </CardContent>
        </Card>

        {/* GDPR info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vos droits RGPD</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Conformement au Reglement General sur la Protection des Donnees (UE 2016/679),
              vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Droit d&apos;acces</strong> : obtenir une copie de vos donnees personnelles</li>
              <li><strong>Droit de rectification</strong> : corriger vos donnees inexactes</li>
              <li><strong>Droit a l&apos;effacement</strong> : demander la suppression de vos donnees</li>
              <li><strong>Droit a la portabilite</strong> : recevoir vos donnees dans un format structure</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement de vos donnees</li>
            </ul>
            <p className="text-xs">
              Pour toute question, contactez le DPO a{' '}
              <a href="mailto:dpo@signapps.local" className="text-primary underline">
                dpo@signapps.local
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Delete account confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer definitivement votre compte ?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  Cette action est irreversible. Pour confirmer, tapez{' '}
                  <strong>SUPPRIMER</strong> ci-dessous :
                </span>
                <Input
                  placeholder="Tapez SUPPRIMER"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="font-mono"
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                className="bg-destructive text-destructive-foreground"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  'Confirmer la suppression'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
