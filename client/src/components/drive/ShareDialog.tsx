'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DriveNode } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: DriveNode | null;
}

export function ShareDialog({ open, onOpenChange, node }: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!node || !email) return;

    setLoading(true);
    try {
      // In a real implementation this would call driveApi.shareNode(node.id, user_id, role)
      // For now we simulate.
      await new Promise(r => setTimeout(r, 600));
      toast.success(`Le fichier a été partagé avec ${email} en tant que ${role}`);
      onOpenChange(false);
      setEmail('');
    } catch {
      toast.error('Erreur lors du partage');
    } finally {
      setLoading(false);
    }
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Partager "{node.name}"</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Utilisateur (Email)</Label>
            <Input 
              placeholder="ex: jean.dupont@signapps.fr" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Lecteur (Consultation seule)</SelectItem>
                <SelectItem value="editor">Éditeur (Modification permise)</SelectItem>
                <SelectItem value="manager">Gestionnaire (Peut partager)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleShare} disabled={loading || !email}>
            {loading ? 'Partage...' : 'Partager'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
