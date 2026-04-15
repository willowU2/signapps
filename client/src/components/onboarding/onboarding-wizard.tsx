"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  ArrowRight,
  Rocket,
  Users,
  FileText,
  Mail,
  Calendar,
} from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = getClient(ServiceName.IDENTITY);

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; href: string };
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bienvenue sur SignApps",
    description:
      "Votre suite collaborative 100% locale et gratuite. Decouvrez les fonctionnalites principales.",
    icon: <Rocket className="h-8 w-8 text-primary" />,
  },
  {
    id: "mail",
    title: "Configurez votre messagerie",
    description: "Envoyez et recevez des emails directement depuis SignApps.",
    icon: <Mail className="h-8 w-8 text-blue-500" />,
    action: { label: "Aller a Mail", href: "/mail" },
  },
  {
    id: "docs",
    title: "Creez vos documents",
    description:
      "Editeur collaboratif en temps reel pour docs, tableurs et presentations.",
    icon: <FileText className="h-8 w-8 text-green-500" />,
    action: { label: "Creer un doc", href: "/docs" },
  },
  {
    id: "calendar",
    title: "Planifiez vos evenements",
    description: "Calendrier partage avec gestion des ressources et salles.",
    icon: <Calendar className="h-8 w-8 text-orange-500" />,
    action: { label: "Voir le calendrier", href: "/cal" },
  },
  {
    id: "team",
    title: "Invitez votre equipe",
    description:
      "Ajoutez des utilisateurs et configurez les espaces de travail.",
    icon: <Users className="h-8 w-8 text-purple-500" />,
    action: { label: "Gerer les utilisateurs", href: "/admin/users" },
  },
];

const STORAGE_KEY = "signapps-onboarding-completed";
const DISMISSED_KEY = "signapps-onboarding-dismissed";

export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  useEffect(() => {
    // If permanently dismissed, never show
    const permanentlyDismissed = localStorage.getItem(DISMISSED_KEY);
    if (permanentlyDismissed === "true") return;

    // Check API first, then localStorage
    const check = async () => {
      try {
        const res = await identityClient.get<{
          onboarding_completed_at?: string | null;
        }>("/users/me/profile");
        if (res.data?.onboarding_completed_at) {
          // Already completed per server -- sync local
          localStorage.setItem(STORAGE_KEY, res.data.onboarding_completed_at);
          return;
        }
      } catch {
        // Fall through to localStorage check
      }
      const completed = localStorage.getItem(STORAGE_KEY);
      if (!completed) {
        const timer = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(timer);
      }
    };
    check();
  }, []);

  const handleComplete = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    if (neverShowAgain) {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
    identityClient
      .patch("/users/me/profile", { onboarding_completed_at: now })
      .catch(() => {});
    setOpen(false);
  }, [neverShowAgain]);

  const handleDismiss = useCallback(() => {
    if (neverShowAgain) {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    setOpen(false);
  }, [neverShowAgain]);

  // Escape key to dismiss
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleDismiss]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const current = STEPS[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleDismiss();
      }}
    >
      <DialogContent
        className="sm:max-w-[420px]"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleDismiss();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <DialogTitle className="flex items-center gap-3">
            {current.icon}
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mt-2">
          {current.description}
        </p>

        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            id="never-show"
            checked={neverShowAgain}
            onCheckedChange={(checked) => setNeverShowAgain(checked === true)}
          />
          <label
            htmlFor="never-show"
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Ne plus afficher
          </label>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
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
                <>
                  Suivant <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Termine <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
