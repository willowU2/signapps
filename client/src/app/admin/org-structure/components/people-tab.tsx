"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  Assignment,
  Person,
  AssignmentType,
  ResponsibilityType,
} from "@/types/org";

// =============================================================================
// Local constants
// =============================================================================

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "Titulaire",
  interim: "Interimaire",
  deputy: "Adjoint",
  intern: "Stagiaire",
  contractor: "Prestataire",
};

const RESPONSIBILITY_TYPE_LABELS: Record<string, string> = {
  hierarchical: "Hierarchique",
  functional: "Fonctionnel",
  matrix: "Matriciel",
};

type AssignmentWithPerson = Assignment & { person?: Person };

// =============================================================================
// PeopleTab
// =============================================================================

export interface PeopleTabProps {
  nodeId: string;
  nodeName: string;
  persons: Person[];
}

export function PeopleTab({ nodeId, nodeName, persons }: PeopleTabProps) {
  const [assignments, setAssignments] = useState<AssignmentWithPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPersonSearch, setAssignPersonSearch] = useState("");
  const [assignPersonId, setAssignPersonId] = useState("");
  const [assignType, setAssignType] = useState<AssignmentType>("holder");
  const [assignResponsibility, setAssignResponsibility] =
    useState<ResponsibilityType>("hierarchical");
  const [assignFte, setAssignFte] = useState("1.0");
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignCreating, setAssignCreating] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.nodes.assignments(nodeId);
      setAssignments((res.data ?? []) as AssignmentWithPerson[]);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleCreateAssignment = async () => {
    if (!assignPersonId) return;
    setAssignCreating(true);
    try {
      await orgApi.assignments.create({
        person_id: assignPersonId,
        node_id: nodeId,
        assignment_type: assignType,
        responsibility_type: assignResponsibility,
        fte_ratio: parseFloat(assignFte) || 1.0,
        start_date: assignStartDate || new Date().toISOString().split("T")[0],
        is_primary: true,
      });
      toast.success("Affectation creee");
      setAssignDialogOpen(false);
      setAssignPersonId("");
      setAssignPersonSearch("");
      setAssignType("holder");
      setAssignResponsibility("hierarchical");
      setAssignFte("1.0");
      setAssignStartDate("");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setAssignCreating(false);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    setEndingAssignment(assignmentId);
    try {
      await orgApi.assignments.end(assignmentId, "Fin d'affectation");
      toast.success("Affectation terminee");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la cloture");
    } finally {
      setEndingAssignment(null);
    }
  };

  const filteredPersons = useMemo(() => {
    if (!assignPersonSearch) return persons;
    const q = assignPersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, assignPersonSearch]);

  return (
    <div className="p-4 space-y-4 mt-0">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} personne(s) affectee(s)
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAssignDialogOpen(true);
            setAssignStartDate(new Date().toISOString().split("T")[0]);
          }}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Affecter
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Chargement...
        </p>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          Aucune affectation pour ce noeud
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {a.person
                    ? `${a.person.first_name[0]}${a.person.last_name[0]}`
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {a.person
                    ? `${a.person.first_name} ${a.person.last_name}`
                    : a.person_id}
                </p>
                {a.person?.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {a.person.email}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {ASSIGNMENT_TYPE_LABELS[a.assignment_type] ?? a.assignment_type}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleEndAssignment(a.id)}
                disabled={endingAssignment === a.id}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Assignment creation dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Affecter une personne a &laquo;{nodeName}&raquo;
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rechercher une personne *</Label>
              <Input
                value={assignPersonSearch}
                onChange={(e) => setAssignPersonSearch(e.target.value)}
                placeholder="Nom, prenom ou email..."
              />
              <Select value={assignPersonId} onValueChange={setAssignPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type d&apos;affectation</Label>
                <Select
                  value={assignType}
                  onValueChange={(v) => setAssignType(v as AssignmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsabilite</Label>
                <Select
                  value={assignResponsibility}
                  onValueChange={(v) =>
                    setAssignResponsibility(v as ResponsibilityType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESPONSIBILITY_TYPE_LABELS).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assign-fte">Ratio ETP</Label>
                <Input
                  id="assign-fte"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={assignFte}
                  onChange={(e) => setAssignFte(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-start">Date de debut</Label>
                <Input
                  id="assign-start"
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateAssignment}
              disabled={assignCreating || !assignPersonId}
            >
              {assignCreating ? "Affectation..." : "Affecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
