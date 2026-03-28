'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Key, Plus, Trash2, ShieldCheck, Usb, Smartphone, Info } from 'lucide-react';

interface SecurityKey {
  id: string;
  name: string;
  type: 'usb' | 'nfc' | 'hybrid';
  registered_at: string;
  last_used: string | null;
  aaguid: string;
}

const SAMPLE_KEYS: SecurityKey[] = [
  { id: '1', name: 'YubiKey 5C', type: 'usb', registered_at: new Date(Date.now() - 86400000 * 30).toISOString(), last_used: new Date(Date.now() - 3600000).toISOString(), aaguid: 'fa2b99dc-9e39-4257-8f92-4a30d23c4118' },
];

const TYPE_ICONS = { usb: Usb, nfc: Key, hybrid: Smartphone };

export function HardwareKeyRegistration() {
  const [keys, setKeys] = useState<SecurityKey[]>(SAMPLE_KEYS);
  const [registering, setRegistering] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleRegister = async () => {
    if (!keyName.trim()) { toast.error('Key name required'); return; }
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      toast.error('WebAuthn not supported in this browser');
      return;
    }
    setRegistering(true);
    try {
      // Simulated WebAuthn registration challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const newKey: SecurityKey = {
        id: Date.now().toString(),
        name: keyName,
        type: 'usb',
        registered_at: new Date().toISOString(),
        last_used: null,
        aaguid: crypto.randomUUID(),
      };
      setKeys(ks => [...ks, newKey]);
      setKeyName('');
      setShowForm(false);
      toast.success('Security key registered successfully');
    } catch {
      toast.error('Registration failed or cancelled');
    } finally {
      setRegistering(false);
    }
  };

  const removeKey = (id: string) => {
    setKeys(ks => ks.filter(k => k.id !== id));
    toast.success('Security key removed');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> WebAuthn / FIDO2 Keys</CardTitle>
              <CardDescription>Register hardware security keys (YubiKey, Google Titan, etc.) for phishing-resistant MFA</CardDescription>
            </div>
            <Button onClick={() => setShowForm(v => !v)}><Plus className="mr-2 h-4 w-4" /> Register Key</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              WebAuthn/FIDO2 requires a compatible authenticator (USB, NFC, or platform authenticator). Keys are stored per-user and cannot be transferred.
            </AlertDescription>
          </Alert>

          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="space-y-2">
                <Label>Key Nickname</Label>
                <Input placeholder="e.g., YubiKey Blue, Work Key..." value={keyName} onChange={e => setKeyName(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRegister} disabled={registering}>
                  {registering ? 'Waiting for key...' : 'Register Security Key'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground">When prompted, touch or tap your security key.</p>
            </div>
          )}

          <div className="space-y-3">
            {keys.map(key => {
              const Icon = TYPE_ICONS[key.type];
              return (
                <div key={key.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{key.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{key.type.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Registered {new Date(key.registered_at).toLocaleDateString()}
                        </span>
                        {key.last_used && (
                          <span className="text-xs text-muted-foreground">
                            · Used {new Date(key.last_used).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeKey(key.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {keys.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No hardware keys registered</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
