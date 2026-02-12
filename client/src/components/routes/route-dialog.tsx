'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Plus,
  Trash2,
  Globe,
  Shield,
  FileCode,
  AlertTriangle,
  Lock,
  Unlock,
  Server,
  Info,
} from 'lucide-react';
import { routesApi, Route, CreateRouteRequest, ShieldConfig, HeadersConfig, HeaderEntry, TlsConfig, DnsRecord, GeoBlockConfig } from '@/lib/api';
import { toast } from 'sonner';

interface RouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: Route | null;
  onSuccess: () => void;
}

const defaultShieldConfig: ShieldConfig = {
  enabled: false,
  requests_per_second: 100,
  burst_size: 200,
  block_duration_seconds: 300,
  whitelist: [],
  blacklist: [],
};

const defaultHeadersConfig: HeadersConfig = {
  request_headers: [],
  response_headers: [],
  remove_request_headers: [],
  remove_response_headers: [],
};

const defaultTlsConfig: TlsConfig = {
  wildcard: false,
  force_https: true,
  min_version: 'TLS1.2',
  covered_domains: [],
};

const defaultDnsRecord: DnsRecord = {
  type: 'A',
  name: '@',
  value: '',
  ttl: 3600,
};

// Domain validation regex
const DOMAIN_REGEX = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const SUBDOMAIN_REGEX = /^(@|\*|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)$/;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/;

