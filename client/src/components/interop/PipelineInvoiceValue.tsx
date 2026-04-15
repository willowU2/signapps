"use client";
// Feature 8: CRM pipeline → show total invoice value per stage
// Feature 20: CRM report → include billing revenue data

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCrmRevenueSummary } from "@/lib/api/interop";
import { STAGE_LABELS } from "@/lib/api/crm";

const STAGE_COLORS: Record<string, string> = {
  prospect: "#94a3b8",
  qualified: "#60a5fa",
  proposal: "#fbbf24",
  negotiation: "#f97316",
  won: "#10b981",
  lost: "#ef4444",
};

const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`);

const fmtFull = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

export function PipelineInvoiceValue() {
  const [data, setData] = useState<
    {
      stage: string;
      dealCount: number;
      dealValue: number;
      invoicedAmount: number;
      paidAmount: number;
      stageName: string;
    }[]
  >([]);
  useEffect(() => {
    getCrmRevenueSummary().then((summary) => {
      setData(
        summary
          .filter((r) => r.dealCount > 0 || r.invoicedAmount > 0)
          .map((r) => ({
            ...r,
            stageName:
              STAGE_LABELS[r.stage as keyof typeof STAGE_LABELS] ?? r.stage,
          })),
      );
    });
  }, []);

  const totalInvoiced = data.reduce((s, r) => s + r.invoicedAmount, 0);
  const totalPaid = data.reduce((s, r) => s + r.paidAmount, 0);
  const totalDeals = data.reduce((s, r) => s + r.dealValue, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pipeline total</p>
            <p className="text-lg font-bold text-primary">
              {fmtFull(totalDeals)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total facturé</p>
            <p className="text-lg font-bold text-amber-600">
              {fmtFull(totalInvoiced)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total encaissé</p>
            <p className="text-lg font-bold text-emerald-600">
              {fmtFull(totalPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Facturation par étape</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} barGap={4}>
                <XAxis dataKey="stageName" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: unknown) => [fmtFull(Number(value)), ""]}
                  labelFormatter={(l: unknown) => `Étape: ${String(l)}`}
                />
                <Bar
                  dataKey="invoicedAmount"
                  name="Facturé"
                  radius={[3, 3, 0, 0]}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.stage}
                      fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"}
                      opacity={0.7}
                    />
                  ))}
                </Bar>
                <Bar dataKey="paidAmount" name="Payé" radius={[3, 3, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.stage}
                      fill={STAGE_COLORS[entry.stage] ?? "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {data.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-4">
          Créez des deals et factures pour voir les données de facturation par
          étape.
        </p>
      )}
    </div>
  );
}
