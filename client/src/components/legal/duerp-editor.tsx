'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

interface AssessedRisk {
  id: string;
  workUnitName: string;
  riskDescription: string;
  frequency: number;
  severity: number;
  riskScore: number;
  actionPlan: string;
  createdAt: Date;
}

export function DuerpEditor() {
  const [risks, setRisks] = useState<AssessedRisk[]>([]);
  const [workUnitName, setWorkUnitName] = useState('');
  const [riskDescription, setRiskDescription] = useState('');
  const [frequency, setFrequency] = useState(3);
  const [severity, setSeverity] = useState(3);
  const [actionPlan, setActionPlan] = useState('');

  const riskScore = frequency * severity;

  const handleAddRisk = () => {
    if (!workUnitName.trim() || !riskDescription.trim() || !actionPlan.trim()) {
      return;
    }

    const newRisk: AssessedRisk = {
      id: `risk-${Date.now()}`,
      workUnitName: workUnitName.trim(),
      riskDescription: riskDescription.trim(),
      frequency,
      severity,
      riskScore,
      actionPlan: actionPlan.trim(),
      createdAt: new Date(),
    };

    setRisks((prev) => [...prev, newRisk].sort((a, b) => b.riskScore - a.riskScore));
    resetForm();
  };

  const handleDeleteRisk = (id: string) => {
    setRisks((prev) => prev.filter((risk) => risk.id !== id));
  };

  const resetForm = () => {
    setWorkUnitName('');
    setRiskDescription('');
    setFrequency(3);
    setSeverity(3);
    setActionPlan('');
  };

  const getSeverityColor = (score: number) => {
    if (score <= 5) return 'bg-green-100 text-green-800';
    if (score <= 12) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une Évaluation de Risque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Unité de Travail</label>
            <Input
              placeholder="Ex: Production, Logistique, RH..."
              value={workUnitName}
              onChange={(e) => setWorkUnitName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description du Risque</label>
            <Textarea
              placeholder="Détailler le risque identifié..."
              value={riskDescription}
              onChange={(e) => setRiskDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Fréquence: {frequency}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">1 = Rare, 5 = Très fréquent</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Sévérité: {severity}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">1 = Mineure, 5 = Critique</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Score de Risque (Fréquence × Sévérité): {riskScore}
            </label>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className={`h-full transition-all ${getSeverityColor(riskScore)}`}
                style={{ width: `${(riskScore / 25) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Plan d'Action</label>
            <Textarea
              placeholder="Mesures à mettre en place pour réduire le risque..."
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            onClick={handleAddRisk}
            disabled={!workUnitName.trim() || !riskDescription.trim() || !actionPlan.trim()}
            className="w-full"
          >
            Enregistrer l'Évaluation
          </Button>
        </CardContent>
      </Card>

      {/* Risks List Section */}
      {risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risques Évalués ({risks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {risks.map((risk) => (
                <div
                  key={risk.id}
                  className="border rounded-lg p-4 hover:bg-muted transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{risk.workUnitName}</h3>
                      <p className="text-sm text-muted-foreground">{risk.riskDescription}</p>
                    </div>
                    <Badge className={`${getSeverityColor(risk.riskScore)} ml-2`}>
                      Score: {risk.riskScore}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <span className="text-muted-foreground">
                      Fréquence: <strong>{risk.frequency}/5</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Sévérité: <strong>{risk.severity}/5</strong>
                    </span>
                  </div>

                  <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
                    <p className="text-muted-foreground">
                      <strong>Plan d'action:</strong> {risk.actionPlan}
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {risk.createdAt.toLocaleString('fr-FR')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRisk(risk.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
