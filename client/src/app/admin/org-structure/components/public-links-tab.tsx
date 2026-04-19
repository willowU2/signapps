/**
 * SO4 IN2.5 — Public Links tab.
 *
 * List of active public links + Create / Rotate / Revoke actions +
 * copy-to-clipboard of the slug URL.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  publicLinksApi,
  type PublicLinkView,
} from "@/lib/api/org-integrations";
import { CreatePublicLinkDialog } from "./dialogs/create-public-link-dialog";

export interface PublicLinksTabProps {
  /** Tenant id (mandatory). */
  tenantId: string;
  /** Available root node candidates. */
  nodeOptions: Array<{ id: string; name: string }>;
}

export function PublicLinksTab({ tenantId, nodeOptions }: PublicLinksTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: links = [], isLoading } = useQuery<PublicLinkView[]>({
    queryKey: ["org", "public-links", tenantId],
    queryFn: () => publicLinksApi.list(tenantId),
    enabled: Boolean(tenantId),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => publicLinksApi.revoke(id),
    onSuccess: () => {
      toast.success("Link revoked");
      queryClient.invalidateQueries({
        queryKey: ["org", "public-links", tenantId],
      });
    },
    onError: (e: Error) => toast.error(`Revoke failed: ${e.message}`),
  });

  const rotateMut = useMutation({
    mutationFn: (id: string) => publicLinksApi.rotate(id),
    onSuccess: (link) => {
      toast.success(`Slug rotated → ${link.slug}`);
      queryClient.invalidateQueries({
        queryKey: ["org", "public-links", tenantId],
      });
    },
    onError: (e: Error) => toast.error(`Rotate failed: ${e.message}`),
  });

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/public/org/`;
  }, []);

  const copySlug = (slug: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(`${baseUrl}${slug}`)
      .then(() => toast.success("URL copied"))
      .catch(() => toast.error("Clipboard write failed"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Public Links</h3>
          <p className="text-sm text-muted-foreground">
            Share an anonymized snapshot of your org via a stable URL.
          </p>
        </div>
        <Button
          data-testid="public-link-new"
          onClick={() => setDialogOpen(true)}
          disabled={!tenantId}
        >
          <Plus className="mr-2 h-4 w-4" />
          New link
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Link2 className="mb-2 h-6 w-6" />
            No public link yet — create one to share an anonymized snapshot.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Card key={link.id} data-testid={`public-link-card-${link.slug}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="font-mono text-base">
                      /{link.slug}
                    </CardTitle>
                    <CardDescription>
                      <Badge variant="outline">{link.visibility}</Badge>
                    </CardDescription>
                  </div>
                  <Badge
                    variant={link.is_active ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {link.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>
                  Access count:{" "}
                  <span className="font-medium">{link.access_count}</span>
                </div>
                {link.expires_at && (
                  <div>
                    Expires:{" "}
                    <span className="font-medium">
                      {new Date(link.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copySlug(link.slug)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rotateMut.mutate(link.id)}
                    disabled={rotateMut.isPending}
                  >
                    <RotateCw className="mr-1 h-3 w-3" />
                    Rotate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => revokeMut.mutate(link.id)}
                    disabled={revokeMut.isPending}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePublicLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        nodeOptions={nodeOptions}
        defaultNodeId={nodeOptions[0]?.id ?? null}
        onCreated={() =>
          queryClient.invalidateQueries({
            queryKey: ["org", "public-links", tenantId],
          })
        }
      />
    </div>
  );
}

export default PublicLinksTab;
