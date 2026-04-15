"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface SecurityCheck {
  label: string;
  passed: boolean;
  weight: number;
  category: string;
}

const CHECKS: SecurityCheck[] = [
  {
    label: "MFA enabled for all admins",
    passed: true,
    weight: 15,
    category: "Authentication",
  },
  {
    label: "SAML/SSO configured",
    passed: false,
    weight: 10,
    category: "Authentication",
  },
  {
    label: "Hardware key support enabled",
    passed: false,
    weight: 10,
    category: "Authentication",
  },
  {
    label: "Geo-fencing rules active",
    passed: false,
    weight: 8,
    category: "Access Control",
  },
  {
    label: "Brute force lockout configured",
    passed: true,
    weight: 10,
    category: "Access Control",
  },
  {
    label: "Login anomaly detection on",
    passed: false,
    weight: 8,
    category: "Access Control",
  },
  {
    label: "TLS certificates valid",
    passed: true,
    weight: 15,
    category: "Transport",
  },
  { label: "HTTPS enforced", passed: true, weight: 10, category: "Transport" },
  {
    label: "Audit logging enabled",
    passed: true,
    weight: 8,
    category: "Compliance",
  },
  {
    label: "Password policy enforced",
    passed: true,
    weight: 6,
    category: "Compliance",
  },
];

export function SecurityScorecard() {
  const totalWeight = CHECKS.reduce((s, c) => s + c.weight, 0);
  const passedWeight = CHECKS.filter((c) => c.passed).reduce(
    (s, c) => s + c.weight,
    0,
  );
  const score = Math.round((passedWeight / totalWeight) * 100);

  const categories = [...new Set(CHECKS.map((c) => c.category))];

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (s: number) => {
    if (s >= 80) return <ShieldCheck className="h-16 w-16 text-green-500" />;
    if (s >= 60) return <ShieldAlert className="h-16 w-16 text-yellow-500" />;
    return <ShieldX className="h-16 w-16 text-red-500" />;
  };

  const getRating = (s: number) => {
    if (s >= 80) return { label: "Good", variant: "default" as const };
    if (s >= 60)
      return { label: "Needs Improvement", variant: "secondary" as const };
    return { label: "Critical", variant: "destructive" as const };
  };

  const rating = getRating(score);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col md:flex-row items-center gap-8 pt-6">
          {getScoreIcon(score)}
          <div className="flex-1 space-y-2 w-full">
            <div className="flex items-center gap-3">
              <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
                {score}
              </span>
              <span className="text-2xl text-muted-foreground">/100</span>
              <Badge variant={rating.variant}>{rating.label}</Badge>
            </div>
            <Progress value={score} className="h-3" />
            <p className="text-sm text-muted-foreground">
              {CHECKS.filter((c) => c.passed).length}/{CHECKS.length} security
              checks passed
            </p>
          </div>
        </CardContent>
      </Card>

      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> {cat}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CHECKS.filter((c) => c.category === cat).map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between py-1.5 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  {check.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-sm">{check.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={check.passed ? "outline" : "secondary"}
                    className="text-xs"
                  >
                    +{check.weight}pts
                  </Badge>
                  {!check.passed && (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
