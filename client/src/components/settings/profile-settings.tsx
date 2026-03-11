'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export function ProfileSettings() {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Simulation of an API call to update profile
      await new Promise(r => setTimeout(r, 600));
      toast.success('Profil mis à jour avec succès');
    } catch {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Veuillez remplir les champs de mot de passe');
      return;
    }
    setSaving(true);
    try {
      // Simulation of an API call to update password
      await new Promise(r => setTimeout(r, 600));
      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      toast.error('Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>Mettez à jour vos informations publiques.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Nom d'affichage</Label>
            <Input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="ex: Jane Doe" 
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label>Email</Label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="ex: jane@example.com" 
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            Enregistrer les modifications
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
          <CardDescription>Modifiez votre mot de passe d'accès.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Mot de passe actuel</Label>
            <Input 
              type="password" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label>Nouveau mot de passe</Label>
            <Input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
            />
          </div>
          <Button onClick={handleUpdatePassword} variant="secondary" disabled={saving}>
            Mettre à jour le mot de passe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
