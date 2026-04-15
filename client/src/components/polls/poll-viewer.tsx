"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PollData, PollType } from "./poll-creator";

export interface PollVote {
  optionIds: string[];
  userId: string;
}

interface PollViewerProps {
  poll: PollData;
  votes?: PollVote[];
  onVote?: (optionIds: string[]) => void;
  currentUserId?: string;
}

export function PollViewer({
  poll,
  votes = [],
  onVote,
  currentUserId = "guest",
}: PollViewerProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);

  const userVote = votes.find((v) => v.userId === currentUserId);

  const getTotalVotes = (): number => {
    return votes.length;
  };

  const getOptionVoteCount = (optionId: string): number => {
    return votes.filter((v) => v.optionIds.includes(optionId)).length;
  };

  const getPercentage = (count: number): number => {
    const total = getTotalVotes();
    return total === 0 ? 0 : Math.round((count / total) * 100);
  };

  const handleVote = () => {
    if (selectedOptions.length === 0) return;
    onVote?.(selectedOptions);
    setHasVoted(true);
    setSelectedOptions([]);
  };

  const handleSingleSelect = (optionId: string) => {
    setSelectedOptions([optionId]);
  };

  const handleMultipleSelect = (optionId: string, checked: boolean) => {
    if (checked) {
      setSelectedOptions([...selectedOptions, optionId]);
    } else {
      setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
    }
  };

  const totalVotes = getTotalVotes();
  const canVote = !hasVoted && !userVote;

  return (
    <Card className="w-full max-w-2xl p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-2">{poll.question}</h3>
        <p className="text-xs text-muted-foreground">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </p>
      </div>

      <div className="space-y-4">
        {poll.options.map((option) => {
          const voteCount = getOptionVoteCount(option.id);
          const percentage = getPercentage(voteCount);
          const isSelected = selectedOptions.includes(option.id);
          const isUserVote = userVote?.optionIds.includes(option.id);

          return (
            <div key={option.id} className="space-y-2">
              <div className="flex items-center gap-2">
                {canVote ? (
                  poll.type === "single" ? (
                    <RadioGroup value={selectedOptions[0] || ""}>
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => handleSingleSelect(option.id)}
                      >
                        <RadioGroupItem
                          value={option.id}
                          id={option.id}
                          checked={isSelected}
                        />
                        <label
                          htmlFor={option.id}
                          className="cursor-pointer flex-1"
                        >
                          {option.text}
                        </label>
                      </div>
                    </RadioGroup>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        id={option.id}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleMultipleSelect(option.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={option.id}
                        className="cursor-pointer flex-1"
                      >
                        {option.text}
                      </label>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    {isUserVote && (
                      <span className="text-xs font-medium text-green-600">
                        ✓
                      </span>
                    )}
                    <span className="flex-1">{option.text}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[50px] text-right">
                  {voteCount} ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {canVote && (
        <div className="flex gap-2 pt-2">
          <Button onClick={handleVote} disabled={selectedOptions.length === 0}>
            Vote
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedOptions([])}
            disabled={selectedOptions.length === 0}
          >
            Clear
          </Button>
        </div>
      )}

      {userVote && (
        <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
          ✓ You voted
        </div>
      )}
    </Card>
  );
}
