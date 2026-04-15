"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface ABVariant {
  name: string;
  visitors: number;
  conversions: number;
}

interface ABTest {
  id: string;
  name: string;
  status: "running" | "completed" | "draft";
  goal: string;
  variants: ABVariant[];
  started_at: string;
  confidence_level: number;
}

const SAMPLE: ABTest[] = [];

function zScore(n1: number, c1: number, n2: number, c2: number): number {
  if (!n1 || !n2) return 0;
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  return se === 0 ? 0 : (p2 - p1) / se;
}

function significance(z: number): { label: string; confident: boolean } {
  const az = Math.abs(z);
  if (az >= 2.576) return { label: "99% significant", confident: true };
  if (az >= 1.96) return { label: "95% significant", confident: true };
  if (az >= 1.645) return { label: "90% significant", confident: false };
  return { label: "Not significant", confident: false };
}

export function ABTestViewer() {
  const [tests] = useState<ABTest[]>(SAMPLE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5" /> A/B Test Results
        </h2>
        <Button variant="outline" size="sm">
          New Test
        </Button>
      </div>

      {tests.map((test) => {
        const control = test.variants[0];
        const variant = test.variants[1];
        const z = zScore(
          control.visitors,
          control.conversions,
          variant.visitors,
          variant.conversions,
        );
        const sig = significance(z);
        const controlRate = (
          (control.conversions / control.visitors) *
          100
        ).toFixed(2);
        const variantRate = (
          (variant.conversions / variant.visitors) *
          100
        ).toFixed(2);
        const lift = (
          ((variant.conversions / variant.visitors -
            control.conversions / control.visitors) /
            (control.conversions / control.visitors)) *
          100
        ).toFixed(1);
        const isPositiveLift = parseFloat(lift) > 0;

        return (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{test.name}</CardTitle>
                <Badge
                  variant={
                    test.status === "running"
                      ? "default"
                      : test.status === "completed"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {test.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Goal: {test.goal} · Started{" "}
                {new Date(test.started_at).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {test.variants.map((v, i) => {
                  const rate = ((v.conversions / v.visitors) * 100).toFixed(2);
                  const isWinner = i === 1 && sig.confident && isPositiveLift;
                  return (
                    <div
                      key={v.name}
                      className={`border rounded-lg p-3 ${isWinner ? "border-green-500/50 bg-green-500/5" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{v.name}</span>
                        {isWinner && (
                          <Badge className="bg-green-500 text-white text-xs">
                            Winner
                          </Badge>
                        )}
                        {i === 0 && (
                          <Badge variant="outline" className="text-xs">
                            Control
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold">{rate}%</div>
                      <p className="text-xs text-muted-foreground">
                        {v.conversions.toLocaleString()} /{" "}
                        {v.visitors.toLocaleString()} visitors
                      </p>
                      <Progress
                        value={parseFloat(rate)}
                        max={10}
                        className="mt-2 h-2"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5">
                  {isPositiveLift ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {isPositiveLift ? "+" : ""}
                    {lift}% lift
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {sig.confident ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-sm">{sig.label}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  z = {z.toFixed(3)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default ABTestViewer;
