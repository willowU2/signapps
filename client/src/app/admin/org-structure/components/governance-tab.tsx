"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Users, UserPlus, Gavel, Star, Info, X } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  Person,
  OrgNode,
  EffectiveBoard,
  OrgBoardMember,
} from "@/types/org";
import { BOARD_ROLE_LABELS, BOARD_ROLE_SUGGESTIONS } from "./tab-config";

// =============================================================================
// GovernanceTab
// =============================================================================

export interface GovernanceTabProps {
  nodeId: string;
  persons: Person[];
  allNodes: OrgNode[];
}

export function GovernanceTab({
  nodeId,
  persons,
  allNodes,
}: GovernanceTabProps) {
  const [effectiveBoard, setEffectiveBoard] = useState<EffectiveBoard | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberPersonId, setMemberPersonId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [memberIsDecisionMaker, setMemberIsDecisionMaker] = useState(false);
  const [memberPersonSearch, setMemberPersonSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const loadBoard = useCallback(async () => {
    if (typeof orgApi.nodes.board !== "function") return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await orgApi.nodes.board(nodeId);
      setEffectiveBoard(res.data ?? null);
    } catch {
      setEffectiveBoard(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const handleCreateBoard = async () => {
    setCreatingBoard(true);
    try {
      await orgApi.nodes.createBoard(nodeId);
      toast.success("Board de gouvernance cree");
      await loadBoard();
    } catch {
      toast.error("Erreur lors de la creation du board");
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberPersonId) return;
    setAddingMember(true);
    try {
      await orgApi.nodes.addBoardMember(nodeId, {
        person_id: memberPersonId,
        role: memberRole,
        is_decision_maker: memberIsDecisionMaker,
        sort_order: (effectiveBoard?.members?.length ?? 0) + 1,
      });
      toast.success("Membre ajoute au board");
      setAddMemberOpen(false);
      setMemberPersonId("");
      setMemberRole("member");
      setMemberIsDecisionMaker(false);
      setMemberPersonSearch("");
      await loadBoard();
    } catch {
      toast.error("Erreur lors de l'ajout du membre");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await orgApi.nodes.removeBoardMember(nodeId, memberId);
      toast.success("Membre retire du board");
      await loadBoard();
    } catch {
      toast.error("Erreur lors du retrait du membre");
    } finally {
      setRemovingMember(null);
    }
  };

  const filteredBoardPersons = useMemo(() => {
    if (!memberPersonSearch) return persons;
    const q = memberPersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, memberPersonSearch]);

  const getPersonName = (personId: string): string => {
    const p = persons.find((p) => p.id === personId);
    return p ? `${p.first_name} ${p.last_name}` : personId.slice(0, 8) + "...";
  };

  const getPersonInitials = (personId: string): string => {
    const p = persons.find((p) => p.id === personId);
    return p ? `${p.first_name[0]}${p.last_name[0]}` : "?";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement de la gouvernance...
      </div>
    );
  }

  const isInherited = !!effectiveBoard?.inherited_from_node_id;
  const inheritedNodeName =
    effectiveBoard?.inherited_from_node_name ??
    allNodes.find((n) => n.id === effectiveBoard?.inherited_from_node_id)
      ?.name ??
    "noeud parent";
  const members = effectiveBoard?.members ?? [];

  return (
    <div className="p-4 space-y-4">
      {/* Inherited banner */}
      {isInherited && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Board herite de{" "}
              <span className="font-semibold">{inheritedNodeName}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
            className="shrink-0"
          >
            {creatingBoard ? "Creation..." : "Definir un board propre"}
          </Button>
        </div>
      )}

      {/* No board at all */}
      {!effectiveBoard && !loadError && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun board de gouvernance</p>
          <p className="text-xs mt-1">
            Creez un board pour definir les decideurs
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
          >
            {creatingBoard ? "Creation..." : "Creer un board"}
          </Button>
        </div>
      )}

      {loadError && !effectiveBoard && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun board de gouvernance</p>
          <p className="text-xs mt-1">
            Creez un board pour definir les decideurs
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
          >
            {creatingBoard ? "Creation..." : "Creer un board"}
          </Button>
        </div>
      )}

      {/* Board members list */}
      {effectiveBoard && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {members.length} membre(s) du board
            </p>
            {!isInherited && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMemberOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Ajouter un membre
              </Button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p>Aucun membre dans le board</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m: OrgBoardMember) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getPersonInitials(m.person_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getPersonName(m.person_id)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {BOARD_ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                  {m.is_decision_maker && (
                    <Star className="h-4 w-4 shrink-0 text-amber-500 fill-amber-500" />
                  )}
                  {!isInherited && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={removingMember === m.id}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add member inline form */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre au board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rechercher une personne *</Label>
              <Input
                value={memberPersonSearch}
                onChange={(e) => setMemberPersonSearch(e.target.value)}
                placeholder="Nom, prenom ou email..."
              />
              <Select value={memberPersonId} onValueChange={setMemberPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredBoardPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_ROLE_SUGGESTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {BOARD_ROLE_LABELS[role] ?? role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
              <Checkbox
                checked={memberIsDecisionMaker}
                onCheckedChange={(checked) =>
                  setMemberIsDecisionMaker(checked === true)
                }
              />
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Decideur final</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addingMember || !memberPersonId}
            >
              {addingMember ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
