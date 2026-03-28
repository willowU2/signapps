"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, UsersRound, UserPlus, UserMinus } from "lucide-react";

export interface Group {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

const GROUP_COLORS = [
  "bg-blue-100 text-blue-800", "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800", "bg-orange-100 text-orange-800",
  "bg-pink-100 text-pink-800", "bg-teal-100 text-teal-800",
];

interface ContactGroupsProps {
  contacts: { id: string; name: string; email: string }[];
  groups: Group[];
  onGroupsChange: (groups: Group[]) => void;
}

export function ContactGroups({ contacts, groups, onGroupsChange }: ContactGroupsProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newGroupName.trim()) return;
    const g: Group = {
      id: crypto.randomUUID(), name: newGroupName.trim(),
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length], memberIds: [],
    };
    onGroupsChange([...groups, g]);
    setNewGroupName("");
  };

  const handleDelete = (id: string) => {
    onGroupsChange(groups.filter((g) => g.id !== id));
  };

  const handleAddMember = (groupId: string, contactId: string) => {
    onGroupsChange(groups.map((g) =>
      g.id !== groupId ? g : { ...g, memberIds: g.memberIds.includes(contactId) ? g.memberIds : [...g.memberIds, contactId] }
    ));
    setAddingMemberId(null);
  };

  const handleRemoveMember = (groupId: string, contactId: string) => {
    onGroupsChange(groups.map((g) =>
      g.id !== groupId ? g : { ...g, memberIds: g.memberIds.filter((id) => id !== contactId) }
    ));
  };

  return (
    <div className="space-y-4">
      {/* Create group */}
      <div className="flex gap-2">
        <Input
          placeholder="Nom du groupe..."
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          className="flex-1"
        />
        <Button onClick={handleCreate} className="gap-1" disabled={!newGroupName.trim()}>
          <Plus className="size-4" /> Créer
        </Button>
      </div>

      {/* Group list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const members = contacts.filter((c) => g.memberIds.includes(c.id));
          const nonMembers = contacts.filter((c) => !g.memberIds.includes(c.id));
          const isExpanded = expandedId === g.id;

          return (
            <Card key={g.id} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : g.id)}>
                    <UsersRound className="size-4 text-primary" />
                    {g.name}
                    <Badge className={`text-xs ${g.color}`}>{members.length}</Badge>
                  </CardTitle>
                  <Button size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(g.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-2">
                  {members.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{c.name}</span>
                      <Button size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(g.id, c.id)}>
                        <UserMinus className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {addingMemberId === g.id ? (
                    <div className="space-y-1">
                      {nonMembers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Tous les contacts sont membres.</p>
                      ) : (
                        nonMembers.slice(0, 8).map((c) => (
                          <button key={c.id} onClick={() => handleAddMember(g.id, c.id)}
                            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted flex items-center gap-2">
                            <UserPlus className="size-3 text-primary" />
                            {c.name}
                            <span className="text-muted-foreground ml-auto truncate">{c.email}</span>
                          </button>
                        ))
                      )}
                      <Button size="sm" variant="ghost" className="w-full h-6 text-xs" onClick={() => setAddingMemberId(null)}>
                        Fermer
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1"
                      onClick={() => setAddingMemberId(g.id)}>
                      <UserPlus className="size-3" /> Ajouter membre
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {groups.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">Aucun groupe. Créez-en un ci-dessus.</p>
      )}
    </div>
  );
}
