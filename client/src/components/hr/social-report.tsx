"use client";

/**
 * Social Report Component
 *
 * Displays HR KPIs: effectifs, parity H/F %, training hours, turnover rate.
 * Includes export PDF button.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Users, TrendingUp, BookOpen, UserX } from "lucide-react";
import { toast } from "sonner";

export interface SocialReportData {
  totalEmployees: number;
  femalePercentage: number;
  trainingHours: number;
  turnoverRate: number;
  newHires: number;
  departures: number;
  lastUpdated: Date;
}

export interface SocialReportProps {
  data: SocialReportData;
  onExportPDF?: () => void;
}

function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendLabel,
  color,
}: {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color: string;
}) {
  const getTrendColor = () => {
    if (trend === "up") return "text-green-600";
    if (trend === "down") return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${color}`}>{Icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold">
            {value}
            {unit && <span className="text-lg font-semibold ml-1">{unit}</span>}
          </div>
          {trendLabel && (
            <p className={`text-xs font-medium ${getTrendColor()}`}>
              {trend === "up" && "↑ "}
              {trend === "down" && "↓ "}
              {trendLabel}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SocialReport({ data, onExportPDF }: SocialReportProps) {
  const malePercentage = 100 - data.femalePercentage;
  const avgTrainingPerEmployee = (
    data.trainingHours / data.totalEmployees
  ).toFixed(1);

  const handleExport = async () => {
    try {
      onExportPDF?.();
      toast.success("Rapport en cours de téléchargement");
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Rapport Social</h2>
        <Button
          onClick={handleExport}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Télécharger PDF
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Effectifs Total"
          value={data.totalEmployees}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          color="bg-blue-100"
          trendLabel={`+${data.newHires} embauche${data.newHires > 1 ? "s" : ""}`}
          trend="up"
        />

        <KPICard
          title="Parité H/F (Femmes)"
          value={data.femalePercentage}
          unit="%"
          icon={
            <div className="flex items-center gap-1">
              <div className="w-2 h-4 bg-pink-500 rounded"></div>
              <div className="w-2 h-4 bg-blue-500 rounded"></div>
            </div>
          }
          color="bg-purple-100"
        />

        <KPICard
          title="Heures de Formation"
          value={data.trainingHours}
          unit="h"
          icon={<BookOpen className="w-5 h-5 text-orange-600" />}
          color="bg-orange-100"
          trendLabel={`${avgTrainingPerEmployee}h/pers.`}
          trend="neutral"
        />

        <KPICard
          title="Taux de Turnover"
          value={data.turnoverRate}
          unit="%"
          icon={<UserX className="w-5 h-5 text-red-600" />}
          color="bg-red-100"
          trendLabel={`${data.departures} départ${data.departures > 1 ? "s" : ""}`}
          trend="down"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composition de l'Effectif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Femmes</p>
              <Badge variant="outline">{data.femalePercentage}%</Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-pink-500 h-full transition-all"
                style={{ width: `${data.femalePercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Hommes</p>
              <Badge variant="outline">{malePercentage}%</Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${malePercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mouvements RH</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-700 mb-1">
                Nouvelles Embauches
              </p>
              <p className="text-2xl font-bold text-green-600">
                {data.newHires}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-700 mb-1">Départs</p>
              <p className="text-2xl font-bold text-red-600">
                {data.departures}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Dernière mise à jour :{" "}
        {data.lastUpdated.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
