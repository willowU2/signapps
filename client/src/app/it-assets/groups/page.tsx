"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Layers,
  Tag,
  Plus,
  Trash2,
  Edit,
  FolderTree,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";
import { usePageTitle } from "@/hooks/use-page-title";

const client = getClient(ServiceName.IT_ASSETS);

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
}

interface DeviceTag {
  id: string;
  name: string;
  color: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useGroups() {
  return useQuery({
    queryKey: ["it-groups"],
    queryFn: () =>
      client.get<DeviceGroup[]>("/it-assets/groups").then((r) => r.data),
  });
}

function useTags() {
  return useQuery({
    queryKey: ["it-tags"],
    queryFn: () =>
      client.get<DeviceTag[]>("/it-assets/tags").then((r) => r.data),
  });
}

// ─── Group tree helpers ───────────────────────────────────────────────────────

function buildTree(
  groups: DeviceGroup[],
): (DeviceGroup & { children: DeviceGroup[] })[] {
  const map = new Map<string, DeviceGroup & { children: DeviceGroup[] }>();
  groups.forEach((g) => map.set(g.id, { ...g, children: [] }));
  const roots: (DeviceGroup & { children: DeviceGroup[] })[] = [];
  map.forEach((g) => {
    if (g.parent_id && map.has(g.parent_id)) {
      map.get(g.parent_id)!.children.push(g);
    } else {
      roots.push(g);
    }
  });
  return roots;
}

function GroupNode({
  group,
  depth = 0,
  onEdit,
  onDelete,
}: {
  group: DeviceGroup & { children: DeviceGroup[] };
  depth?: number;
  onEdit: (g: DeviceGroup) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <>
      <TableRow>
        <TableCell>
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: depth * 24 }}
          >
            {group.children.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="p-0.5">
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
            )}
            {group.children.length === 0 && <span className="w-4" />}
            <FolderTree className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{group.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {group.description ?? "—"}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(group)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => onDelete(group.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded &&
        group.children.map((child) => (
          <GroupNode
            key={child.id}
            group={child as DeviceGroup & { children: DeviceGroup[] }}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  usePageTitle("Device Groups & Tags");
  const qc = useQueryClient();
  const { data: groups = [], isLoading: loadingGroups } = useGroups();
  const { data: tags = [], isLoading: loadingTags } = useTags();

  // Group dialog state
  const [groupDialog, setGroupDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<DeviceGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupParent, setGroupParent] = useState("");

  // Tag dialog state
  const [tagDialog, setTagDialog] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");

  // ── Mutations ──
  const createGroup = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      parent_id?: string;
    }) => client.post("/it-assets/groups", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-groups"] });
      setGroupDialog(false);
      toast.success("Group created");
    },
    onError: () => toast.error("Failed to create group"),
  });

  const updateGroup = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name: string;
      description?: string;
    }) => client.put(`/it-assets/groups/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-groups"] });
      setGroupDialog(false);
      toast.success("Group updated");
    },
    onError: () => toast.error("Failed to update group"),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => client.delete(`/it-assets/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-groups"] });
      toast.success("Group deleted");
    },
    onError: () => toast.error("Failed to delete group"),
  });

  const createTag = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      client.post("/it-assets/tags", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-tags"] });
      setTagDialog(false);
      toast.success("Tag created");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const deleteTag = useMutation({
    mutationFn: (id: string) => client.delete(`/it-assets/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["it-tags"] });
      toast.success("Tag deleted");
    },
    onError: () => toast.error("Failed to delete tag"),
  });

  // ── Handlers ──
  const openCreate = () => {
    setEditGroup(null);
    setGroupName("");
    setGroupDesc("");
    setGroupParent("");
    setGroupDialog(true);
  };

  const openEdit = (g: DeviceGroup) => {
    setEditGroup(g);
    setGroupName(g.name);
    setGroupDesc(g.description ?? "");
    setGroupParent(g.parent_id ?? "");
    setGroupDialog(true);
  };

  const submitGroup = () => {
    const payload = {
      name: groupName,
      description: groupDesc || undefined,
      parent_id: groupParent || undefined,
    };
    if (editGroup) {
      updateGroup.mutate({ id: editGroup.id, ...payload });
    } else {
      createGroup.mutate(payload);
    }
  };

  const tree = buildTree(groups);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-blue-600" />
              Device Groups &amp; Tags
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize devices into hierarchical groups and label them with
              color tags
            </p>
          </div>
        </div>

        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">
              <FolderTree className="h-4 w-4 mr-1" />
              Groups ({groups.length})
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-4 w-4 mr-1" />
              Tags ({tags.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Groups tab ── */}
          <TabsContent value="groups">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Group Hierarchy</CardTitle>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Group
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingGroups ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading groups…
                  </div>
                ) : tree.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderTree className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold">Aucun groupe</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Creez un groupe pour organiser vos equipements.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tree.map((g) => (
                        <GroupNode
                          key={g.id}
                          group={g}
                          onEdit={openEdit}
                          onDelete={(id) => deleteGroup.mutate(id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tags tab ── */}
          <TabsContent value="tags">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Device Tags</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setTagName("");
                    setTagColor("#3b82f6");
                    setTagDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Tag
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTags ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading tags…
                  </div>
                ) : tags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Tag className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium">Aucun tag</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Creez des tags pour categoriser vos equipements.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 border rounded-full px-3 py-1.5"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium">{tag.name}</span>
                        <button
                          className="text-muted-foreground hover:text-red-500"
                          onClick={() => deleteTag.mutate(tag.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Group dialog ── */}
        <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editGroup ? "Edit Group" : "New Group"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-1">
                <Label>Parent Group</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={groupParent}
                  onChange={(e) => setGroupParent(e.target.value)}
                >
                  <option value="">— None (root) —</option>
                  {groups
                    .filter((g) => g.id !== editGroup?.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitGroup}
                disabled={
                  !groupName.trim() ||
                  createGroup.isPending ||
                  updateGroup.isPending
                }
              >
                {editGroup ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Tag dialog ── */}
        <Dialog open={tagDialog} onOpenChange={setTagDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>New Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Tag Name *</Label>
                <Input
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. Production"
                />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border"
                  />
                  <Badge style={{ backgroundColor: tagColor, color: "#fff" }}>
                    {tagName || "Preview"}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTagDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createTag.mutate({ name: tagName, color: tagColor })
                }
                disabled={!tagName.trim() || createTag.isPending}
              >
                Create Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
