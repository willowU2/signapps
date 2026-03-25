'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Rocket, Users, FileText, Mail, Calendar } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; href: string };
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur SignApps',
    description: 'Votre suite collaborative 100% locale et gratuite. Découvrez les fonctionnalités principales.',
    icon: <Rocket className="h-8 w-8 text-primary" />,
  },
  {
    id: 'mail',
    title: 'Configurez votre messagerie',
    description: 'Envoyez et recevez des emails directement depuis SignApps.',
    icon: <Mail className="h-8 w-8 text-blue-500" />,
    action: { label: 'Aller à Mail', href: '/mail' },
  },
  {
    id: 'docs',
    title: 'Créez vos documents',
    description: 'Éditeur collaboratif en temps réel pour docs, tableurs et présentations.',
    icon: <FileText className="h-8 w-8 text-green-500" />,
    action: { label: 'Créer un doc', href: '/docs' },
  },
  {
    id: 'calendar',
    title: 'Planifiez vos événements',
    description: 'Calendrier partagé avec gestion des ressources et salles.',
    icon: <Calendar className="h-8 w-8 text-orange-500" />,
    action: { label: 'Voir le calendrier', href: '/cal' },
  },
  {
    id: 'team',
    title: 'Invitez votre équipe',
    description: 'Ajoutez des utilisateurs et configurez les espaces de travail.',
    icon: <Users className="h-8 w-8 text-purple-500" />,
    action: { label: 'Gérer les utilisateurs', href: '/admin/users' },
  },
];

const STORAGE_KEY = 'signapps-onboarding-completed';

export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <DialogTitle className="flex items-center gap-3">
            {current.icon}
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mt-2">{current.description}</p>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" onClick={handleComplete} className="text-muted-foreground">
            Passer
          </Button>
          <div className="flex gap-2">
            {current.action && (
              <Button variant="outline" size="sm" asChild>
                <a href={current.action.href}>{current.action.label}</a>
              </Button>
            )}
            <Button onClick={handleNext} className="gap-1.5">
              {step < STEPS.length - 1 ? (
                <>Suivant <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Terminé <CheckCircle2 className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
