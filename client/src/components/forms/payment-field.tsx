"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Lock, CheckCircle } from "lucide-react";

// ── Types ──
export interface PaymentFieldConfig {
  amount: number;
  currency: string;
  description?: string;
  required?: boolean;
}

export interface PaymentFieldValue {
  status: "pending" | "processing" | "completed" | "failed";
  sessionId?: string;
  paymentIntentId?: string;
}

interface PaymentFieldProps {
  config: PaymentFieldConfig;
  value?: PaymentFieldValue;
  onChange?: (value: PaymentFieldValue) => void;
  onPaymentRequired?: (config: PaymentFieldConfig) => Promise<string | null>;
  disabled?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
};

/**
 * PaymentField — a form field type that gates form submission behind a Stripe checkout.
 *
 * Usage in a form:
 *   <PaymentField
 *     config={{ amount: 4900, currency: 'EUR', description: 'Abonnement mensuel' }}
 *     onPaymentRequired={async (cfg) => {
 *       // Create Stripe checkout session, return session ID or null
 *       const session = await formsApi.createPaymentSession(cfg);
 *       if (session) window.location.href = session.checkoutUrl;
 *       return session?.id ?? null;
 *     }}
 *   />
 *
 * When the form is submitted, check value.status === 'completed' before proceeding.
 */
export function PaymentField({
  config,
  value,
  onChange,
  onPaymentRequired,
  disabled = false,
}: PaymentFieldProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = value?.status ?? "pending";
  const currencySymbol = CURRENCY_SYMBOLS[config.currency] ?? config.currency;
  const displayAmount = (config.amount / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handlePay = async () => {
    if (!onPaymentRequired) {
      onChange?.({
        status: "completed",
        paymentIntentId: "demo_pi_" + Date.now(),
      });
      return;
    }
    setLoading(true);
    setError(null);
    onChange?.({ status: "processing" });
    try {
      const sessionId = await onPaymentRequired(config);
      if (sessionId) {
        onChange?.({ status: "completed", sessionId });
      } else {
        setError("Le paiement n'a pas pu etre initie. Veuillez reessayer.");
        onChange?.({ status: "failed" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de paiement";
      setError(msg);
      onChange?.({ status: "failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className={`border-2 transition-colors ${
        status === "completed"
          ? "border-green-400"
          : status === "failed"
            ? "border-red-400"
            : "border-border"
      }`}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                status === "completed" ? "bg-green-100" : "bg-primary/10"
              }`}
            >
              {status === "completed" ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <CreditCard className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">
                {config.description ?? "Paiement requis"}
              </div>
              <div className="text-lg font-bold text-primary">
                {currencySymbol}
                {displayAmount}
              </div>
              {config.required && (
                <div className="text-xs text-muted-foreground">
                  Requis pour soumettre le formulaire
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {status === "completed" ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Paye
              </Badge>
            ) : status === "processing" ? (
              <Badge variant="secondary" className="animate-pulse">
                Traitement...
              </Badge>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                disabled={disabled || loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Payer ${currencySymbol}${displayAmount}`}
              >
                <Lock className="w-3 h-3" />
                {loading ? "Redirection..." : "Payer maintenant"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mt-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"
            role="alert"
          >
            {error}
          </div>
        )}

        {status === "completed" && value?.paymentIntentId && (
          <div className="mt-3 text-xs text-muted-foreground font-mono">
            Ref: {value.paymentIntentId}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          Paiement securise via Stripe — vos donnees sont protegees
        </div>
      </CardContent>
    </Card>
  );
}
