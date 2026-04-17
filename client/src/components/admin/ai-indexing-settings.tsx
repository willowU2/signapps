"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  storageSettingsApi,
  IndexingRule,
  UpsertIndexingRule,
} from "@/lib/api/storageSettingsApi";

export function AiIndexingSettings() {
  const [rules, setRules] = useState<IndexingRule[]>([]);
  const [globalDefault, setGlobalDefault] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for new/editing
  const [editForm, setEditForm] = useState<UpsertIndexingRule>({
    folder_path: "",
    bucket: "drive",
    include_subfolders: true,
    file_types_allowed: null,
    collection_name: null,
    is_active: true,
  });

  useEffect(() => {
    fetchGlobalDefault();
    fetchRules();
  }, []);

  const fetchGlobalDefault = async () => {
    try {
      setIsGlobalLoading(true);
      const data = await storageSettingsApi.getSystemSetting(
        "ai_index_all_default",
      );
      setGlobalDefault(data.setting_value === "true");
    } catch (error) {
      console.warn("Failed to load global setting", error);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const toggleGlobalDefault = async (checked: boolean) => {
    try {
      setGlobalDefault(checked);
      await storageSettingsApi.updateSystemSetting(
        "ai_index_all_default",
        checked ? "true" : "false",
      );
      toast.success("Paramètre global mis à jour");
    } catch (error) {
      setGlobalDefault(!checked); // Revert on fail
      toast.error("Impossible de mettre à jour le paramètre global");
      console.warn(error);
    }
  };

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const data = await storageSettingsApi.getIndexingRules();
      setRules(data);
    } catch (error) {
      toast.error("Impossible de charger les règles d'indexation IA");
      console.warn(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingId("new");
    setEditForm({
      folder_path: "",
      bucket: "drive",
      include_subfolders: true,
      file_types_allowed: null,
      collection_name: null,
      is_active: true,
    });
  };

  const handleEdit = (rule: IndexingRule) => {
    setEditingId(rule.id);
    setEditForm({
      folder_path: rule.folder_path,
      bucket: rule.bucket,
      include_subfolders: rule.include_subfolders,
      file_types_allowed: rule.file_types_allowed,
      collection_name: rule.collection_name,
      is_active: rule.is_active,
    });
  };

  const handleSave = async () => {
    try {
      if (!editForm.folder_path || !editForm.bucket) {
        toast.error("Le chemin du dossier et le bucket sont requis");
        return;
      }

      // Convert comma separated string back to array if user typed it out as a primitive string during edits (safeguard)
      let parsedTypes = editForm.file_types_allowed;
      if (typeof parsedTypes === "string") {
        parsedTypes = (parsedTypes as string)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (parsedTypes.length === 0) parsedTypes = null;
      }

      const payload = {
        ...editForm,
        file_types_allowed: parsedTypes,
      };

      if (editingId === "new") {
        await storageSettingsApi.createIndexingRule(payload);
        toast.success("Règle d'indexation créée");
      } else if (editingId) {
        await storageSettingsApi.updateIndexingRule(editingId, payload);
        toast.success("Règle d'indexation mise à jour");
      }

      setEditingId(null);
      fetchRules();
    } catch (error) {
      toast.error("Impossible d'enregistrer la règle d'indexation");
      console.warn(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      await storageSettingsApi.deleteIndexingRule(id);
      toast.success("Règle supprimée");
      fetchRules();
    } catch (error) {
      toast.error("Impossible de supprimer la règle");
      console.warn(error);
    }
  };

  const toggleActive = async (rule: IndexingRule) => {
    try {
      await storageSettingsApi.updateIndexingRule(rule.id, {
        folder_path: rule.folder_path,
        bucket: rule.bucket,
        include_subfolders: rule.include_subfolders,
        file_types_allowed: rule.file_types_allowed,
        collection_name: rule.collection_name,
        is_active: !rule.is_active,
      });
      fetchRules();
    } catch (error) {
      toast.error("Impossible de modifier l'état de la règle");
      console.warn(error);
    }
  };

  const handleFileTypesChange = (value: string) => {
    const list = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setEditForm({
      ...editForm,
      file_types_allowed: list.length > 0 ? list : null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Global Setting Section */}
      <div className="flex items-center justify-between rounded-md border p-4 shadow-sm">
        <div className="space-y-0.5">
          <h3 className="text-base font-medium leading-none">
            Index all files by default
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatically sends all new file uploads to the AI vector database
            unless excluded by a specific rule below.
          </p>
        </div>
        <Switch
          checked={globalDefault}
          onCheckedChange={toggleGlobalDefault}
          disabled={isGlobalLoading}
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Synced Folders</h3>
          <Button
            onClick={handleCreateNew}
            disabled={editingId !== null}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Sync Path
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Active</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Folder Path</TableHead>
                <TableHead>Recursive</TableHead>
                <TableHead>Formats (.ext)</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 && editingId !== "new" ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-24 text-muted-foreground"
                  >
                    No indexing rules configured. Your AI will lack context of
                    stored files.
                  </TableCell>
                </TableRow>
              ) : null}

              {/* New Rule Row Inline Form */}
              {editingId === "new" && (
                <TableRow className="bg-muted/30">
                  <TableCell>
                    <Switch
                      checked={editForm.is_active}
                      onCheckedChange={(c) =>
                        setEditForm({ ...editForm, is_active: c })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="drive"
                      value={editForm.bucket}
                      onChange={(e) =>
                        setEditForm({ ...editForm, bucket: e.target.value })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="/my/folder/"
                      value={editForm.folder_path}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          folder_path: e.target.value,
                        })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={editForm.include_subfolders}
                      onCheckedChange={(c) =>
                        setEditForm({ ...editForm, include_subfolders: c })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="pdf, txt, docx"
                      value={editForm.file_types_allowed?.join(", ") || ""}
                      onChange={(e) => handleFileTypesChange(e.target.value)}
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={handleSave}
                        aria-label="Sauvegarder"
                      >
                        <Save className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setEditingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Existing Rules */}
              {rules.map((rule) =>
                editingId === rule.id ? (
                  <TableRow key={rule.id} className="bg-muted/30">
                    <TableCell>
                      <Switch
                        checked={editForm.is_active}
                        onCheckedChange={(c) =>
                          setEditForm({ ...editForm, is_active: c })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.bucket}
                        onChange={(e) =>
                          setEditForm({ ...editForm, bucket: e.target.value })
                        }
                        className="h-8 font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.folder_path}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            folder_path: e.target.value,
                          })
                        }
                        className="h-8 font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={editForm.include_subfolders}
                        onCheckedChange={(c) =>
                          setEditForm({ ...editForm, include_subfolders: c })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.file_types_allowed?.join(", ") || ""}
                        onChange={(e) => handleFileTypesChange(e.target.value)}
                        className="h-8 font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={handleSave}
                          aria-label="Sauvegarder"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setEditingId(null)}
                          aria-label="Fermer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow
                    key={rule.id}
                    className={!rule.is_active ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleActive(rule)}
                        disabled={editingId !== null}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.bucket}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <FolderSync className="h-3 w-3 text-muted-foreground" />
                        {rule.folder_path}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.include_subfolders ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.file_types_allowed?.join(", ") || "All"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(rule)}
                          disabled={editingId !== null}
                          aria-label={`Modifier ${rule.bucket}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(rule.id)}
                          disabled={editingId !== null}
                          aria-label={`Supprimer ${rule.bucket}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
