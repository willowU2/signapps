'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Rocket,
  Database,
  Users,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { getClient, ServiceName, checkServiceHealth } from '@/lib/api/factory';
import { usersApi } from '@/lib/api/identity';

const STORAGE_KEY = 'signapps_initialized';
const DISMISSED_KEY = 'signapps_seed_dismissed';

type SeedStatus = 'idle' | 'seeding' | 'done' | 'error';

interface SeedStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  detail?: string;
}

/**
 * First-run detection dialog.
 *
 * Checks whether this is the first time the app is being used by looking at:
 *  1. localStorage flag `signapps_initialized`
 *  2. Whether the identity service has more than one user (admin)
 *
 * If the app appears to be freshly installed, shows a dialog offering to
 * populate the database with realistic demo data.
 */
export function FirstRunDialog() {
  const [open, setOpen] = useState(false);
  const [seedStatus, setSeedStatus] = useState<SeedStatus>('idle');
  const [steps, setSteps] = useState<SeedStep[]>([]);
  const [skipFutureChecks, setSkipFutureChecks] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { isAuthenticated } = useAuthStore();

  // Check if this is the first run
  useEffect(() => {
    if (!isAuthenticated) return;

    const alreadyInitialized = localStorage.getItem(STORAGE_KEY);
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (alreadyInitialized || dismissed) return;

    // Small delay to let the app settle after login
    const timer = setTimeout(async () => {
      try {
        // Check how many users exist — if only 1 (admin), it is a fresh install
        const resp = await usersApi.list(0, 10);
        const users = resp.data;
        const userCount = Array.isArray(users) ? users.length : 0;

        if (userCount <= 1) {
          setOpen(true);
        } else {
          // More than 1 user means data already exists
          localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        }
      } catch {
        // Service might be down — don't bother the user
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const handleDismiss = useCallback(() => {
    if (skipFutureChecks) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    setOpen(false);
  }, [skipFutureChecks]);

  const handleSeedComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
    // Refresh the page to pick up the new data
    window.location.reload();
  }, []);

  // Seed demo data via the backend APIs directly from the browser
  const handleSeed = useCallback(async () => {
    setSeedStatus('seeding');
    setErrorMessage('');

    const initialSteps: SeedStep[] = [
      { id: 'users', label: 'Utilisateurs de demo', icon: <Users className="h-4 w-4" />, status: 'pending' },
      { id: 'contacts', label: 'Contacts', icon: <Users className="h-4 w-4" />, status: 'pending' },
      { id: 'calendar', label: 'Evenements du calendrier', icon: <Calendar className="h-4 w-4" />, status: 'pending' },
      { id: 'scheduler', label: 'Taches planifiees', icon: <Clock className="h-4 w-4" />, status: 'pending' },
      { id: 'storage', label: 'Documents exemples', icon: <FileText className="h-4 w-4" />, status: 'pending' },
    ];
    setSteps(initialSteps);

    const updateStep = (id: string, update: Partial<SeedStep>) => {
      setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
    };

    try {
      const identityClient = getClient(ServiceName.IDENTITY);
      const calendarClient = getClient(ServiceName.CALENDAR);
      const schedulerClient = getClient(ServiceName.SCHEDULER);
      const storageClient = getClient(ServiceName.STORAGE);

      // ── Users ────────────────────────────────────────────────────────
      updateStep('users', { status: 'running' });
      try {
        const demoUsers = [
          { username: 'marie.dupont', email: 'marie.dupont@signapps.local', display_name: 'Marie Dupont', password: 'Demo1234!', role: 1 },
          { username: 'jean.martin', email: 'jean.martin@signapps.local', display_name: 'Jean Martin', password: 'Demo1234!', role: 0 },
        ];

        let created = 0;
        for (const user of demoUsers) {
          try {
            await identityClient.post('/users', user);
            created++;
          } catch (err: any) {
            // 409 = already exists, that is fine
            if (err?.response?.status !== 409 && err?.response?.status !== 400) {
              throw err;
            }
          }
        }
        updateStep('users', { status: 'done', detail: `${created} utilisateurs crees` });
      } catch {
        updateStep('users', { status: 'error', detail: 'Erreur lors de la creation' });
      }

      // ── Contacts ─────────────────────────────────────────────────────
      updateStep('contacts', { status: 'running' });
      try {
        const contacts = [
          { display_name: 'Sophie Lefevre', email: 'sophie.lefevre@acme.fr', phone: '+33 6 12 34 56 78', company: 'ACME Solutions', job_title: 'Directrice Marketing' },
          { display_name: 'Thomas Bernard', email: 'thomas.bernard@techcorp.fr', phone: '+33 6 23 45 67 89', company: 'TechCorp', job_title: 'Developpeur Senior' },
          { display_name: 'Isabelle Moreau', email: 'isabelle.moreau@durand.fr', phone: '+33 6 34 56 78 90', company: 'Durand & Associes', job_title: 'Avocate' },
          { display_name: 'Nicolas Petit', email: 'nicolas.petit@innovatech.fr', phone: '+33 6 45 67 89 01', company: 'InnovaTech', job_title: 'Chef de Projet' },
          { display_name: 'Camille Roux', email: 'camille.roux@mediaplus.fr', phone: '+33 6 56 78 90 12', company: 'MediaPlus', job_title: 'Responsable Communication' },
          { display_name: 'Antoine Dubois', email: 'antoine.dubois@construire.fr', phone: '+33 6 67 89 01 23', company: 'Construire SA', job_title: 'Architecte' },
          { display_name: 'Emilie Laurent', email: 'emilie.laurent@santeplus.fr', phone: '+33 6 78 90 12 34', company: 'SantePlus', job_title: 'Medecin' },
          { display_name: 'Pierre Girard', email: 'pierre.girard@logisys.fr', phone: '+33 6 89 01 23 45', company: 'LogiSys', job_title: 'Administrateur Systeme' },
          { display_name: 'Julie Bonnet', email: 'julie.bonnet@creativ.fr', phone: '+33 6 90 12 34 56', company: 'Creativ Agency', job_title: 'Designer UX' },
          { display_name: 'Francois Lemaire', email: 'francois.lemaire@finance.fr', phone: '+33 6 01 23 45 67', company: 'Finance Group', job_title: 'Analyste Financier' },
        ];

        // Try the contacts service first; fall back to localStorage
        const contactsHealth = await checkServiceHealth(ServiceName.CONTACTS);
        if (contactsHealth.healthy) {
          const contactsClient = getClient(ServiceName.CONTACTS);
          let created = 0;
          for (const contact of contacts) {
            try {
              await contactsClient.post('/contacts', contact);
              created++;
            } catch (err: any) {
              if (err?.response?.status !== 409 && err?.response?.status !== 400) {
                // Silently skip individual contact errors
              }
            }
          }
          updateStep('contacts', { status: 'done', detail: `${created} contacts crees` });
        } else {
          // Save to localStorage for offline/no-service mode
          localStorage.setItem('signapps_demo_contacts', JSON.stringify(contacts));
          updateStep('contacts', { status: 'done', detail: '10 contacts (local)' });
        }
      } catch {
        updateStep('contacts', { status: 'skipped', detail: 'Service non disponible' });
      }

      // ── Calendar Events ──────────────────────────────────────────────
      updateStep('calendar', { status: 'running' });
      try {
        const calHealth = await checkServiceHealth(ServiceName.CALENDAR);
        if (!calHealth.healthy) {
          updateStep('calendar', { status: 'skipped', detail: 'Service non disponible' });
        } else {
          // Create or find default calendar
          let calendarId = '';
          try {
            const calsResp = await calendarClient.get('/calendars');
            const cals = calsResp.data;
            if (Array.isArray(cals) && cals.length > 0) {
              calendarId = cals[0].id;
            }
          } catch { /* ignore */ }

          if (!calendarId) {
            try {
              const newCal = await calendarClient.post('/calendars', {
                name: 'Calendrier principal',
                description: 'Calendrier par defaut',
                color: '#4285f4',
                timezone: 'Europe/Paris',
              });
              calendarId = newCal.data.id;
            } catch { /* ignore */ }
          }

          if (calendarId) {
            // Get current week dates
            const now = new Date();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));

            const makeDate = (dayOffset: number, hour: number) => {
              const d = new Date(monday);
              d.setDate(d.getDate() + dayOffset);
              d.setHours(hour, 0, 0, 0);
              return d.toISOString();
            };

            const events = [
              { title: "Reunion d'equipe", start: makeDate(0, 9), end: makeDate(0, 10), description: "Point hebdomadaire", color: '#4285f4' },
              { title: 'Revue de sprint', start: makeDate(1, 14), end: makeDate(1, 15), description: "Demo des nouvelles fonctionnalites", color: '#0b8043' },
              { title: 'Dejeuner client', start: makeDate(2, 12), end: makeDate(2, 14), description: "Discussion renouvellement contrat", color: '#f4511e' },
              { title: 'Formation IA', start: makeDate(3, 10), end: makeDate(3, 12), description: "Session sur les outils IA integres", color: '#8e24aa' },
              { title: 'Point projet', start: makeDate(4, 16), end: makeDate(4, 17), description: "Revue avancement et risques", color: '#f6bf26' },
            ];

            let created = 0;
            for (const evt of events) {
              try {
                await calendarClient.post(`/calendars/${calendarId}/events`, {
                  title: evt.title,
                  description: evt.description,
                  start_time: evt.start,
                  end_time: evt.end,
                  timezone: 'Europe/Paris',
                  color: evt.color,
                });
                created++;
              } catch {
                // Skip duplicate events
              }
            }
            updateStep('calendar', { status: 'done', detail: `${created} evenements crees` });
          } else {
            updateStep('calendar', { status: 'error', detail: 'Impossible de creer le calendrier' });
          }
        }
      } catch {
        updateStep('calendar', { status: 'skipped', detail: 'Service non disponible' });
      }

      // ── Scheduler Jobs ───────────────────────────────────────────────
      updateStep('scheduler', { status: 'running' });
      try {
        const schedHealth = await checkServiceHealth(ServiceName.SCHEDULER);
        if (!schedHealth.healthy) {
          updateStep('scheduler', { status: 'skipped', detail: 'Service non disponible' });
        } else {
          const jobs = [
            {
              name: 'Backup quotidien',
              cron_expression: '0 2 * * *',
              command: 'pg_dump signapps > /tmp/backup_$(date +%Y%m%d).sql',
              description: 'Sauvegarde automatique de la base chaque nuit a 2h',
              target_type: 'host' as const,
              enabled: true,
            },
            {
              name: 'Nettoyage logs',
              cron_expression: '0 3 * * 0',
              command: "find /var/log/signapps -name '*.log' -mtime +30 -delete",
              description: 'Suppression des logs de plus de 30 jours, chaque dimanche',
              target_type: 'host' as const,
              enabled: true,
            },
          ];

          let created = 0;
          for (const job of jobs) {
            try {
              await schedulerClient.post('/jobs', job);
              created++;
            } catch (err: any) {
              if (err?.response?.status !== 409 && err?.response?.status !== 400) {
                // Silently skip
              }
            }
          }
          updateStep('scheduler', { status: 'done', detail: `${created} taches creees` });
        }
      } catch {
        updateStep('scheduler', { status: 'skipped', detail: 'Service non disponible' });
      }

      // ── Storage Documents ────────────────────────────────────────────
      updateStep('storage', { status: 'running' });
      try {
        const storHealth = await checkServiceHealth(ServiceName.STORAGE);
        if (!storHealth.healthy) {
          updateStep('storage', { status: 'skipped', detail: 'Service non disponible' });
        } else {
          // Ensure documents bucket
          try {
            await storageClient.post('/buckets', { name: 'documents' });
          } catch {
            // Bucket may already exist
          }

          const files = [
            {
              name: 'Guide de demarrage.md',
              type: 'text/markdown',
              content: `# Guide de demarrage SignApps\n\nBienvenue sur SignApps, votre plateforme de productivite 100% locale.\n\n## Premiers pas\n\n1. **Mail** — Configurez votre messagerie\n2. **Documents** — Creez des documents collaboratifs\n3. **Calendrier** — Planifiez vos reunions\n4. **Drive** — Gerez vos fichiers\n5. **Chat** — Communiquez avec votre equipe\n\n## Fonctionnalites avancees\n\n- IA integree (assistant, OCR, transcription)\n- Visioconference avec partage ecran\n- Gestion de projet Kanban\n- Formulaires et sondages\n\n---\n*Document de demonstration SignApps*`,
            },
            {
              name: 'Budget exemple.csv',
              type: 'text/csv',
              content: 'Poste,Budget Prevu,Depenses,Restant\nInfrastructure,15000,8500,6500\nLicences,5000,4200,800\nFormation,3000,1500,1500\nMarketing,8000,6000,2000\nSupport,4000,2800,1200\nMateriel,10000,7500,2500\nTOTAL,45000,32500,12500',
            },
            {
              name: 'Presentation SignApps.md',
              type: 'text/markdown',
              content: `# Presentation SignApps\n\n## Vision\n- Souverainete des donnees\n- Performance native\n- Zero dependance cloud\n\n## Modules\n| Module | Description |\n|--------|-------------|\n| Mail | Messagerie |\n| Docs | Edition collaborative |\n| Calendar | Planification |\n| Drive | Stockage |\n| Chat | Messagerie instantanee |\n| AI | Intelligence artificielle |\n\n---\n*Document de demonstration SignApps*`,
            },
          ];

          let created = 0;
          for (const file of files) {
            try {
              const blob = new Blob([file.content], { type: file.type });
              const formData = new FormData();
              formData.append('file', blob, file.name);
              await storageClient.post('/files/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              created++;
            } catch {
              // Skip if already exists
            }
          }
          updateStep('storage', { status: 'done', detail: `${created} documents crees` });
        }
      } catch {
        updateStep('storage', { status: 'skipped', detail: 'Service non disponible' });
      }

      // ── Done ─────────────────────────────────────────────────────────
      setSeedStatus('done');
    } catch (err: any) {
      setSeedStatus('error');
      setErrorMessage(err?.message || 'Une erreur inattendue est survenue');
    }
  }, []);

  const getStatusIcon = (status: SeedStep['status']) => {
    switch (status) {
      case 'pending': return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'skipped': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Bienvenue sur SignApps</DialogTitle>
              <DialogDescription>
                {seedStatus === 'idle' && "C'est votre premiere utilisation. Souhaitez-vous initialiser l'application avec des donnees de demonstration ?"}
                {seedStatus === 'seeding' && "Initialisation en cours..."}
                {seedStatus === 'done' && "L'initialisation est terminee."}
                {seedStatus === 'error' && "Une erreur est survenue pendant l'initialisation."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {seedStatus === 'idle' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Les donnees de demo incluent :
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span>2 utilisateurs de demo (editeur et lecteur)</span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <span>10 contacts professionnels</span>
              </li>
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span>5 evenements pour la semaine en cours</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span>2 taches planifiees (backup, nettoyage)</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <span>3 documents exemples</span>
              </li>
            </ul>
          </div>
        )}

        {(seedStatus === 'seeding' || seedStatus === 'done' || seedStatus === 'error') && (
          <div className="space-y-2 py-2">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3 py-1">
                <div className="flex-shrink-0 w-5 flex justify-center">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="flex-shrink-0">{step.icon}</span>
                  <span className="text-sm truncate">{step.label}</span>
                </div>
                {step.detail && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{step.detail}</span>
                )}
              </div>
            ))}
            {errorMessage && (
              <p className="text-sm text-red-500 mt-2">{errorMessage}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          {seedStatus === 'idle' && (
            <>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDismiss}
                >
                  Non, merci
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSeed}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Initialiser
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={skipFutureChecks}
                  onCheckedChange={(v) => setSkipFutureChecks(v === true)}
                />
                Ne plus afficher ce message
              </label>
            </>
          )}

          {seedStatus === 'seeding' && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initialisation en cours...
            </Button>
          )}

          {seedStatus === 'done' && (
            <Button className="w-full" onClick={handleSeedComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Commencer a utiliser SignApps
            </Button>
          )}

          {seedStatus === 'error' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                Fermer
              </Button>
              <Button className="flex-1" onClick={handleSeed}>
                Reessayer
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
