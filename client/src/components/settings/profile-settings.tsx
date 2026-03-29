'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { useAuthStore } from '@/lib/store';
import { usersApi } from '@/lib/api/identity';
import { toast } from 'sonner';


export function ProfileSettings() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const response = await usersApi.update(user.id, {
        display_name: displayName,
        email: email,
      });
      // Update the user in auth store
      setUser(response.data);
      toast.success('Profil mis à jour avec succès');
    } catch {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword) {
      toast.error('Veuillez remplir les champs de mot de passe');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.update(user.id, {
        password: newPassword,
      });
      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      toast.error('Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSavingPassword(false);
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
          <LoadingButton onClick={handleSaveProfile} loading={savingProfile} loadingText="Enregistrement...">
            Enregistrer les modifications
          </LoadingButton>
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
          <LoadingButton onClick={handleUpdatePassword} variant="secondary" loading={savingPassword} loadingText="Mise à jour...">
            Mettre à jour le mot de passe
          </LoadingButton>
        </CardContent>
      </Card>
    </div>
  );
}
