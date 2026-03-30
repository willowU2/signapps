'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Lock, Loader2 } from 'lucide-react';
import { IDENTITY_URL } from '@/lib/api/core';
import axios from 'axios';

interface PolicyData {
  min_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
  expiry_days: number | null;
  max_attempts: number;
  lockout_minutes: number;
}

const DEFAULTS: PolicyData = {
  min_length: 8,
  require_uppercase: false,
  require_number: false,
  require_special: false,
  expiry_days: null,
  max_attempts: 5,
  lockout_minutes: 15,
};

export function PasswordPolicyConfig() {
  const [policy, setPolicy] = useState<PolicyData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${IDENTITY_URL}/admin/security/password-policy`, {
        withCredentials: true,
      });
      setPolicy({ ...DEFAULTS, ...res.data });
    } catch {
      // Use defaults if no policy set yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${IDENTITY_URL}/admin/security/password-policy`,
        policy,
        { withCredentials: true }
      );
      toast.success('Politique de mot de passe sauvegardée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Politique de mots de passe
          </CardTitle>
          <CardDescription>
            Définissez les règles de complexité des mots de passe pour ce tenant.
            Appliqué lors de la création de compte et du changement de mot de passe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Complexity rules */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Règles de complexité</h4>

            <div className="space-y-2">
              <Label htmlFor="min-length">Longueur minimale</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="min-length"
                  type="number"
                  min={4}
                  max={128}
                  value={policy.min_length}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, min_length: Math.max(4, parseInt(e.target.value, 10) || 4) }))
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">caractères minimum</span>
              </div>
            </div>

            {[
              {
                key: 'require_uppercase' as const,
                label: 'Majuscule requise',
                description: 'Le mot de passe doit contenir au moins une majuscule (A–Z)',
              },
              {
                key: 'require_number' as const,
                label: 'Chiffre requis',
                description: 'Le mot de passe doit contenir au moins un chiffre (0–9)',
              },
              {
                key: 'require_special' as const,
                label: 'Caractère spécial requis',
                description: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$…)',
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-start gap-3">
                <Switch
                  checked={policy[key]}
                  onCheckedChange={(v) => setPolicy((p) => ({ ...p, [key]: v }))}
                  className="mt-0.5"
                />
                <div>
                  <Label className="cursor-pointer">{label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Expiry */}
          <div className="space-y-3 border-t pt-5">
            <h4 className="text-sm font-semibold">Expiration</h4>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={365}
                placeholder="90"
                value={policy.expiry_days ?? ''}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    expiry_days: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                jours avant expiration (vide = jamais)
              </span>
            </div>
          </div>

          {/* Account lockout */}
          <div className="space-y-3 border-t pt-5">
            <h4 className="text-sm font-semibold">Verrouillage du compte</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-attempts">Tentatives max avant verrouillage</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={1}
                  max={20}
                  value={policy.max_attempts}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      max_attempts: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockout-minutes">Durée du verrouillage (minutes)</Label>
                <Input
                  id="lockout-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={policy.lockout_minutes}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      lockout_minutes: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="w-24"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sauvegarder la politique
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
