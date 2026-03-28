'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { UserCog } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/lib/api-admin';

interface ImpersonateDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const IMPERSONATE_KEY = 'impersonate_user_id';
const IMPERSONATE_BANNER_KEY = 'impersonate_banner';

export function ImpersonateDialog({ user, open, onOpenChange }: ImpersonateDialogProps) {
  const handleConfirm = () => {
    // Store the impersonation context in sessionStorage (clears on tab close)
    sessionStorage.setItem(IMPERSONATE_KEY, user.id);
    sessionStorage.setItem(IMPERSONATE_BANNER_KEY, JSON.stringify({
      userId: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
    }));
    toast.success(`Now viewing as ${user.display_name || user.username}`, {
      description: 'A banner will appear. Reload to exit impersonation.',
      duration: 5000,
    });
    onOpenChange(false);
    // Reload the dashboard page
    window.location.href = '/dashboard';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            View as User
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to impersonate{' '}
              <span className="font-semibold text-foreground">
                {user.display_name || user.username}
              </span>
              .
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">ID: {user.id.slice(0, 8)}...</Badge>
              {user.email && <Badge variant="outline">{user.email}</Badge>}
              <Badge variant="secondary">
                Role: {user.role >= 2 ? 'Admin' : user.role === 1 ? 'User' : 'Guest'}
              </Badge>
            </div>
            <p className="text-amber-600 text-sm font-medium">
              Your actions may affect real data. A yellow banner will remind you that
              you are impersonating. Close the tab or click "Exit" in the banner to stop.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            View as {user.username}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
