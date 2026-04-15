"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GripVertical, Trash2 } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  stage: "applied" | "screening" | "interview" | "offer" | "hired";
}

interface ApplicantTrackerProps {
  candidates?: Candidate[];
  onRemoveCandidate?: (id: string) => void;
  onMoveCandidate?: (id: string, newStage: string) => void;
}

export function ApplicantTracker({
  candidates = [
    { id: "1", name: "Marie Dupont", stage: "applied" },
    { id: "2", name: "Pierre Bernard", stage: "screening" },
    { id: "3", name: "Sophie Laurent", stage: "screening" },
    { id: "4", name: "Jean Martin", stage: "interview" },
    { id: "5", name: "Alice Moreau", stage: "interview" },
    { id: "6", name: "Thomas Petit", stage: "offer" },
    { id: "7", name: "Claire Durand", stage: "hired" },
  ],
  onRemoveCandidate,
  onMoveCandidate,
}: ApplicantTrackerProps) {
  const stages = [
    {
      key: "applied",
      label: "Candidatures",
      icon: "📬",
      color: "bg-blue-50 border-blue-200",
    },
    {
      key: "screening",
      label: "Pré-sélection",
      icon: "🔍",
      color: "bg-yellow-50 border-yellow-200",
    },
    {
      key: "interview",
      label: "Entretien",
      icon: "💬",
      color: "bg-purple-50 border-purple-200",
    },
    {
      key: "offer",
      label: "Offre",
      icon: "🎁",
      color: "bg-orange-50 border-orange-200",
    },
    {
      key: "hired",
      label: "Embauché",
      icon: "✅",
      color: "bg-green-50 border-green-200",
    },
  ];

  const getStageCount = (stage: string) => {
    return candidates.filter((c) => c.stage === stage).length;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getStageColor = (stage: string) => {
    const colorMap: Record<string, string> = {
      applied: "bg-blue-100 text-blue-800",
      screening: "bg-yellow-100 text-yellow-800",
      interview: "bg-purple-100 text-purple-800",
      offer: "bg-orange-100 text-orange-800",
      hired: "bg-green-100 text-green-800",
    };
    return colorMap[stage] || "bg-muted text-gray-800";
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Suivi des Candidatures</h2>

      {/* Kanban Board */}
      <div className="grid gap-4 overflow-x-auto lg:grid-cols-5">
        {stages.map((stageConfig) => {
          const stageCandidates = candidates.filter(
            (c) => c.stage === stageConfig.key,
          );

          return (
            <div
              key={stageConfig.key}
              className={`min-w-80 rounded-lg border-2 p-4 ${stageConfig.color}`}
            >
              {/* Column Header */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{stageConfig.icon}</span>
                  <h3 className="font-semibold">{stageConfig.label}</h3>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className="bg-gray-200 text-gray-800">
                    {getStageCount(stageConfig.key)} candidats
                  </Badge>
                </div>
              </div>

              {/* Candidate Cards */}
              <div className="space-y-3">
                {stageCandidates.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className="relative cursor-move bg-card p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Avatar className="mb-2 h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(candidate.name)}
                              </AvatarFallback>
                            </Avatar>
                            <p className="break-words font-medium text-sm">
                              {candidate.name}
                            </p>
                          </div>
                          <button
                            onClick={() => onRemoveCandidate?.(candidate.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <Badge
                          className={`mt-2 ${getStageColor(candidate.stage)}`}
                        >
                          {stageConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Empty State */}
                {stageCandidates.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Pas de candidat à cette étape
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <Card className="border-l-4 border-l-blue-500 p-6">
        <div className="grid gap-4 md:grid-cols-5">
          {stages.map((stageConfig) => (
            <div key={stageConfig.key} className="text-center">
              <p className="text-3xl font-bold">
                {getStageCount(stageConfig.key)}
              </p>
              <p className="text-sm text-muted-foreground">
                {stageConfig.label}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
