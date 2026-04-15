"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Package, Plus, Trash2, Edit, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { socialApi } from "@/lib/api/social";
import type { ContentSet } from "@/lib/api/social";
import { useSocialStore } from "@/stores/social-store";

// --- Create/Edit Dialog ---

function ContentSetDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: Pick<ContentSet, "name" | "postIds"> & Partial<ContentSet>,
  ) => void;
  initial?: ContentSet;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      postIds: initial?.postIds ?? [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Content Set" : "Create Content Set"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              placeholder="Product Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              placeholder="Brief description of this content set"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Separator />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initial ? "Save Changes" : "Create Content Set"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export function ContentSetManager() {
  const router = useRouter();
  const [contentSets, setContentSets] = useState<ContentSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<ContentSet | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { accounts, fetchAccounts } = useSocialStore();

  const fetchContentSets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.contentSets.list();
      setContentSets(res.data);
    } catch {
      toast.error("Failed to load content sets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContentSets();
    if (accounts.length === 0) fetchAccounts();
  }, [fetchContentSets, accounts.length, fetchAccounts]);

  const handleCreate = async (
    data: Pick<ContentSet, "name" | "postIds"> & Partial<ContentSet>,
  ) => {
    try {
      setSaving(true);
      await socialApi.contentSets.create({ content: "", ...data });
      toast.success("Content set created");
      setIsDialogOpen(false);
      setEditingSet(undefined);
      await fetchContentSets();
    } catch {
      toast.error("Impossible de créer content set");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    data: Pick<ContentSet, "name" | "postIds"> & Partial<ContentSet>,
  ) => {
    if (!editingSet) return;
    try {
      setSaving(true);
      // Use create as a workaround since API may not have update; delete + re-create
      await socialApi.contentSets.delete(editingSet.id);
      await socialApi.contentSets.create({ content: "", ...data });
      toast.success("Content set updated");
      setIsDialogOpen(false);
      setEditingSet(undefined);
      await fetchContentSets();
    } catch {
      toast.error("Impossible de mettre à jour content set");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await socialApi.contentSets.delete(deleteId);
      toast.success("Content set deleted");
      setDeleteId(null);
      await fetchContentSets();
    } catch {
      toast.error("Impossible de supprimer content set");
    }
  };

  const openEdit = (set: ContentSet) => {
    setEditingSet(set);
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingSet(undefined);
    setIsDialogOpen(true);
  };

  const handleUse = (set: ContentSet) => {
    const params = new URLSearchParams();
    params.set("contentSetId", set.id);
    if (set.name) params.set("name", set.name);
    router.push(`/social/compose?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Content Sets</h2>
            <p className="text-sm text-muted-foreground">
              Reusable content templates for quick posting
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Content Set
          </Button>
        </div>

        {contentSets.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium">No content sets</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create reusable content sets to speed up posting
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first set
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contentSets.map((set) => (
              <Card key={set.id} className="group">
                <CardContent className="py-4 px-4">
                  <div className="flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{set.name}</h4>
                        {set.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {set.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUse(set)}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Use in composer</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(set)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(set.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Footer Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {set.postIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {set.postIds.length} post
                          {set.postIds.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ContentSetDialog
          open={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingSet(undefined);
          }}
          onSave={editingSet ? handleUpdate : handleCreate}
          initial={editingSet}
          saving={saving}
        />

        <AlertDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Content Set</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this content set. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
