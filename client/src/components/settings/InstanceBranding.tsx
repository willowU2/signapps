'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const client = () => getClient(ServiceName.IDENTITY);
const LOGO_KEY = 'signapps-instance-logo';
const NAME_KEY = 'signapps-instance-name';

export function InstanceBranding() {
  const [instanceName, setInstanceName] = useState('SignApps');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedName = localStorage.getItem(NAME_KEY) || 'SignApps';
    const storedLogo = localStorage.getItem(LOGO_KEY);
    setInstanceName(storedName);
    setLogoUrl(storedLogo);
    // Apply to DOM
    if (storedName) applyName(storedName);
  }, []);

  function applyName(name: string) {
    document.title = name;
    // Update manifest name dynamically (for PWA)
    const el = document.querySelector('meta[name="application-name"]');
    if (el) el.setAttribute('content', name);
  }

  const saveName = async () => {
    localStorage.setItem(NAME_KEY, instanceName);
    applyName(instanceName);
    try {
      await client().patch('/tenant', { name: instanceName });
    } catch { /* persist locally */ }
    toast.success('Nom mis à jour');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo trop grand (max 2 Mo)'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Format invalide'); return; }

    setUploading(true);
    try {
      // Convert to base64 for local storage
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setLogoUrl(dataUrl);
        localStorage.setItem(LOGO_KEY, dataUrl);
        toast.success('Logo mis à jour');
        setUploading(false);
      };
      reader.readAsDataURL(file);

      // Also try uploading to server
      const formData = new FormData();
      formData.append('logo', file);
      await client().post('/tenant/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    localStorage.removeItem(LOGO_KEY);
    try { client().delete('/tenant/logo'); } catch {}
    toast.success('Logo supprimé');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Identité de l'instance
        </CardTitle>
        <CardDescription>
          Personnalisez le nom et le logo de votre instance SignApps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="w-16 h-16 rounded-lg">
              {logoUrl ? (
                <AvatarImage src={logoUrl} alt="Logo" />
              ) : (
                <AvatarFallback className="rounded-lg text-lg font-bold bg-primary text-primary-foreground">
                  {instanceName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-3 h-3 mr-1" />
                {uploading ? 'Upload...' : 'Logo'}
              </Button>
              {logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={removeLogo}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          <div className="flex-1 space-y-2">
            <Label htmlFor="instance-name">Nom de l'instance</Label>
            <div className="flex gap-2">
              <Input
                id="instance-name"
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
                placeholder="Nom de votre organisation"
                maxLength={50}
              />
              <Button onClick={saveName} disabled={!instanceName.trim()}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Affiché dans la barre de titre, les emails et les documents.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
