"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { FeatureFlag } from "@/lib/api/deploy";

interface Props {
  flag: FeatureFlag;
  onEdit: (flag: FeatureFlag) => void;
  onDelete: (flag: FeatureFlag) => void;
}

/**
 * Single row in the feature flags table. Fires `onEdit`/`onDelete` callbacks
 * when the action icons are clicked.
 */
export function FeatureFlagRow({ flag, onEdit, onDelete }: Props) {
  return (
    <TableRow>
      <TableCell className="font-mono">{flag.key}</TableCell>
      <TableCell>
        <Badge variant="outline">{flag.env}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={flag.enabled ? "default" : "secondary"}>
          {flag.enabled ? "ON" : "OFF"}
        </Badge>
      </TableCell>
      <TableCell>{flag.rollout_percent}%</TableCell>
      <TableCell className="text-sm">
        {flag.target_users.length} users, {flag.target_orgs.length} orgs
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {flag.description ?? "—"}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onEdit(flag)}
          aria-label="Modifier"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(flag)}
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
