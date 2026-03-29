"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Idea {
  id: string;
  text: string;
  votes: number;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
}

export function IdeaBox() {
  const [ideas, setIdeas] = useState<Idea[]>([
    {
      id: "1",
      text: "Implement dark mode for better accessibility",
      votes: 5,
      status: "approved",
      submittedAt: new Date(Date.now() - 86400000),
    },
    {
      id: "2",
      text: "Add multi-language support",
      votes: 3,
      status: "pending",
      submittedAt: new Date(Date.now() - 43200000),
    },
  ]);
  const [newIdea, setNewIdea] = useState("");
  const [votedIdeas, setVotedIdeas] = useState<Record<string, "up" | "down">>({});

  const submitIdea = () => {
    if (!newIdea.trim()) {
      toast.error("Veuillez saisir une idée");
      return;
    }

    const id = Date.now().toString();
    setIdeas([
      {
        id,
        text: newIdea,
        votes: 0,
        status: "pending",
        submittedAt: new Date(),
      },
      ...ideas,
    ]);
    setNewIdea("");
    toast.success("Idée soumise anonymement");
  };

  const handleVote = (id: string, direction: "up" | "down") => {
    const current = votedIdeas[id];
    let voteChange = 0;

    if (current === direction) {
      delete votedIdeas[id];
      voteChange = direction === "up" ? -1 : 1;
    } else if (current === "up" && direction === "down") {
      voteChange = -2;
    } else if (current === "down" && direction === "up") {
      voteChange = 2;
    } else {
      voteChange = direction === "up" ? 1 : -1;
    }

    setIdeas(
      ideas.map((idea) =>
        idea.id === id ? { ...idea, votes: idea.votes + voteChange } : idea
      )
    );
    setVotedIdeas({
      ...votedIdeas,
      [id]: current === direction ? undefined : direction,
    } as Record<string, "up" | "down">);
  };

  const deleteIdea = (id: string) => {
    setIdeas(ideas.filter((idea) => idea.id !== id));
    toast.success("Idée retirée");
  };

  const getStatusColor = (status: Idea["status"]) => {
    return {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }[status];
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="font-semibold mb-2">Share Your Ideas Anonymously</h3>
        <Textarea
          placeholder="What's your idea for improving SignApps?"
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          className="mb-2 min-h-24"
        />
        <Button onClick={submitIdea} className="w-full">
          Submit Idea
        </Button>
      </div>

      <div className="space-y-2">
        {ideas.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No ideas yet. Be the first to share!</p>
        ) : (
          ideas.map((idea) => (
            <div key={idea.id} className="border rounded-lg p-4 hover:bg-muted">
              <div className="flex items-start justify-between mb-2">
                <p className="flex-1">{idea.text}</p>
                <Badge className={getStatusColor(idea.status)}>
                  {idea.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{idea.submittedAt.toLocaleDateString()}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={votedIdeas[idea.id] === "up" ? "default" : "ghost"}
                    onClick={() => handleVote(idea.id, "up")}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" /> {idea.votes > 0 ? idea.votes : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant={votedIdeas[idea.id] === "down" ? "default" : "ghost"}
                    onClick={() => handleVote(idea.id, "down")}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteIdea(idea.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
