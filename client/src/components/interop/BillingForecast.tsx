"use client";
// Feature 25: CRM forecast → based on billing history

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getBillingEnrichedForecast } from "@/lib/api/interop";
import { dealsApi, type Deal } from "@/lib/api/crm";

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

const fmtPct = (v: number) => `${v.toFixed(0)}%`;

interface Props {
  contactEmail?: string;
}

const DEFAULT_FORECAST = {
  avgDealValue: 0,
  totalPaid: 0,
  wonDealsCount: 0,
  paymentRate: 0,
};

export function BillingForecast({ contactEmail }: Props) {
  const [forecast, setForecast] = useState(DEFAULT_FORECAST);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);

  useEffect(() => {
    getBillingEnrichedForecast(contactEmail).then(setForecast);
  }, [contactEmail]);

  useEffect(() => {
    dealsApi.list().then(setAllDeals);
  }, []);

  const activeDeals = useMemo(() => {
    const active = allDeals.filter(
      (d) => d.stage !== "lost" && d.stage !== "won",
    );
    if (contactEmail) {
      return active.filter(
        (d) => d.contactEmail?.toLowerCase() === contactEmail.toLowerCase(),
      );
    }
    return active;
  }, [allDeals, contactEmail]);

  const weightedForecast = activeDeals.reduce(
    (s, d) => s + (d.value * d.probability) / 100,
    0,
  );
  const bestCase = activeDeals.reduce((s, d) => s + d.value, 0);

  const adjustedForecast =
    forecast.paymentRate > 0
      ? weightedForecast * (forecast.paymentRate / 100)
      : weightedForecast;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <BarChart2 className="h-3 w-3" /> Prévisions enrichies
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Prévision pondérée</p>
            <p className="text-lg font-bold text-primary">
              {fmt(weightedForecast)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeDeals.length} deals actifs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Best case</p>
            <p className="text-lg font-bold text-amber-600">{fmt(bestCase)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">
              Taux paiement historique
            </p>
            <p className="text-lg font-bold text-emerald-600">
              {fmtPct(forecast.paymentRate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Prévision ajustée</p>
            <p className="text-lg font-bold">{fmt(adjustedForecast)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              × taux paiement
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Deals gagnés (histor.)
          </p>
          <p className="text-sm font-bold">{forecast.wonDealsCount}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Valeur moy. deal gagné
          </p>
          <p className="text-sm font-bold">{fmt(forecast.avgDealValue)}</p>
        </div>
      </div>
    </div>
  );
}
