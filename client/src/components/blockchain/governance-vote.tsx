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
import { ThumbsUp, ThumbsDown, Circle } from "lucide-react";

interface GovernanceVoteProps {
  proposalId: string;
  title: string;
  description: string;
  deadline: Date;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  userVote?: "for" | "against" | "abstain" | null;
}

export const GovernanceVote: React.FC<GovernanceVoteProps> = ({
  proposalId,
  title,
  description,
  deadline,
  votesFor,
  votesAgainst,
  votesAbstain,
  userVote = null,
}) => {
  const [selectedVote, setSelectedVote] = useState<
    "for" | "against" | "abstain" | null
  >(userVote);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalVotes = votesFor + votesAgainst + votesAbstain || 1;
  const forPercentage = (votesFor / totalVotes) * 100;
  const againstPercentage = (votesAgainst / totalVotes) * 100;
  const abstainPercentage = (votesAbstain / totalVotes) * 100;

  const isDeadlinePassed = deadline < new Date();
  const daysRemaining = Math.ceil(
    (deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleVote = async (vote: "for" | "against" | "abstain") => {
    setIsSubmitting(true);
    try {
      setSelectedVote(vote);
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge
            variant={isDeadlinePassed ? "destructive" : "secondary"}
            className="whitespace-nowrap"
          >
            {isDeadlinePassed ? "Closed" : `${daysRemaining}d left`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Vote Results */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Results</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ThumbsUp className="size-4 text-green-600" />
                Pour
              </span>
              <span className="font-medium">{votesFor}</span>
            </div>
            <Progress value={forPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">{forPercentage.toFixed(1)}%</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ThumbsDown className="size-4 text-red-600" />
                Contre
              </span>
              <span className="font-medium">{votesAgainst}</span>
            </div>
            <Progress value={againstPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">{againstPercentage.toFixed(1)}%</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Circle className="size-4 text-gray-600" />
                Abstention
              </span>
              <span className="font-medium">{votesAbstain}</span>
            </div>
            <Progress value={abstainPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">{abstainPercentage.toFixed(1)}%</p>
          </div>
        </div>

        {/* Vote Buttons */}
        {!isDeadlinePassed && (
          <div className="grid grid-cols-3 gap-2 pt-4 border-t">
            <Button
              variant={selectedVote === "for" ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote("for")}
              disabled={isSubmitting}
              className="w-full"
            >
              <ThumbsUp className="size-4" />
              Pour
            </Button>
            <Button
              variant={selectedVote === "against" ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote("against")}
              disabled={isSubmitting}
              className="w-full"
            >
              <ThumbsDown className="size-4" />
              Contre
            </Button>
            <Button
              variant={selectedVote === "abstain" ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote("abstain")}
              disabled={isSubmitting}
              className="w-full"
            >
              <Circle className="size-4" />
              Abstenir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
