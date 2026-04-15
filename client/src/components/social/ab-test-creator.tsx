"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, TrendingUp, Trophy, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { socialApi } from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABVariant {
  id: "A" | "B";
  content: string;
  hashtags: string;
  imageUrl?: string;
  audiencePercent: number; // 0-100
  publishOffsetMinutes: number; // offset from now
}

export interface ABTestConfig {
  id: string;
  variantA: ABVariant;
  variantB: ABVariant;
  winnerMetric: "likes" | "shares" | "comments" | "clicks";
  evaluateAfterHours: number;
  status: "draft" | "running" | "completed";
  createdAt: string;
  winner?: "A" | "B";
  stats?: {
    A: { likes: number; shares: number; comments: number; clicks: number };
    B: { likes: number; shares: number; comments: number; clicks: number };
  };
}

function newVariant(id: "A" | "B"): ABVariant {
  return {
    id,
    content: "",
    hashtags: "",
    audiencePercent: 50,
    publishOffsetMinutes: id === "B" ? 30 : 0,
  };
}

// ---------------------------------------------------------------------------
// Storage helpers (localStorage-backed for MVP)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "signapps_ab_tests";

function loadTests(): ABTestConfig[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTests(tests: ABTestConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

// ---------------------------------------------------------------------------
// Variant card
// ---------------------------------------------------------------------------

interface VariantCardProps {
  variant: ABVariant;
  onChange: (v: ABVariant) => void;
}

function VariantCard({ variant, onChange }: VariantCardProps) {
  const label = `Variant ${variant.id}`;

  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Badge variant={variant.id === "A" ? "default" : "secondary"}>
            {label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Post content</Label>
          <Textarea
            placeholder={`Write variant ${variant.id} content…`}
            value={variant.content}
            onChange={(e) => onChange({ ...variant, content: e.target.value })}
            className="min-h-[120px] resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground text-right">
            {variant.content.length} chars
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Hashtags (comma-separated)</Label>
          <Input
            placeholder="#growth, #marketing"
            value={variant.hashtags}
            onChange={(e) => onChange({ ...variant, hashtags: e.target.value })}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Audience %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={variant.audiencePercent}
              onChange={(e) =>
                onChange({
                  ...variant,
                  audiencePercent: parseInt(e.target.value) || 50,
                })
              }
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Publish offset (min)</Label>
            <Input
              type="number"
              min={0}
              value={variant.publishOffsetMinutes}
              onChange={(e) =>
                onChange({
                  ...variant,
                  publishOffsetMinutes: parseInt(e.target.value) || 0,
                })
              }
              className="text-sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

interface StatsRowProps {
  test: ABTestConfig;
}

function StatsRow({ test }: StatsRowProps) {
  if (!test.stats) return null;
  const metric = test.winnerMetric;

  const aVal = test.stats.A[metric];
  const bVal = test.stats.B[metric];
  const winner = aVal > bVal ? "A" : bVal > aVal ? "B" : null;

  return (
    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
      {(["A", "B"] as const).map((id) => {
        const stats = test.stats![id];
        const isWinner = winner === id;
        return (
          <div
            key={id}
            className={`space-y-1 ${isWinner ? "text-green-600" : ""}`}
          >
            <div className="font-medium flex items-center gap-1">
              Variant {id}
              {isWinner && <Trophy className="h-3.5 w-3.5" />}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Likes: {stats.likes}</div>
              <div>Shares: {stats.shares}</div>
              <div>Comments: {stats.comments}</div>
              <div>Clicks: {stats.clicks}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ABTestCreator() {
  const [variantA, setVariantA] = useState<ABVariant>(newVariant("A"));
  const [variantB, setVariantB] = useState<ABVariant>(newVariant("B"));
  const [winnerMetric, setWinnerMetric] =
    useState<ABTestConfig["winnerMetric"]>("likes");
  const [evaluateAfterHours, setEvaluateAfterHours] = useState(24);
  const [isSaving, setIsSaving] = useState(false);
  const [tests, setTests] = useState<ABTestConfig[]>(loadTests);

  const handleCreate = useCallback(async () => {
    if (!variantA.content.trim() || !variantB.content.trim()) {
      toast.error("Both variants need content");
      return;
    }
    setIsSaving(true);
    try {
      const newTest: ABTestConfig = {
        id: `ab_${Date.now()}`,
        variantA,
        variantB,
        winnerMetric,
        evaluateAfterHours,
        status: "draft",
        createdAt: new Date().toISOString(),
      };

      // Store A/B config in post metadata — post both variants as drafts via socialApi
      // For MVP we save config to localStorage and log intent; real backend would create
      // two posts with ab_test_id metadata and schedule them accordingly.
      await socialApi.posts
        .create({
          content: variantA.content,
          hashtags: variantA.hashtags
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean),
          metadata: { abTestId: newTest.id, variant: "A", config: newTest },
        } as any)
        .catch(() => null); // graceful degradation if backend not running

      const updated = [...tests, newTest];
      saveTests(updated);
      setTests(updated);
      toast.success("A/B test created");

      // Reset
      setVariantA(newVariant("A"));
      setVariantB(newVariant("B"));
    } catch {
      toast.error("Failed to create A/B test");
    } finally {
      setIsSaving(false);
    }
  }, [variantA, variantB, winnerMetric, evaluateAfterHours, tests]);

  const handleSimulateWinner = useCallback(
    (testId: string) => {
      const updated = tests.map((t) => {
        if (t.id !== testId) return t;
        const mockStats: ABTestConfig["stats"] = {
          A: {
            likes: Math.floor(Math.random() * 500),
            shares: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 80),
            clicks: Math.floor(Math.random() * 300),
          },
          B: {
            likes: Math.floor(Math.random() * 500),
            shares: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 80),
            clicks: Math.floor(Math.random() * 300),
          },
        };
        const aVal = mockStats.A[t.winnerMetric];
        const bVal = mockStats.B[t.winnerMetric];
        return {
          ...t,
          status: "completed" as const,
          stats: mockStats,
          winner: aVal >= bVal ? ("A" as const) : ("B" as const),
        };
      });
      saveTests(updated);
      setTests(updated);
      toast.success("Test evaluated — winner determined");
    },
    [tests],
  );

  const handleDelete = useCallback(
    (testId: string) => {
      const updated = tests.filter((t) => t.id !== testId);
      saveTests(updated);
      setTests(updated);
    },
    [tests],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">A/B Test Creator</h2>
      </div>

      {/* Create new test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New A/B Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Variants */}
          <div className="flex gap-4">
            <VariantCard variant={variantA} onChange={setVariantA} />
            <VariantCard variant={variantB} onChange={setVariantB} />
          </div>

          <Separator />

          {/* Config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Winner metric</Label>
              <Select
                value={winnerMetric}
                onValueChange={(v) => setWinnerMetric(v as any)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="likes">Likes</SelectItem>
                  <SelectItem value="shares">Shares</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Evaluate after (hours)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={evaluateAfterHours}
                onChange={(e) =>
                  setEvaluateAfterHours(parseInt(e.target.value) || 24)
                }
                className="text-sm"
              />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={isSaving} className="w-full">
            <FlaskConical className="h-4 w-4 mr-2" />
            {isSaving ? "Creating…" : "Create A/B Test"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing tests */}
      {tests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Existing Tests</h3>
          {tests.map((test) => (
            <Card key={test.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge
                      variant={
                        test.status === "completed"
                          ? "default"
                          : test.status === "running"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {test.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      <TrendingUp className="inline h-3.5 w-3.5 mr-1" />
                      Winner metric: {test.winnerMetric}
                    </span>
                    <span className="text-muted-foreground">
                      <Clock className="inline h-3.5 w-3.5 mr-1" />
                      {test.evaluateAfterHours}h
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {test.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateWinner(test.id)}
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                        Simulate Results
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(test.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 rounded p-2">
                    <span className="font-medium">A: </span>
                    <span className="text-muted-foreground line-clamp-2">
                      {test.variantA.content}
                    </span>
                  </div>
                  <div className="bg-muted/30 rounded p-2">
                    <span className="font-medium">B: </span>
                    <span className="text-muted-foreground line-clamp-2">
                      {test.variantB.content}
                    </span>
                  </div>
                </div>

                {test.status === "completed" && (
                  <>
                    <StatsRow test={test} />
                    {test.winner && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <Trophy className="h-4 w-4" />
                        Variant {test.winner} wins — ready to publish to full
                        audience
                        <Button size="sm" className="ml-auto" variant="outline">
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Publish Winner
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
