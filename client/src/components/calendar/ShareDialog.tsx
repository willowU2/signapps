import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Plus } from "lucide-react";
import { useShares } from "@/hooks/use-shares";

interface ShareDialogProps {
  calendarId: string | null;
  calendarName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({
  calendarId,
  calendarName,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"owner" | "editor" | "viewer">("viewer");
  const [isAdding, setIsAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<{
    id: string;
    role: "owner" | "editor" | "viewer";
  } | null>(null);

  const {
    shares,
    loading,
    loadShares,
    shareCalendar,
    unshareCalendar,
    updatePermission,
  } = useShares(calendarId);

  useEffect(() => {
    if (open && calendarId) {
      loadShares();
    }
  }, [open, calendarId, loadShares]);

  const handleAddShare = async () => {
    if (!userId.trim()) return;

    try {
      setIsAdding(true);
      await shareCalendar(userId, role);
      setUserId("");
      setRole("viewer");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveShare = async () => {
    if (!removeId) return;

    try {
      await unshareCalendar(removeId);
      setRemoveId(null);
    } catch (err) {
      console.error("Failed to remove share:", err);
    }
  };

  const handleUpdateRole = async () => {
    if (!editRole) return;

    try {
      await updatePermission(editRole.id, editRole.role);
      setEditRole(null);
    } catch (err) {
      console.error("Failed to update permission:", err);
    }
  };

  const roleDescriptions: Record<string, string> = {
    owner: "Full access, can manage sharing",
    editor: "Can create and edit events",
    viewer: "Can only view events",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Calendar</DialogTitle>
            <DialogDescription>
              Manage access to <strong>{calendarName}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add new share */}
            <div className="space-y-3 border-b pb-6">
              <Label htmlFor="user-id" className="text-sm font-medium">
                User ID or Email
              </Label>
              <div className="flex gap-2">
                <Input
                  id="user-id"
                  placeholder="Enter user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleAddShare();
                  }}
                />
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {roleDescriptions[role]}
              </p>
              <Button
                onClick={handleAddShare}
                disabled={!userId.trim() || isAdding}
                className="w-full gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Shared users list */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Shared With</Label>
              {loading ? (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Loading...
                </div>
              ) : shares.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Not shared with anyone yet
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {shares.map((share) => (
                    <div
                      key={share.user_id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {share.user_name || share.user_id}
                        </p>
                        {share.user_email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {share.user_email}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={share.role}
                          onValueChange={(v: any) => setEditRole({ id: share.user_id, role: v })}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>

                        {editRole?.id === share.user_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleUpdateRole}
                            className="h-8"
                          >
                            Save
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoveId(share.user_id)}
                          className="h-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Share</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this person's access to the calendar?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveShare}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
