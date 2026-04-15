"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  Settings2,
  RefreshCw,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { spamApi, type SpamStatsResponse } from "@/lib/api-mail";

interface SpamFilterSettingsProps {
  accountId: string;
}

export function SpamFilterSettings({ accountId }: SpamFilterSettingsProps) {
  const [stats, setStats] = useState<SpamStatsResponse | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState(0.7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await spamApi.getSettings(accountId);
      setStats(data);
      setEnabled(data.enabled);
      setThreshold(data.threshold);
    } catch {
      // Settings may not exist yet - use defaults
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    setSaving(true);
    try {
      await spamApi.updateSettings(accountId, { enabled: value });
      toast.success(value ? "Spam filter enabled" : "Spam filter disabled");
    } catch {
      setEnabled(!value);
      toast.error("Impossible de mettre à jour spam filter settings");
    } finally {
      setSaving(false);
    }
  };

  const handleThresholdChange = async (values: number[]) => {
    const newThreshold = values[0];
    setThreshold(newThreshold);
  };

  const handleThresholdCommit = async () => {
    setSaving(true);
    try {
      await spamApi.updateSettings(accountId, { threshold });
      toast.success(`Sensitivity updated to ${Math.round(threshold * 100)}%`);
    } catch {
      toast.error("Impossible de mettre à jour threshold");
    } finally {
      setSaving(false);
    }
  };

  const accuracyEstimate = stats
    ? stats.total_classified > 10
      ? Math.min(99, 70 + Math.log10(stats.total_classified) * 10)
      : 0
    : 0;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Toggle Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Brain className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-lg">ML Spam Filter</CardTitle>
                <CardDescription>
                  Local Naive Bayes classifier that learns from your feedback
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>
        </CardHeader>

        {enabled && (
          <CardContent className="space-y-6">
            {/* Sensitivity Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Sensitivity
                </Label>
                <Badge variant="outline" className="font-mono">
                  {Math.round(threshold * 100)}%
                </Badge>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={handleThresholdChange}
                onValueCommit={handleThresholdCommit}
                min={0.3}
                max={0.95}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More permissive</span>
                <span>More aggressive</span>
              </div>
            </div>

            <Separator />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {stats?.total_spam ?? 0}
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Spam detected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {stats?.total_ham ?? 0}
                  </p>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70">
                    Legitimate emails
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {stats?.vocabulary_size ?? 0}
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    Words learned
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30">
                <Shield className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {accuracyEstimate > 0
                      ? `~${Math.round(accuracyEstimate)}%`
                      : "N/A"}
                  </p>
                  <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                    Est. accuracy
                  </p>
                </div>
              </div>
            </div>

            {/* Info about learning */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                The filter improves as you mark emails as spam or not spam. It
                needs at least 10 training samples to start providing reliable
                classifications.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadSettings}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Statistics
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Spam Action Buttons (for use in mail-list.tsx)
// ============================================================================

interface SpamActionButtonsProps {
  emailId: string;
  accountId: string;
  isSpam?: boolean;
  onTrained?: () => void;
}

export function SpamActionButtons({
  emailId,
  accountId,
  isSpam,
  onTrained,
}: SpamActionButtonsProps) {
  const [training, setTraining] = useState(false);

  const handleTrain = async (markAsSpam: boolean) => {
    setTraining(true);
    try {
      await spamApi.train({
        account_id: accountId,
        email_id: emailId,
        is_spam: markAsSpam,
      });
      toast.success(
        markAsSpam
          ? "Reported as spam - filter trained"
          : "Marked as not spam - filter trained",
      );
      onTrained?.();
    } catch {
      toast.error("Impossible d'entraîner le filtre anti-spam");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {isSpam !== true && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          onClick={(e) => {
            e.stopPropagation();
            handleTrain(true);
          }}
          disabled={training}
          title="Report as spam"
        >
          <ShieldAlert className="h-3.5 w-3.5 mr-1" />
          Spam
        </Button>
      )}
      {isSpam !== false && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
          onClick={(e) => {
            e.stopPropagation();
            handleTrain(false);
          }}
          disabled={training}
          title="Not spam"
        >
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          Not Spam
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Spam Badge (for use in mail-list.tsx)
// ============================================================================

interface SpamBadgeProps {
  confidence?: number;
}

export function SpamBadge({ confidence }: SpamBadgeProps) {
  return (
    <Badge
      variant="destructive"
      className="text-[10px] h-5 px-1.5 font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800/50"
    >
      <ShieldAlert className="h-3 w-3 mr-0.5" />
      SPAM
      {confidence !== undefined && confidence > 0 && (
        <span className="ml-0.5 opacity-70">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </Badge>
  );
}

export default SpamFilterSettings;
