"use client";

import { useState } from "react";
import { ThumbsUp, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

interface Submission {
  id: string;
  title: string;
  description: string;
  link: string;
  author: string;
  votes: number;
  date: Date;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  prize: string;
  submissions: Submission[];
}

const submissionSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  link: z.string().url("Please enter a valid URL"),
});

type SubmissionValues = z.infer<typeof submissionSchema>;

export function InnovationChallenge() {
  const [challenges, setChallenges] = useState<Challenge[]>([
    {
      id: "1",
      title: "AI-Powered Knowledge Base",
      description: "Build an intelligent search and recommendation system for our documentation",
      deadline: new Date(Date.now() + 7776000000), // 90 days
      prize: "Free premium access for 1 year",
      submissions: [
        {
          id: "s1",
          title: "ML-based semantic search",
          description: "Uses embeddings to understand context and provide better results",
          link: "https://example.com/submission1",
          author: "Alex Chen",
          votes: 12,
          date: new Date(Date.now() - 86400000),
        },
      ],
    },
  ]);

  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(challenges[0]?.id);
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

  const form = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      title: "",
      description: "",
      link: "",
    },
  });

  const currentChallenge = challenges.find((c) => c.id === selectedChallenge);
  if (!currentChallenge) return null;

  const daysRemaining = Math.ceil(
    (currentChallenge.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const onSubmit = (values: SubmissionValues) => {
    const newSubmission: Submission = {
      id: Date.now().toString(),
      title: values.title,
      description: values.description,
      link: values.link,
      author: "You",
      votes: 0,
      date: new Date(),
    };

    setChallenges(
      challenges.map((c) =>
        c.id === selectedChallenge
          ? { ...c, submissions: [newSubmission, ...c.submissions] }
          : c
      )
    );

    form.reset();
    toast.success("Soumission créée avec succès !");
  };

  const handleVote = (submissionId: string) => {
    const key = `${selectedChallenge}-${submissionId}`;
    const hasVoted = userVotes[key];

    setChallenges(
      challenges.map((c) =>
        c.id === selectedChallenge
          ? {
              ...c,
              submissions: c.submissions.map((s) =>
                s.id === submissionId
                  ? { ...s, votes: s.votes + (hasVoted ? -1 : 1) }
                  : s
              ),
            }
          : c
      )
    );

    setUserVotes({
      ...userVotes,
      [key]: !hasVoted,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Challenge Card */}
      <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {currentChallenge.title}
            </h2>
            <p className="text-muted-foreground mb-4">{currentChallenge.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <p className="font-semibold text-foreground">
                {daysRemaining > 0 ? `${daysRemaining} days` : "Ended"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Prize</p>
            <p className="font-semibold text-foreground">{currentChallenge.prize}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <Badge variant="secondary">
            {currentChallenge.submissions.length} submission{currentChallenge.submissions.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Submission Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="border rounded-lg p-6 bg-blue-50 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Submit Your Solution</h3>
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Title</FormLabel>
                <FormControl>
                  <Input placeholder="Give your submission a catchy title..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your solution, approach, and key features..."
                    className="min-h-20"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Link</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://github.com/yourname/project or https://yoursite.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Submit Solution
          </Button>
        </form>
      </Form>

      {/* Submissions List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg text-foreground">
          Submissions ({currentChallenge.submissions.length})
        </h3>

        {currentChallenge.submissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No submissions yet. Be the first to submit your solution!
          </p>
        ) : (
          currentChallenge.submissions
            .sort((a, b) => b.votes - a.votes)
            .map((submission) => {
              const voteKey = `${selectedChallenge}-${submission.id}`;
              const hasVoted = userVotes[voteKey];

              return (
                <div
                  key={submission.id}
                  className="border rounded-lg p-4 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">
                        {submission.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {submission.description}
                      </p>
                      <a
                        href={submission.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View submission →
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                    <span>
                      {submission.author} · {submission.date.toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant={hasVoted ? "default" : "outline"}
                      onClick={() => handleVote(submission.id)}
                      className="gap-1"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {submission.votes > 0 && submission.votes}
                    </Button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
