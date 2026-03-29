"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X, HardDrive } from "lucide-react";
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
import { storageSettingsApi, StorageRule, UpsertStorageRule } from "@/lib/api/storageSettingsApi";

export function StorageRulesSettings() {
  const [rules, setRules] = useState<StorageRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state for new/editing
  const [editForm, setEditForm] = useState<UpsertStorageRule>({
    file_type: "",
    mime_type_pattern: "",
    target_bucket: "",
    target_backend: "fs",
    is_active: true,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const data = await storageSettingsApi.getStorageRules();
      setRules(data);
    } catch (error) {
      toast.error("Impossible de charger les règles de stockage");
      console.debug(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingId("new");
    setEditForm({
      file_type: "",
      mime_type_pattern: "",
      target_bucket: "",
      target_backend: "fs",
      is_active: true,
    });
  };

  const handleEdit = (rule: StorageRule) => {
    setEditingId(rule.id);
    setEditForm({
      file_type: rule.file_type,
      mime_type_pattern: rule.mime_type_pattern,
      target_bucket: rule.target_bucket,
      target_backend: rule.target_backend,
      is_active: rule.is_active,
    });
  };

  const handleSave = async () => {
    try {
      if (!editForm.file_type || !editForm.target_bucket) {
        toast.error("Le type de fichier et le bucket cible sont requis");
        return;
      }

      const payload = {
        ...editForm,
        mime_type_pattern: editForm.mime_type_pattern || null
      };

      if (editingId === "new") {
        await storageSettingsApi.createStorageRule(payload);
        toast.success("Règle de stockage créée");
      } else if (editingId) {
        await storageSettingsApi.updateStorageRule(editingId, payload);
        toast.success("Règle de stockage mise à jour");
      }
      
      setEditingId(null);
      fetchRules();
    } catch (error) {
      toast.error("Impossible d'enregistrer la règle de stockage");
      console.debug(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    
    try {
      await storageSettingsApi.deleteStorageRule(id);
      toast.success("Règle supprimée");
      fetchRules();
    } catch (error) {
      toast.error("Impossible de supprimer la règle");
      console.debug(error);
    }
  };

  const toggleActive = async (rule: StorageRule) => {
    try {
      await storageSettingsApi.updateStorageRule(rule.id, {
        file_type: rule.file_type,
        mime_type_pattern: rule.mime_type_pattern,
        target_bucket: rule.target_bucket,
        target_backend: rule.target_backend,
        is_active: !rule.is_active,
      });
      fetchRules();
    } catch (error) {
      toast.error("Impossible de modifier l'état de la règle");
      console.debug(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Configured Rules</h3>
        <Button onClick={handleCreateNew} disabled={editingId !== null} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Active</TableHead>
              <TableHead>File Type (Name)</TableHead>
              <TableHead>Mime pattern (SQL LIKE)</TableHead>
              <TableHead>Target Bucket</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell>
              </TableRow>
            ) : rules.length === 0 && editingId !== "new" ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No storage rules configured. Files will use the default bucket paths.
                </TableCell>
              </TableRow>
            ) : null}

            {/* New Rule Row Inline Form */}
            {editingId === "new" && (
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Switch 
                    checked={editForm.is_active} 
                    onCheckedChange={(c) => setEditForm({...editForm, is_active: c})} 
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    placeholder="e.g. Images" 
                    value={editForm.file_type}
                    onChange={(e) => setEditForm({...editForm, file_type: e.target.value})}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    placeholder="image/*" 
                    value={editForm.mime_type_pattern || ""}
                    onChange={(e) => setEditForm({...editForm, mime_type_pattern: e.target.value})}
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    placeholder="images_bucket" 
                    value={editForm.target_bucket}
                    onChange={(e) => setEditForm({...editForm, target_bucket: e.target.value})}
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
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
                      onCheckedChange={(c) => setEditForm({...editForm, is_active: c})} 
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={editForm.file_type}
                      onChange={(e) => setEditForm({...editForm, file_type: e.target.value})}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={editForm.mime_type_pattern || ""}
                      onChange={(e) => setEditForm({...editForm, mime_type_pattern: e.target.value})}
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                     <Input 
                      value={editForm.target_bucket}
                      onChange={(e) => setEditForm({...editForm, target_bucket: e.target.value})}
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
                  <TableCell>
                    <Switch 
                      checked={rule.is_active} 
                      onCheckedChange={() => toggleActive(rule)} 
                      disabled={editingId !== null}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{rule.file_type}</TableCell>
                  <TableCell className="font-mono text-sm">{rule.mime_type_pattern || "*"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      {rule.target_bucket}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(rule)} disabled={editingId !== null}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id)} disabled={editingId !== null}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
