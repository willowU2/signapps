/**
 * AD Sync Preview — SO4 IN1.3.
 *
 * Calls the `/org/ad/sync/:tenant_id/preview` endpoint, renders a
 * checkbox-driven table grouped by operation kind (adds / removes /
 * moves / conflicts) and lets the operator selectively approve a
 * subset via `/org/ad/sync/:tenant_id/approve`.
 *
 * The dev backend currently returns a deterministic mock payload —
 * the UX is identical for the real LDAP cycle once it ships.
 */
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  CheckCheck,
  Loader2,
  GitMerge,
  AlertTriangle,
} from "lucide-react";
import { adIntegrationsApi } from "@/lib/api/org-integrations";
import type {
  AdPreviewOperation,
  AdPreviewResponse,
} from "@/lib/api/org-integrations";

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  ops: AdPreviewOperation[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ops: AdPreviewOperation[]) => void;
}

function OperationsSection({
  title,
  icon,
  ops,
  selected,
  toggle,
  toggleAll,
}: SectionProps) {
  if (ops.length === 0) return null;
  const allSelected = ops.every((o) => selected.has(o.id));
  return (
    <Card data-testid={`ad-preview-section-${title.toLowerCase()}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-2">
            {ops.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => toggleAll(ops)}
                  aria-label={`select all ${title}`}
                />
              </TableHead>
              <TableHead>DN</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.map((op) => (
              <TableRow key={op.id} data-testid={`ad-preview-row-${op.id}`}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(op.id)}
                    onCheckedChange={() => toggle(op.id)}
                    aria-label={`select ${op.dn}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{op.dn}</TableCell>
                <TableCell>
                  <pre className="max-w-md whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {JSON.stringify(op.payload, null, 2)}
                  </pre>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {op.note ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AdSyncPreviewPage() {
  const [preview, setPreview] = useState<AdPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: () => adIntegrationsApi.preview(),
    onSuccess: (data) => {
      setPreview(data);
      setSelected(new Set());
      toast.success(
        `${data.stats.total} operations (${data.stats.conflicts} conflicts)`,
      );
    },
    onError: (e: Error) => toast.error(`Preview failed: ${e.message}`),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("no preview to approve");
      return adIntegrationsApi.approve(preview.run_id, Array.from(selected));
    },
    onSuccess: (data) => {
      toast.success(
        `Applied ${data.applied.length} ops (${data.skipped.length} skipped, ${data.errors.length} errors)`,
      );
      queryClient.invalidateQueries({ queryKey: ["org", "persons"] });
    },
    onError: (e: Error) => toast.error(`Approve failed: ${e.message}`),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (ops: AdPreviewOperation[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ops.every((o) => next.has(o.id));
      ops.forEach((o) => {
        if (allOn) next.delete(o.id);
        else next.add(o.id);
      });
      return next;
    });

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageBreadcrumb
          items={[
            { label: "Active Directory", href: "/admin/active-directory" },
            { label: "Sync", href: "/admin/active-directory/sync" },
            { label: "Preview" },
          ]}
        />
        <PageHeader
          title="AD Sync Preview"
          description="Review the diff between your AD and SignApps before applying changes."
        />

        <div className="flex items-center gap-2">
          <Button
            data-testid="ad-preview-run"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Run preview
          </Button>
          {preview && preview.mock && (
            <Badge variant="outline" className="text-amber-600">
              Mock data (no LDAP bound)
            </Badge>
          )}
        </div>

        {preview && (
          <>
            <OperationsSection
              title="Adds"
              icon={<GitMerge className="h-4 w-4 text-emerald-600" />}
              ops={preview.adds}
              selected={selected}
              toggle={toggle}
              toggleAll={toggleAll}
            />
            <OperationsSection
              title="Removes"
              icon={<GitMerge className="h-4 w-4 text-red-600" />}
              ops={preview.removes}
              selected={selected}
              toggle={toggle}
              toggleAll={toggleAll}
            />
            <OperationsSection
              title="Moves"
              icon={<GitMerge className="h-4 w-4 text-blue-600" />}
              ops={preview.moves}
              selected={selected}
              toggle={toggle}
              toggleAll={toggleAll}
            />
            <OperationsSection
              title="Conflicts"
              icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              ops={preview.conflicts}
              selected={selected}
              toggle={toggle}
              toggleAll={toggleAll}
            />

            <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-md border bg-background p-3 shadow-lg">
              <span className="text-sm text-muted-foreground">
                {selected.size} of {preview.stats.total} selected
              </span>
              <Button
                data-testid="ad-preview-apply"
                onClick={() => approveMutation.mutate()}
                disabled={selected.size === 0 || approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-2 h-4 w-4" />
                )}
                Apply {selected.size} operation{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