export function RouteDialog({ open, onOpenChange, route, onSuccess }: RouteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // General settings
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'proxy' | 'redirect' | 'static' | 'loadbalancer'>('proxy');
  const [tlsEnabled, setTlsEnabled] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Shield config
  const [shieldConfig, setShieldConfig] = useState<ShieldConfig>(defaultShieldConfig);
  const [newWhitelistIp, setNewWhitelistIp] = useState('');
  const [newBlacklistIp, setNewBlacklistIp] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');

  // Headers config
  const [headersConfig, setHeadersConfig] = useState<HeadersConfig>(defaultHeadersConfig);
  const [newReqHeader, setNewReqHeader] = useState({ name: '', value: '' });
  const [newResHeader, setNewResHeader] = useState({ name: '', value: '' });
  const [newRemoveReqHeader, setNewRemoveReqHeader] = useState('');
  const [newRemoveResHeader, setNewRemoveResHeader] = useState('');

  // TLS config
  const [tlsConfig, setTlsConfig] = useState<TlsConfig>(defaultTlsConfig);

  // DNS records
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [newDnsRecord, setNewDnsRecord] = useState<DnsRecord>({ ...defaultDnsRecord });
  const [dnsValidationError, setDnsValidationError] = useState<string | null>(null);

  const isEdit = !!route;

  useEffect(() => {
    if (route) {
      setName(route.name);
      setHost(route.host);
      setTarget(route.target);
      setMode(route.mode);
      setTlsEnabled(route.tls_enabled);
      setTlsConfig(route.tls_config || defaultTlsConfig);
      setAuthRequired(route.auth_required);
      setEnabled(route.enabled);
      setShieldConfig(route.shield_config || defaultShieldConfig);
      setHeadersConfig(route.headers || defaultHeadersConfig);
      setDnsRecords(route.dns_records || []);
    } else {
      setName('');
      setHost('');
      setTarget('');
      setMode('proxy');
      setTlsEnabled(true);
      setTlsConfig(defaultTlsConfig);
      setAuthRequired(false);
      setEnabled(true);
      setShieldConfig(defaultShieldConfig);
      setHeadersConfig(defaultHeadersConfig);
      setDnsRecords([]);
    }
    setActiveTab('general');
    setNewDnsRecord({ ...defaultDnsRecord });
    setDnsValidationError(null);
  }, [route, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Build TLS config with covered domains for wildcard
    const finalTlsConfig: TlsConfig | undefined = tlsEnabled ? {
      ...tlsConfig,
      covered_domains: tlsConfig.wildcard ? computeCoveredDomains(host) : [],
    } : undefined;

    const formData: CreateRouteRequest = {
      name,
      host,
      target,
      mode,
      tls_enabled: tlsEnabled,
      tls_config: finalTlsConfig,
      auth_required: authRequired,
      enabled,
      shield_config: shieldConfig.enabled ? shieldConfig : undefined,
      headers: (headersConfig.request_headers.length > 0 ||
                headersConfig.response_headers.length > 0 ||
                headersConfig.remove_request_headers.length > 0 ||
                headersConfig.remove_response_headers.length > 0) ? headersConfig : undefined,
      dns_records: dnsRecords.length > 0 ? dnsRecords : undefined,
    };

    try {
      if (isEdit && route) {
        await routesApi.update(route.id, formData);
        toast.success('Route mise à jour avec succès');
      } else {
        await routesApi.create(formData);
        toast.success('Route créée avec succès');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save route:', error);
      toast.error(isEdit ? 'Erreur lors de la mise à jour' : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  // Shield helpers
  const addWhitelistIp = () => {
    if (newWhitelistIp && !shieldConfig.whitelist.includes(newWhitelistIp)) {
      setShieldConfig({
        ...shieldConfig,
        whitelist: [...shieldConfig.whitelist, newWhitelistIp],
      });
      setNewWhitelistIp('');
    }
  };

  const removeWhitelistIp = (ip: string) => {
    setShieldConfig({
      ...shieldConfig,
      whitelist: shieldConfig.whitelist.filter(i => i !== ip),
    });
  };

  const addBlacklistIp = () => {
    if (newBlacklistIp && !shieldConfig.blacklist.includes(newBlacklistIp)) {
      setShieldConfig({
        ...shieldConfig,
        blacklist: [...shieldConfig.blacklist, newBlacklistIp],
      });
      setNewBlacklistIp('');
    }
  };

  const removeBlacklistIp = (ip: string) => {
    setShieldConfig({
      ...shieldConfig,
      blacklist: shieldConfig.blacklist.filter(i => i !== ip),
    });
  };

  // Geo-blocking helpers
  const geoBlock = shieldConfig.geo_block || { enabled: false, blocked_countries: [] };

  const setGeoBlock = (update: Partial<GeoBlockConfig>) => {
    setShieldConfig({
      ...shieldConfig,
      geo_block: { ...geoBlock, ...update },
    });
  };

  const addBlockedCountry = () => {
    const code = newCountryCode.toUpperCase().trim();
    if (code.length === 2 && !geoBlock.blocked_countries.includes(code)) {
      setGeoBlock({ blocked_countries: [...geoBlock.blocked_countries, code] });
      setNewCountryCode('');
    }
  };

  const removeBlockedCountry = (code: string) => {
    setGeoBlock({
      blocked_countries: geoBlock.blocked_countries.filter(c => c !== code),
    });
  };

  // Headers helpers
  const addRequestHeader = () => {
    if (newReqHeader.name && newReqHeader.value) {
      setHeadersConfig({
        ...headersConfig,
        request_headers: [...headersConfig.request_headers, { ...newReqHeader }],
      });
      setNewReqHeader({ name: '', value: '' });
    }
  };

  const removeRequestHeader = (index: number) => {
    setHeadersConfig({
      ...headersConfig,
      request_headers: headersConfig.request_headers.filter((_, i) => i !== index),
    });
  };

  const addResponseHeader = () => {
    if (newResHeader.name && newResHeader.value) {
      setHeadersConfig({
        ...headersConfig,
        response_headers: [...headersConfig.response_headers, { ...newResHeader }],
      });
      setNewResHeader({ name: '', value: '' });
    }
  };

  const removeResponseHeader = (index: number) => {
    setHeadersConfig({
      ...headersConfig,
      response_headers: headersConfig.response_headers.filter((_, i) => i !== index),
    });
  };

  const addRemoveRequestHeader = () => {
    if (newRemoveReqHeader && !headersConfig.remove_request_headers.includes(newRemoveReqHeader)) {
      setHeadersConfig({
        ...headersConfig,
        remove_request_headers: [...headersConfig.remove_request_headers, newRemoveReqHeader],
      });
      setNewRemoveReqHeader('');
    }
  };

  const addRemoveResponseHeader = () => {
    if (newRemoveResHeader && !headersConfig.remove_response_headers.includes(newRemoveResHeader)) {
      setHeadersConfig({
        ...headersConfig,
        remove_response_headers: [...headersConfig.remove_response_headers, newRemoveResHeader],
      });
      setNewRemoveResHeader('');
    }
  };

  // DNS record helpers
  const validateDnsRecord = (record: DnsRecord): string | null => {
    if (!SUBDOMAIN_REGEX.test(record.name) && record.name !== '@') {
      return 'Nom de sous-domaine invalide (utilisez @ pour le domaine principal, * pour wildcard)';
    }

    if (record.type === 'A' && !IPV4_REGEX.test(record.value)) {
      return 'Adresse IPv4 invalide';
    }

    if (record.type === 'AAAA' && !IPV6_REGEX.test(record.value)) {
      return 'Adresse IPv6 invalide';
    }

    if (record.type === 'CNAME' && !DOMAIN_REGEX.test(record.value) && record.value !== '@') {
      return 'Domaine cible CNAME invalide';
    }

    if (record.type === 'MX') {
      if (!DOMAIN_REGEX.test(record.value)) {
        return 'Serveur mail MX invalide';
      }
      if (record.priority === undefined || record.priority < 0 || record.priority > 65535) {
        return 'Priorite MX invalide (0-65535)';
      }
    }

    if (!record.value.trim()) {
      return 'La valeur ne peut pas etre vide';
    }

    if (record.ttl < 60 || record.ttl > 86400) {
      return 'TTL doit etre entre 60 et 86400 secondes';
    }

    return null;
  };

  const addDnsRecord = () => {
    const error = validateDnsRecord(newDnsRecord);
    if (error) {
      setDnsValidationError(error);
      return;
    }

    setDnsRecords([...dnsRecords, { ...newDnsRecord }]);
    setNewDnsRecord({ ...defaultDnsRecord });
    setDnsValidationError(null);
  };

  const removeDnsRecord = (index: number) => {
    setDnsRecords(dnsRecords.filter((_, i) => i !== index));
  };

  const updateDnsRecord = (index: number, field: keyof DnsRecord, value: string | number) => {
    const updated = [...dnsRecords];
    updated[index] = { ...updated[index], [field]: value };
    setDnsRecords(updated);
  };

  // Compute covered domains for wildcard certificate
  const computeCoveredDomains = (hostValue: string): string[] => {
    if (!hostValue) return [];

    const baseDomain = hostValue.startsWith('*.') ? hostValue.substring(2) : hostValue;
    const domains = [baseDomain];

    // Add common subdomains that would be covered
    if (hostValue.startsWith('*.')) {
      domains.push(`www.${baseDomain}`);
      domains.push(`api.${baseDomain}`);
      domains.push(`app.${baseDomain}`);
      domains.push(`mail.${baseDomain}`);
      domains.push(`admin.${baseDomain}`);
    }

    return domains;
  };

  // Check if host is a wildcard domain
  const isWildcardHost = host.startsWith('*.');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isEdit ? 'Modifier la Route' : 'Nouvelle Route'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general" className="gap-2">
                <Globe className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="ssl" className="gap-2">
                <Lock className="h-4 w-4" />
                SSL
              </TabsTrigger>
              <TabsTrigger value="dns" className="gap-2">
                <Server className="h-4 w-4" />
                DNS
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Shield
              </TabsTrigger>
              <TabsTrigger value="headers" className="gap-2">
                <FileCode className="h-4 w-4" />
                Headers
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la route</Label>
                  <Input
                    id="name"
                    placeholder="mon-application"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mode">Mode</Label>
                  <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proxy">Proxy (Reverse Proxy)</SelectItem>
                      <SelectItem value="redirect">Redirection</SelectItem>
                      <SelectItem value="static">Fichiers statiques</SelectItem>
                      <SelectItem value="loadbalancer">Load Balancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="host">Domaine / Sous-domaine</Label>
                <Input
                  id="host"
                  placeholder="app.mondomaine.com ou *.mondomaine.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Utilisez * pour un wildcard (ex: *.example.com pour tous les sous-domaines)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target">
                  {mode === 'redirect' ? 'URL de redirection' : 'Cible (Backend)'}
                </Label>
                <Input
                  id="target"
                  placeholder={mode === 'redirect'
                    ? 'https://nouveau-site.com'
                    : mode === 'loadbalancer'
                    ? 'http://backend1:3000,http://backend2:3000'
                    : 'http://container:3000'
                  }
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {mode === 'loadbalancer'
                    ? 'Séparez les backends par des virgules pour le load balancing'
                    : mode === 'redirect'
                    ? "L'URL vers laquelle rediriger le trafic"
                    : 'Nom du conteneur Docker ou adresse IP:port du service backend'
                  }
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Route Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Activer/desactiver cette route
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Authentification</Label>
                    <p className="text-xs text-muted-foreground">
                      Connexion requise
                    </p>
                  </div>
                  <Switch
                    checked={authRequired}
                    onCheckedChange={setAuthRequired}
                  />
                </div>
              </div>

              {isWildcardHost && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                  <Info className="h-5 w-5 text-blue-500" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-600">Domaine Wildcard detecte</p>
                    <p className="text-muted-foreground">
                      Cette route capturera tous les sous-domaines de {host.substring(2)}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* SSL Tab */}
            <TabsContent value="ssl" className="space-y-4 mt-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-green-500" />
                  <div>
                    <Label>HTTPS / SSL</Label>
                    <p className="text-xs text-muted-foreground">
                      Activer la connexion securisee
                    </p>
                  </div>
                </div>
                <Switch
                  checked={tlsEnabled}
                  onCheckedChange={setTlsEnabled}
                />
              </div>

              {tlsEnabled && (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-500" />
                      <div>
                        <Label>Certificat Wildcard</Label>
                        <p className="text-xs text-muted-foreground">
                          Couvre tous les sous-domaines (*.example.com)
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={tlsConfig.wildcard}
                      onCheckedChange={(checked) => setTlsConfig({ ...tlsConfig, wildcard: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Forcer HTTPS</Label>
                      <p className="text-xs text-muted-foreground">
                        Rediriger automatiquement HTTP vers HTTPS
                      </p>
                    </div>
                    <Switch
                      checked={tlsConfig.force_https}
                      onCheckedChange={(checked) => setTlsConfig({ ...tlsConfig, force_https: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Version TLS minimale</Label>
                    <Select
                      value={tlsConfig.min_version || 'TLS1.2'}
                      onValueChange={(v: 'TLS1.2' | 'TLS1.3') => setTlsConfig({ ...tlsConfig, min_version: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TLS1.2">TLS 1.2 (Recommande)</SelectItem>
                        <SelectItem value="TLS1.3">TLS 1.3 (Plus securise)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tlsConfig.wildcard && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        <Label>Domaines couverts par le certificat wildcard</Label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {computeCoveredDomains(host).map((domain) => (
                          <Badge key={domain} variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            {domain}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Un certificat wildcard couvrira automatiquement tous les sous-domaines de premier niveau.
                      </p>
                    </div>
                  )}
                </>
              )}

              {!tlsEnabled && (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <Unlock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    SSL/TLS desactive. Les connexions seront en HTTP non securise.
                  </p>
                  <p className="text-xs mt-2">
                    Il est fortement recommande d&apos;activer SSL pour la securite.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* DNS Tab */}
            <TabsContent value="dns" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Enregistrements DNS</Label>
                  <Badge variant="outline">{dnsRecords.length} record(s)</Badge>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={newDnsRecord.type}
                        onValueChange={(v: DnsRecord['type']) => setNewDnsRecord({ ...newDnsRecord, type: v, priority: v === 'MX' ? 10 : undefined })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="AAAA">AAAA</SelectItem>
                          <SelectItem value="CNAME">CNAME</SelectItem>
                          <SelectItem value="TXT">TXT</SelectItem>
                          <SelectItem value="MX">MX</SelectItem>
                          <SelectItem value="NS">NS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Nom</Label>
                      <Input
                        placeholder="@ ou www"
                        value={newDnsRecord.name}
                        onChange={(e) => setNewDnsRecord({ ...newDnsRecord, name: e.target.value })}
                      />
                    </div>
                    <div className={`${newDnsRecord.type === 'MX' ? 'col-span-4' : 'col-span-5'}`}>
                      <Label className="text-xs">Valeur</Label>
                      <Input
                        placeholder={
                          newDnsRecord.type === 'A' ? '192.168.1.1' :
                          newDnsRecord.type === 'AAAA' ? '2001:db8::1' :
                          newDnsRecord.type === 'CNAME' ? 'target.example.com' :
                          newDnsRecord.type === 'TXT' ? 'v=spf1 include:...' :
                          newDnsRecord.type === 'MX' ? 'mail.example.com' :
                          'ns1.example.com'
                        }
                        value={newDnsRecord.value}
                        onChange={(e) => setNewDnsRecord({ ...newDnsRecord, value: e.target.value })}
                      />
                    </div>
                    {newDnsRecord.type === 'MX' && (
                      <div className="col-span-1">
                        <Label className="text-xs">Priorite</Label>
                        <Input
                          type="number"
                          min="0"
                          max="65535"
                          value={newDnsRecord.priority || 10}
                          onChange={(e) => setNewDnsRecord({ ...newDnsRecord, priority: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <Label className="text-xs">TTL (sec)</Label>
                      <Input
                        type="number"
                        min="60"
                        max="86400"
                        value={newDnsRecord.ttl}
                        onChange={(e) => setNewDnsRecord({ ...newDnsRecord, ttl: parseInt(e.target.value) || 3600 })}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <Button type="button" variant="outline" size="icon" onClick={addDnsRecord}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {dnsValidationError && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {dnsValidationError}
                    </div>
                  )}
                </div>

                {/* DNS Records List */}
                {dnsRecords.length > 0 ? (
                  <div className="space-y-2">
                    {dnsRecords.map((record, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {record.type}
                          </Badge>
                          <div>
                            <p className="font-medium font-mono text-sm">
                              {record.name === '@' ? host : `${record.name}.${host.replace('*.', '')}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {record.value}
                              {record.priority !== undefined && ` (Priority: ${record.priority})`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            TTL: {record.ttl}s
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDnsRecord(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      Aucun enregistrement DNS configure
                    </p>
                    <p className="text-xs mt-2">
                      Ajoutez des enregistrements A, CNAME, TXT, etc. pour gerer votre domaine
                    </p>
                  </div>
                )}

                {isWildcardHost && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-600">Wildcard DNS</p>
                      <p className="text-muted-foreground">
                        Pour un domaine wildcard, vous pouvez ajouter un enregistrement A avec le nom &quot;*&quot;
                        pour rediriger tous les sous-domaines vers une adresse IP.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Security Tab (Shield) */}
            <TabsContent value="security" className="space-y-4 mt-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-orange-500" />
                  <div>
                    <Label>SmartShield Protection</Label>
                    <p className="text-xs text-muted-foreground">
                      Rate limiting et protection DDoS
                    </p>
                  </div>
                </div>
                <Switch
                  checked={shieldConfig.enabled}
                  onCheckedChange={(checked) => setShieldConfig({ ...shieldConfig, enabled: checked })}
                />
              </div>

              {shieldConfig.enabled && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Requêtes/seconde</Label>
                      <Input
                        type="number"
                        value={shieldConfig.requests_per_second}
                        onChange={(e) => setShieldConfig({
                          ...shieldConfig,
                          requests_per_second: parseInt(e.target.value) || 100,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Burst max</Label>
                      <Input
                        type="number"
                        value={shieldConfig.burst_size}
                        onChange={(e) => setShieldConfig({
                          ...shieldConfig,
                          burst_size: parseInt(e.target.value) || 200,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Durée blocage (sec)</Label>
                      <Input
                        type="number"
                        value={shieldConfig.block_duration_seconds}
                        onChange={(e) => setShieldConfig({
                          ...shieldConfig,
                          block_duration_seconds: parseInt(e.target.value) || 300,
                        })}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Whitelist IP (toujours autorisé)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="192.168.1.0/24 ou IP unique"
                        value={newWhitelistIp}
                        onChange={(e) => setNewWhitelistIp(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addWhitelistIp())}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={addWhitelistIp}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shieldConfig.whitelist.map((ip) => (
                        <Badge key={ip} variant="secondary" className="gap-1">
                          {ip}
                          <button type="button" onClick={() => removeWhitelistIp(ip)}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Blacklist IP (toujours bloqué)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="IP à bloquer"
                        value={newBlacklistIp}
                        onChange={(e) => setNewBlacklistIp(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBlacklistIp())}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={addBlacklistIp}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shieldConfig.blacklist.map((ip) => (
                        <Badge key={ip} variant="destructive" className="gap-1">
                          {ip}
                          <button type="button" onClick={() => removeBlacklistIp(ip)}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Geo-blocking */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        Geo-blocking
                      </Label>
                      <Switch
                        checked={geoBlock.enabled}
                        onCheckedChange={(checked) => setGeoBlock({ enabled: checked })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bloquer le trafic provenant de pays specifiques (codes ISO 3166-1 alpha-2)
                    </p>

                    {geoBlock.enabled && (
                      <>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Code pays (ex: CN, RU, KR)"
                            value={newCountryCode}
                            onChange={(e) => setNewCountryCode(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBlockedCountry())}
                            maxLength={2}
                            className="uppercase"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={addBlockedCountry}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {geoBlock.blocked_countries.map((code) => (
                            <Badge key={code} variant="outline" className="gap-1 border-blue-500/50">
                              {code}
                              <button type="button" onClick={() => removeBlockedCountry(code)}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        {geoBlock.blocked_countries.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            Codes courants : CN (Chine), RU (Russie), KR (Coree du Sud), BR (Bresil), IN (Inde)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Headers Tab */}
            <TabsContent value="headers" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>Headers de requête à ajouter</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom (ex: X-Custom-Header)"
                    value={newReqHeader.name}
                    onChange={(e) => setNewReqHeader({ ...newReqHeader, name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Valeur"
                    value={newReqHeader.value}
                    onChange={(e) => setNewReqHeader({ ...newReqHeader, value: e.target.value })}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addRequestHeader}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {headersConfig.request_headers.map((h, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <code>{h.name}: {h.value}</code>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRequestHeader(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Headers de réponse à ajouter</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom (ex: X-Frame-Options)"
                    value={newResHeader.name}
                    onChange={(e) => setNewResHeader({ ...newResHeader, name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Valeur (ex: DENY)"
                    value={newResHeader.value}
                    onChange={(e) => setNewResHeader({ ...newResHeader, value: e.target.value })}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addResponseHeader}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {headersConfig.response_headers.map((h, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <code>{h.name}: {h.value}</code>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeResponseHeader(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Headers de requête à supprimer</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nom du header"
                      value={newRemoveReqHeader}
                      onChange={(e) => setNewRemoveReqHeader(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRemoveRequestHeader())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addRemoveRequestHeader}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {headersConfig.remove_request_headers.map((h) => (
                      <Badge key={h} variant="outline" className="gap-1">
                        {h}
                        <button type="button" onClick={() => setHeadersConfig({
                          ...headersConfig,
                          remove_request_headers: headersConfig.remove_request_headers.filter(x => x !== h),
                        })}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Headers de réponse à supprimer</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nom du header"
                      value={newRemoveResHeader}
                      onChange={(e) => setNewRemoveResHeader(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRemoveResponseHeader())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addRemoveResponseHeader}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {headersConfig.remove_response_headers.map((h) => (
                      <Badge key={h} variant="outline" className="gap-1">
                        {h}
                        <button type="button" onClick={() => setHeadersConfig({
                          ...headersConfig,
                          remove_response_headers: headersConfig.remove_response_headers.filter(x => x !== h),
                        })}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !name || !host || !target}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Mettre à jour' : 'Créer la route'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
