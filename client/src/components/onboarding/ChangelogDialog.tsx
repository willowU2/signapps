'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
  improvements: string[];
  fixes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.6.0',
    date: '2026-03-29',
    highlights: [
      'Thèmes personnalisables : couleur primaire, taille de police, mode compact, coins arrondis',
      'Transitions de pages fluides avec animations fade-in',
      'Micro-interactions : boutons, cartes, sidebar, toasts',
      'Améliorations accessibilité WCAG AA (focus, contraste, aria-live)',
    ],
    improvements: [
      'Page /settings/appearance avec prévisualisation en temps réel',
      'Indicateurs de focus visibles sur tous les éléments interactifs',
      'Animations respectent prefers-reduced-motion',
    ],
    fixes: [
      'Animation de page ne se déclenchait qu\'au premier chargement',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-03-28',
    highlights: [
      'Activité globale cross-modules avec filtres avancés',
      'Tags universels sur tous les types d\'entités',
      'Favoris cross-modules avec page dédiée',
      'Corbeille unifiée multi-modules',
      'Automatisations inter-modules',
    ],
    improvements: [
      'Palette de couleurs dérivée automatiquement depuis la couleur primaire',
      'Bibliothèque de thèmes prédéfinis (Pastel, Ocean, Forest, Sunset, Midnight)',
      'Mode densité compact/confortable/aéré',
      'CSS personnalisé par utilisateur injecté à l\'exécution',
    ],
    fixes: [
      'Correction du rechargement du module de présence',
      'Fix du timer de session inactif',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-02-15',
    highlights: [
      'Système XP avec niveaux et gains par action',
      'Badges de réalisation débloqués automatiquement',
      'Streaks de productivité quotidiens',
      'Classement d\'équipe hebdomadaire',
    ],
    improvements: [
      'Onboarding interactif avec wizard multi-étapes',
      'Mode sombre granulaire par module',
      'Logo et nom d\'instance personnalisables',
    ],
    fixes: [
      'Amélioration des performances du feed d\'activités',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-03-01',
    highlights: [
      'AI Multimodal Gateway (10 capabilities)',
      'Mail intégré avec Mailpit',
      'Import Excel complet',
      '41+ pages fonctionnelles',
      'PWA support',
    ],
    improvements: [],
    fixes: [],
  },
];

const SEEN_KEY = 'signapps-changelog-seen';

export function ChangelogDialog() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen !== CHANGELOG[0].version) {
      setHasNew(true);
      // Auto-show after 2s on first visit with new version
      const t = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    localStorage.setItem(SEEN_KEY, CHANGELOG[0].version);
    setHasNew(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground relative"
      >
        <Sparkles className="w-4 h-4" />
        Nouveautés
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={v => { if (!v) dismiss(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Quoi de neuf ?
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-2">
              {CHANGELOG.map((entry, idx) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={idx === 0 ? 'default' : 'outline'}>v{entry.version}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {idx === 0 && <Badge variant="secondary" className="text-xs">Dernière version</Badge>}
                  </div>

                  {entry.highlights.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1">
                        <Star className="w-3 h-3" /> NOUVEAUTÉS
                      </p>
                      <ul className="space-y-1">
                        {entry.highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.improvements.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">AMÉLIORATIONS</p>
                      <ul className="space-y-1">
                        {entry.improvements.map((imp, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5">•</span>
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.fixes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">CORRECTIONS</p>
                      <ul className="space-y-1">
                        {entry.fixes.map((fix, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5">•</span>
                            {fix}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-2">
            <Button onClick={dismiss}>Compris !</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
