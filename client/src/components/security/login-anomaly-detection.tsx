'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, Eye, Clock, Globe, Monitor, CheckCircle2 } from 'lucide-react';

interface AnomalyEvent {
  id: string;
  user: string;
  type: 'new_country' | 'new_device' | 'unusual_time' | 'multiple_failures';
  detail: string;
  ip: string;
  timestamp: string;
  resolved: boolean;
}

const SAMPLE_EVENTS: AnomalyEvent[] = [
  { id: '1', user: 'alice@corp.local', type: 'new_country', detail: 'Login from Romania (RO) — never seen before', ip: '89.32.44.1', timestamp: new Date(Date.now() - 3600000).toISOString(), resolved: false },
  { id: '2', user: 'bob@corp.local', type: 'unusual_time', detail: 'Login at 3:42 AM — outside normal hours (9-18h)', ip: '10.0.0.55', timestamp: new Date(Date.now() - 7200000).toISOString(), resolved: false },
  { id: '3', user: 'admin@corp.local', type: 'multiple_failures', detail: '8 failed attempts before success', ip: '192.168.1.12', timestamp: new Date(Date.now() - 86400000).toISOString(), resolved: true },
  { id: '4', user: 'carol@corp.local', type: 'new_device', detail: 'New browser fingerprint detected (Firefox/Linux)', ip: '10.0.1.33', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), resolved: true },
];

const TYPE_CONFIG = {
  new_country: { icon: Globe, label: 'New Country', color: 'text-orange-500' },
  new_device: { icon: Monitor, label: 'New Device', color: 'text-blue-500' },
  unusual_time: { icon: Clock, label: 'Unusual Time', color: 'text-purple-500' },
  multiple_failures: { icon: AlertTriangle, label: 'Multiple Failures', color: 'text-red-500' },
};

export function LoginAnomalyDetection() {
  const [events, setEvents] = useState<AnomalyEvent[]>(SAMPLE_EVENTS);
  const [detectCountry, setDetectCountry] = useState(true);
  const [detectDevice, setDetectDevice] = useState(true);
  const [detectTime, setDetectTime] = useState(true);
  const [detectFailures, setDetectFailures] = useState(true);
  const [alertEmail, setAlertEmail] = useState('security@corp.local');
  const [failureThreshold, setFailureThreshold] = useState('5');

  const resolve = (id: string) => {
    setEvents(es => es.map(e => e.id === id ? { ...e, resolved: true } : e));
    toast.success('Event marked as resolved');
  };

  const unresolved = events.filter(e => !e.resolved);
  const resolved = events.filter(e => e.resolved);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Anomaly Detection Configuration</CardTitle>
          <CardDescription>Configure alerts for suspicious login patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: 'New country login', desc: 'Alert when user logs in from a new country', val: detectCountry, set: setDetectCountry },
              { label: 'New device/browser', desc: 'Alert on unrecognized browser fingerprint', val: detectDevice, set: setDetectDevice },
              { label: 'Unusual time', desc: 'Alert on logins outside working hours', val: detectTime, set: setDetectTime },
              { label: 'Multiple failures', desc: 'Alert after repeated failed attempts', val: detectFailures, set: setDetectFailures },
            ].map(({ label, desc, val, set }) => (
              <div key={label} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={val} onCheckedChange={set} />
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <div className="space-y-2">
              <Label>Alert Email</Label>
              <Input value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="security@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Failure Threshold (before alert)</Label>
              <Input type="number" value={failureThreshold} onChange={e => setFailureThreshold(e.target.value)} min="1" max="20" />
            </div>
          </div>
          <Button onClick={() => toast.success('Settings saved')}>Save Settings</Button>
        </CardContent>
      </Card>

      {unresolved.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Active Alerts ({unresolved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unresolved.map(ev => {
              const { icon: Icon, label, color } = TYPE_CONFIG[ev.type];
              return (
                <div key={ev.id} className="flex items-start justify-between border rounded-lg p-3 bg-orange-500/5">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ev.user}</span>
                        <Badge variant="outline" className="text-xs">{label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
                      <p className="text-xs text-muted-foreground">IP: {ev.ip} · {new Date(ev.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => resolve(ev.id)}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Event History ({resolved.length} resolved)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {resolved.map(ev => {
            const { icon: Icon, label, color } = TYPE_CONFIG[ev.type];
            return (
              <div key={ev.id} className="flex items-start gap-3 border rounded-lg p-3 opacity-60">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                <div>
                  <span className="text-sm font-medium">{ev.user}</span>
                  <Badge variant="secondary" className="text-xs ml-2">{label}</Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs text-green-600">Resolved</Badge>
              </div>
            );
          })}
          {resolved.length === 0 && <p className="text-center py-4 text-muted-foreground text-sm">No resolved events</p>}
        </CardContent>
      </Card>
    </div>
  );
}
