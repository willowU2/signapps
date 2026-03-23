"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock4 } from "lucide-react";

interface VotingOption {
  id: string;
  label: string;
  votes: number;
  percentage: number;
}

interface InternalConsensusProps {
  decisionId: string;
  question: string;
  options: VotingOption[];
  quorumRequired: number;
  quorumMet: boolean;
  totalVoters: number;
  votedCount: number;
  status: "active" | "closed";
  selectedOptionId?: string;
}

export const InternalConsensus: React.FC<InternalConsensusProps> = ({
  decisionId,
  question,
  options,
  quorumRequired,
  quorumMet,
  totalVoters,
  votedCount,
  status,
  selectedOptionId,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | undefined>(
    selectedOptionId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quorumPercentage = (votedCount / totalVoters) * 100;
  const leadingOption = [...options].sort((a, b) => b.votes - a.votes)[0];

  const handleVote = async (optionId: string) => {
    if (status !== "active") return;
    setIsSubmitting(true);
    try {
      setSelectedOption(optionId);
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuorumStatus = () => {
    const percentage = (votedCount / totalVoters) * 100;
    if (percentage >= quorumRequired) {
      return (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <CheckCircle2 className="size-4" />
          <span className="text-sm font-medium">Quorum atteint</span>
        </div>
      );
    }
    const remaining = Math.ceil(totalVoters * (quorumRequired / 100)) - votedCount;
    return (
      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
        <Clock4 className="size-4" />
        <span className="text-sm font-medium">
          {remaining} vote{remaining !== 1 ? "s" : ""} manquant{remaining !== 1 ? "s" : ""}
        </span>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Consensus Interne
          </CardTitle>
          <CardDescription>{question}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Voting Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Options de vote</h3>
          <div className="space-y-3">
            {options.map((option) => (
              <div
                key={option.id}
                className={`border rounded-lg p-3 transition-all cursor-pointer ${
                  selectedOption === option.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
                }`}
                onClick={() => {
                  if (status === "active") {
                    handleVote(option.id);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{option.label}</span>
                      {option.id === leadingOption?.id && (
                        <Badge variant="secondary" className="text-xs">
                          En tête
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {option.votes}
                  </span>
                </div>

                <Progress value={option.percentage} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">
                  {option.percentage.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quorum Indicator */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Quorum</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {votedCount} / {totalVoters} votants
              </span>
              <span className="font-medium">{quorumRequired}% requis</span>
            </div>
            <Progress value={quorumPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {quorumPercentage.toFixed(1)}% de participation
            </p>
          </div>

          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            {getQuorumStatus()}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">État</span>
          <Badge
            variant={status === "active" ? "secondary" : "outline"}
            className="whitespace-nowrap"
          >
            {status === "active" ? "Actif" : "Fermé"}
          </Badge>
        </div>

        {/* Action Message */}
        {status === "active" && !selectedOption && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            Cliquez sur une option pour voter
          </div>
        )}

        {selectedOption && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
            <CheckCircle2 className="size-4 flex-shrink-0" />
            <span>Votre vote a été enregistré</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
