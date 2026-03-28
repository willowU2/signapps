"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types (mirror backend domain types)
// ---------------------------------------------------------------------------

type MigrationSource = "google_workspace" | "microsoft_office365" | "custom";

interface StartMigrationRequest {
  source: MigrationSource;
}

interface MigrationProgress {
  total_items: number;
  processed_items: number;
  failed_items: number;
  current_step: string;
}

interface MigrationJob {
  id: string;
  source: MigrationSource;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: MigrationProgress;
  started_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDENTITY_API = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3001";

const SOURCE_LABELS: Record<MigrationSource, string> = {
  google_workspace: "Google Workspace",
  microsoft_office365: "Microsoft Office 365",
  custom: "Custom (CSV / LDAP export)",
};

const IMPORT_OPTIONS = [
  { id: "mail", label: "Mail" },
  { id: "calendar", label: "Calendar" },
  { id: "contacts", label: "Contacts" },
  { id: "files", label: "Files / Drive" },
] as const;

type ImportOptionId = (typeof IMPORT_OPTIONS)[number]["id"];

// ---------------------------------------------------------------------------
// Step sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                ? "bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-sm ${
              i === current ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className="mx-1 h-px w-8 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MigrationWizard() {
  const [step, setStep] = useState(0);

  // Step 1 — source selection
  const [source, setSource] = useState<MigrationSource | null>(null);

  // Step 2 — connection config (placeholder fields)
  const [adminEmail, setAdminEmail] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Step 3 — what to import
  const [selected, setSelected] = useState<Set<ImportOptionId>>(
    new Set(["mail", "calendar", "contacts", "files"])
  );

  // Step 4 — result
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ["Choose source", "Configure", "Select data", "Review & Start"];

  const toggleOption = (id: ImportOptionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    if (!source) return;
    setIsSubmitting(true);
    try {
      const body: StartMigrationRequest = { source };
      const res = await fetch(`${IDENTITY_API}/api/v1/admin/migration/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? "Failed to start migration");
      }
      const data: MigrationJob = await res.json();
      setJob(data);
      toast.success("Migration démarrée avec succès");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Migration Wizard</h2>
        <p className="text-sm text-muted-foreground">
          Import your existing data into SignApps Platform.
        </p>
      </div>

      <StepIndicator steps={steps} current={step} />

      {/* ------------------------------------------------------------------ */}
      {/* Step 0 — Choose source                                              */}
      {/* ------------------------------------------------------------------ */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Select your current platform:</p>
          {(Object.keys(SOURCE_LABELS) as MigrationSource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                source === s
                  ? "border-primary bg-primary/5 font-medium"
                  : "hover:bg-muted"
              }`}
            >
              {SOURCE_LABELS[s]}
            </button>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(1)} disabled={!source}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Configure connection                                       */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">
            Enter connection details for{" "}
            <span className="text-primary">{source ? SOURCE_LABELS[source] : ""}</span>:
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Admin e-mail</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@yourdomain.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API key / Service account token</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="••••••••••••"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — Select what to import                                      */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">What would you like to import?</p>
          <div className="space-y-3 rounded-md border p-4">
            {IMPORT_OPTIONS.map(({ id, label }) => (
              <div key={id} className="flex items-center gap-3">
                <Checkbox
                  id={`import-${id}`}
                  checked={selected.has(id)}
                  onCheckedChange={() => toggleOption(id)}
                />
                <Label htmlFor={`import-${id}`} className="cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={selected.size === 0}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 3 — Review & Start  (or show result)                          */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && !job && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Review your migration settings:</p>
          <div className="rounded-md border p-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Source:</span>
              <span>{source ? SOURCE_LABELS[source] : "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Admin e-mail:</span>
              <span>{adminEmail || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Importing:</span>
              <span>
                {IMPORT_OPTIONS.filter((o) => selected.has(o.id))
                  .map((o) => o.label)
                  .join(", ")}
              </span>
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleStart} disabled={isSubmitting}>
              {isSubmitting ? "Starting…" : "Start Migration"}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Migration started — status card                                     */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && job && (
        <div className="rounded-md border p-4 space-y-2 text-sm">
          <p className="font-medium text-green-600">Migration job created</p>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Job ID:</span>
            <span className="font-mono text-xs">{job.id}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Status:</span>
            <span className="capitalize">{job.status}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Started:</span>
            <span>{new Date(job.started_at).toLocaleString()}</span>
          </div>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => {
              setJob(null);
              setStep(0);
              setSource(null);
              setAdminEmail("");
              setApiKey("");
              setSelected(new Set(["mail", "calendar", "contacts", "files"]));
            }}
          >
            Start another migration
          </Button>
        </div>
      )}
    </div>
  );
}
