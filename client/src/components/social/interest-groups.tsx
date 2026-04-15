"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InterestGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isMember: boolean;
}

interface InterestGroupsProps {
  groups: InterestGroup[];
  onJoinGroup?: (groupId: string) => void;
  onLeaveGroup?: (groupId: string) => void;
  onCreateGroup?: (name: string, description: string) => void;
}

export function InterestGroups({
  groups,
  onJoinGroup,
  onLeaveGroup,
  onCreateGroup,
}: InterestGroupsProps) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateGroup = () => {
    if (groupName.trim() && groupDescription.trim()) {
      onCreateGroup?.(groupName, groupDescription);
      setGroupName("");
      setGroupDescription("");
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Interest Groups</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Interest Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Group Name</label>
                <Input
                  placeholder="e.g., AI Enthusiasts"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="What's this group about?"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || !groupDescription.trim()}
                className="w-full"
              >
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Card key={group.id} className="p-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <h3 className="font-semibold">{group.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {group.description}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {group.memberCount} members
              </p>
            </div>

            <Button
              onClick={() => {
                if (group.isMember) {
                  onLeaveGroup?.(group.id);
                } else {
                  onJoinGroup?.(group.id);
                }
              }}
              variant={group.isMember ? "outline" : "default"}
              className="w-full"
            >
              {group.isMember ? (
                <>
                  <X className="w-3 h-3 mr-1" /> Leave
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1" /> Join
                </>
              )}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
