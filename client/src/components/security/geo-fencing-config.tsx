'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Globe, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface GeoRule {
  id: string;
  country_code: string;
  country_name: string;
  action: 'allow' | 'block';
  enabled: boolean;
}

const COUNTRIES = [
  { code: 'FR', name: 'France' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'CN', name: 'China' }, { code: 'RU', name: 'Russia' },
  { code: 'KP', name: 'North Korea' }, { code: 'IR', name: 'Iran' },
  { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' }, { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' }, { code: 'NG', name: 'Nigeria' },
];

const DEFAULTS: GeoRule[] = [
  { id: '1', country_code: 'FR', country_name: 'France', action: 'allow', enabled: true },
  { id: '2', country_code: 'CN', country_name: 'China', action: 'block', enabled: true },
];

export function GeoFencingConfig() {
  const [enabled, setEnabled] = useState(false);
  const [defaultAction, setDefaultAction] = useState<'allow' | 'block'>('allow');
  const [rules, setRules] = useState<GeoRule[]>(DEFAULTS);
  const [country, setCountry] = useState('');
  const [action, setAction] = useState<'allow' | 'block'>('block');

  const addRule = () => {
    if (!country) { toast.error('Select a country'); return; }
    const c = COUNTRIES.find(x => x.code === country)!;
    if (rules.some(r => r.country_code === country)) { toast.error('Rule already exists for this country'); return; }
    setRules(rs => [...rs, { id: Date.now().toString(), country_code: c.code, country_name: c.name, action, enabled: true }]);
    setCountry('');
    toast.success(`Rule added: ${action} ${c.name}`);
  };

  const removeRule = (id: string) => { setRules(rs => rs.filter(r => r.id !== id)); };
  const toggleRule = (id: string) => { setRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)); };

  const save = () => toast.success('Geo-fencing rules saved');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Geo-Fencing Login Restrictions</CardTitle>
              <CardDescription>Allow or block login attempts by country based on IP geolocation</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'Active' : 'Disabled'}</Badge>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 p-3 border rounded-lg">
            <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Label>Default action for unlisted countries</Label>
              <p className="text-xs text-muted-foreground">Applied to any country not in the rules below</p>
            </div>
            <Select value={defaultAction} onValueChange={v => setDefaultAction(v as 'allow' | 'block')}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="block">Block</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select country..." /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={v => setAction(v as 'allow' | 'block')}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="block">Block</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addRule}><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r.id)} />
                  <span className="text-sm font-medium">{r.country_name}</span>
                  <span className="text-xs text-muted-foreground">{r.country_code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.action === 'allow' ? 'default' : 'destructive'} className="capitalize">
                    {r.action}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeRule(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="text-center py-4 text-muted-foreground text-sm">No rules configured</p>}
          </div>

          <Button onClick={save}>Save Rules</Button>
        </CardContent>
      </Card>
    </div>
  );
}
