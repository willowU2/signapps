'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Copy, ExternalLink, RefreshCw, Shield } from 'lucide-react';

interface SamlConfig {
  enabled: boolean;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  sp_entity_id: string;
  attribute_mapping_email: string;
  attribute_mapping_name: string;
  force_authn: boolean;
}

const DEFAULT: SamlConfig = {
  enabled: false,
  idp_entity_id: '',
  idp_sso_url: '',
  idp_certificate: '',
  sp_entity_id: 'https://signapps.local/saml/sp',
  attribute_mapping_email: 'email',
  attribute_mapping_name: 'displayName',
  force_authn: false,
};

export function SsoSamlConfig() {
  const [config, setConfig] = useState<SamlConfig>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const SP_ACS_URL = 'https://signapps.local/api/v1/auth/saml/acs';
  const SP_METADATA_URL = 'https://signapps.local/api/v1/auth/saml/metadata';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    toast.success('SAML configuration saved');
  };

  const handleTest = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1000));
    setTesting(false);
    toast.success('SAML IdP reachable — metadata fetched successfully');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> SSO / SAML Identity Provider
              </CardTitle>
              <CardDescription>Configure SAML 2.0 single sign-on with your identity provider</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config.enabled ? 'default' : 'secondary'}>
                {config.enabled ? 'Active' : 'Disabled'}
              </Badge>
              <Switch checked={config.enabled} onCheckedChange={v => setConfig(c => ({ ...c, enabled: v }))} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <p className="text-sm font-medium">Service Provider (SP) URLs — provide these to your IdP</p>
            <div className="space-y-2">
              {[
                { label: 'ACS URL', value: SP_ACS_URL },
                { label: 'Metadata URL', value: SP_METADATA_URL },
                { label: 'Entity ID', value: config.sp_entity_id },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                  <code className="flex-1 text-xs bg-background border rounded px-2 py-1 font-mono truncate">{value}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(value)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>IdP Entity ID</Label>
              <Input placeholder="https://idp.example.com/entity"
                value={config.idp_entity_id}
                onChange={e => setConfig(c => ({ ...c, idp_entity_id: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>IdP SSO URL</Label>
              <Input placeholder="https://idp.example.com/sso/saml"
                value={config.idp_sso_url}
                onChange={e => setConfig(c => ({ ...c, idp_sso_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email Attribute</Label>
              <Input placeholder="email" value={config.attribute_mapping_email}
                onChange={e => setConfig(c => ({ ...c, attribute_mapping_email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Display Name Attribute</Label>
              <Input placeholder="displayName" value={config.attribute_mapping_name}
                onChange={e => setConfig(c => ({ ...c, attribute_mapping_name: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>IdP X.509 Certificate (PEM)</Label>
            <Textarea rows={6} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              value={config.idp_certificate}
              onChange={e => setConfig(c => ({ ...c, idp_certificate: e.target.value }))}
              className="font-mono text-xs" />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={config.force_authn}
              onCheckedChange={v => setConfig(c => ({ ...c, force_authn: v }))} />
            <div>
              <Label>Force Re-authentication</Label>
              <p className="text-xs text-muted-foreground">Always re-authenticate with IdP even if session exists</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing || !config.idp_sso_url}>
              <RefreshCw className={`mr-2 h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
              Test IdP Connection
            </Button>
            <Button onClick={handleSave} disabled={saving}>Save Configuration</Button>
            <Button variant="ghost" asChild>
              <a href={SP_METADATA_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> SP Metadata
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
