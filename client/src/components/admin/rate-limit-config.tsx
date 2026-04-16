"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
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
import { toast } from "sonner";

interface RateLimitRule {
  id: string;
  endpointPattern: string;
  maxRequestsPerMin: number;
  burstSize: number;
  isActive: boolean;
}

interface EditFormState {
  endpointPattern: string;
  maxRequestsPerMin: string;
  burstSize: string;
  isActive: boolean;
}

const INITIAL_FORM_STATE: EditFormState = {
  endpointPattern: "",
  maxRequestsPerMin: "60",
  burstSize: "10",
  isActive: true,
};

export function RateLimitConfig() {
  const [rules, setRules] = useState<RateLimitRule[]>([
    {
      id: "1",
      endpointPattern: "/api/documents/*",
      maxRequestsPerMin: 100,
      burstSize: 20,
      isActive: true,
    },
    {
      id: "2",
      endpointPattern: "/api/upload",
      maxRequestsPerMin: 50,
      burstSize: 10,
      isActive: true,
    },
    {
      id: "3",
      endpointPattern: "/api/search/*",
      maxRequestsPerMin: 200,
      burstSize: 30,
      isActive: false,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(INITIAL_FORM_STATE);

  const handleCreateNew = () => {
    setEditingId("new");
    setEditForm(INITIAL_FORM_STATE);
  };

  const handleEdit = (rule: RateLimitRule) => {
    setEditingId(rule.id);
    setEditForm({
      endpointPattern: rule.endpointPattern,
      maxRequestsPerMin: rule.maxRequestsPerMin.toString(),
      burstSize: rule.burstSize.toString(),
      isActive: rule.isActive,
    });
  };

  const handleSave = async () => {
    try {
      if (
        !editForm.endpointPattern ||
        !editForm.maxRequestsPerMin ||
        !editForm.burstSize
      ) {
        toast.error("Tous les champs sont obligatoires");
        return;
      }

      const maxReq = parseInt(editForm.maxRequestsPerMin, 10);
      const burst = parseInt(editForm.burstSize, 10);

      if (isNaN(maxReq) || isNaN(burst) || maxReq <= 0 || burst <= 0) {
        toast.error("Les champs numériques doivent être des entiers positifs");
        return;
      }

      const newRule: RateLimitRule = {
        id: editingId === "new" ? Date.now().toString() : editingId!,
        endpointPattern: editForm.endpointPattern,
        maxRequestsPerMin: maxReq,
        burstSize: burst,
        isActive: editForm.isActive,
      };

      if (editingId === "new") {
        setRules([...rules, newRule]);
        toast.success("Règle de limitation créée");
      } else {
        setRules(rules.map((r) => (r.id === editingId ? newRule : r)));
        toast.success("Règle de limitation mise à jour");
      }

      setEditingId(null);
    } catch (error) {
      toast.error("Impossible d'enregistrer la règle de limitation");
      console.warn(error);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      setRules(rules.filter((r) => r.id !== id));
      toast.success("Règle supprimée");
    } catch (error) {
      toast.error("Impossible de supprimer la règle");
      console.warn(error);
    }
  };

  const toggleActive = (id: string) => {
    try {
      setRules(
        rules.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
      );
    } catch (error) {
      toast.error("Impossible de modifier l'état de la règle");
      console.warn(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Rate Limit Rules</h3>
        <Button
          onClick={handleCreateNew}
          disabled={editingId !== null}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint Pattern</TableHead>
              <TableHead>Max Requests/Min</TableHead>
              <TableHead>Burst Size</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : rules.length === 0 && editingId !== "new" ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center h-24 text-muted-foreground"
                >
                  No rate limit rules configured.
                </TableCell>
              </TableRow>
            ) : null}

            {editingId === "new" && (
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Input
                    placeholder="/api/endpoint/*"
                    value={editForm.endpointPattern}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        endpointPattern: e.target.value,
                      })
                    }
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="60"
                    type="number"
                    value={editForm.maxRequestsPerMin}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        maxRequestsPerMin: e.target.value,
                      })
                    }
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="10"
                    type="number"
                    value={editForm.burstSize}
                    onChange={(e) =>
                      setEditForm({ ...editForm, burstSize: e.target.value })
                    }
                    className="h-8 font-mono text-sm"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                    className="h-4 w-4"
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

            {rules.map((rule) =>
              editingId === rule.id ? (
                <TableRow key={rule.id} className="bg-muted/30">
                  <TableCell>
                    <Input
                      value={editForm.endpointPattern}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endpointPattern: e.target.value,
                        })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={editForm.maxRequestsPerMin}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          maxRequestsPerMin: e.target.value,
                        })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={editForm.burstSize}
                      onChange={(e) =>
                        setEditForm({ ...editForm, burstSize: e.target.value })
                      }
                      className="h-8 font-mono text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) =>
                        setEditForm({ ...editForm, isActive: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={handleSave}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  key={rule.id}
                  className={!rule.isActive ? "opacity-60" : ""}
                >
                  <TableCell className="font-mono text-sm">
                    {rule.endpointPattern}
                  </TableCell>
                  <TableCell className="text-sm">
                    {rule.maxRequestsPerMin}
                  </TableCell>
                  <TableCell className="text-sm">{rule.burstSize}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={rule.isActive}
                      onChange={() => toggleActive(rule.id)}
                      disabled={editingId !== null}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(rule)}
                        disabled={editingId !== null}
                        aria-label={`Modifier ${rule.endpointPattern}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rule.id)}
                        disabled={editingId !== null}
                        aria-label={`Supprimer ${rule.endpointPattern}`}
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
  );
}
