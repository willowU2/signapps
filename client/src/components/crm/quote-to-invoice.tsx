"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Check, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface QuoteToInvoiceProps {
  id: string;
  quoteRef: string;
  clientName: string;
  amount: number;
  currentStep: "quote" | "accepted" | "invoice" | "paid";
  quoteDate: string;
  onConvertToInvoice: (quoteId: string) => Promise<void>;
  isLoading?: boolean;
}

const STEPS = [
  { id: "quote", label: "Devis", icon: FileText },
  { id: "accepted", label: "Accepté", icon: Check },
  { id: "invoice", label: "Facture", icon: FileText },
  { id: "paid", label: "Payée", icon: Check },
] as const;

const STEP_COLORS: Record<string, string> = {
  quote: "bg-slate-100 text-slate-800",
  accepted: "bg-blue-100 text-blue-800",
  invoice: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export function QuoteToInvoice({
  id,
  quoteRef,
  clientName,
  amount,
  currentStep,
  quoteDate,
  onConvertToInvoice,
  isLoading = false,
}: QuoteToInvoiceProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const formattedAmount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
  const formattedDate = format(parseISO(quoteDate), "d MMM yyyy", {
    locale: fr,
  });
  const canConvert = currentStep === "accepted";

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Ref. Devis</p>
          <h3 className="font-semibold text-foreground truncate">{quoteRef}</h3>
          <p className="text-sm text-muted-foreground mt-1">{clientName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Montant</p>
          <p className="text-xl font-bold text-emerald-600">
            {formattedAmount}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Progression
        </p>
        <div className="flex items-center gap-1">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step circle */}
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold flex-shrink-0 ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? `${STEP_COLORS[step.id]}`
                        : "bg-gray-200 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>

                {/* Arrow between steps */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 ${isCompleted ? "bg-emerald-600" : "bg-gray-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step labels */}
        <div className="flex gap-1 text-xs text-muted-foreground">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex-1">
              <p
                className={
                  index === currentStepIndex
                    ? "font-semibold text-foreground"
                    : ""
                }
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Meta info */}
      <div className="text-xs text-muted-foreground flex items-center justify-between py-2 border-t">
        <span>Créé le: {formattedDate}</span>
        <Badge variant="outline" className={STEP_COLORS[currentStep]}>
          {currentStep === "quote" && "En Attente"}
          {currentStep === "accepted" && "Accepté"}
          {currentStep === "invoice" && "Facturé"}
          {currentStep === "paid" && "Payé"}
        </Badge>
      </div>

      {/* Action Button */}
      {canConvert && (
        <Button
          onClick={() => onConvertToInvoice(id)}
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          {isLoading ? "Conversion en cours..." : "Convertir en Facture"}
        </Button>
      )}

      {!canConvert && currentStep !== "paid" && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {currentStep === "quote" && "En attente d'acceptation du client"}
          {currentStep === "invoice" &&
            "Facture générée. En attente de paiement."}
        </p>
      )}

      {currentStep === "paid" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            ✓ Devis complètement traité
          </p>
        </div>
      )}
    </Card>
  );
}
