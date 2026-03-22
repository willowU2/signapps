'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { DnsConfig, DnsStats, Blocklist, CustomDnsRecord } from '@/lib/api';

function formatNumber(num: number): string {
  return num.toLocaleString();
}

interface VpnDnsTabProps {
  dnsConfig: DnsConfig | null;
  dnsStats: DnsStats | null;
  upstreamInput: string;
  onUpstreamInputChange: (value: string) => void;
  onToggleDns: (enabled: boolean) => void;
  onToggleAdblock: (enabled: boolean) => void;
  onAddUpstream: () => void;
  onRemoveUpstream: (dns: string) => void;
  onOpenBlocklistDialog: () => void;
  onToggleBlocklist: (blocklist: Blocklist) => void;
  onDeleteBlocklist: (blocklist: Blocklist) => void;
  onOpenDnsRecordDialog: (record?: CustomDnsRecord) => void;
  onDeleteDnsRecord: (record: CustomDnsRecord) => void;
}

export function VpnDnsTab({
  dnsConfig,
  dnsStats,
  upstreamInput,
  onUpstreamInputChange,
  onToggleDns,
  onToggleAdblock,
  onAddUpstream,
  onRemoveUpstream,
  onOpenBlocklistDialog,
  onToggleBlocklist,
  onDeleteBlocklist,
  onOpenDnsRecordDialog,
  onDeleteDnsRecord,
}: VpnDnsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* DNS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>DNS Configuration</span>
              <Switch
                checked={dnsConfig?.enabled || false}
                onCheckedChange={onToggleDns}
              />
            </CardTitle>
            <CardDescription>
              Route DNS queries through your tunnels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Upstream DNS Servers</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 1.1.1.1 or 8.8.8.8"
                  value={upstreamInput}
                  onChange={(e) => onUpstreamInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddUpstream()}
                  disabled={!dnsConfig?.enabled}
                />
                <Button
                  variant="outline"
                  onClick={onAddUpstream}
                  disabled={!dnsConfig?.enabled || !upstreamInput.trim()}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(dnsConfig?.upstream || []).map((dns) => (
                  <Badge key={dns} variant="secondary" className="gap-1">
                    {dns}
                    <button
                      onClick={() => onRemoveUpstream(dns)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ad Blocking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Ad &amp; Tracker Blocking</span>
              <Switch
                checked={dnsConfig?.adblock_enabled || false}
                onCheckedChange={onToggleAdblock}
                disabled={!dnsConfig?.enabled}
              />
            </CardTitle>
            <CardDescription>
              Block ads and trackers at DNS level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Blocked Today</p>
                <p className="text-2xl font-bold text-red-500">
                  {formatNumber(dnsStats?.blocked_today || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Block Rate</p>
                <p className="text-2xl font-bold">
                  {(dnsStats?.blocked_percent || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocklists */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Blocklists</CardTitle>
            <CardDescription>
              Lists of domains to block for ad and tracker filtering
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={onOpenBlocklistDialog}
            disabled={!dnsConfig?.enabled || !dnsConfig?.adblock_enabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Blocklist
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dnsConfig?.blocklists || []).map((blocklist) => (
                <TableRow key={blocklist.id}>
                  <TableCell>
                    <div className="font-medium">{blocklist.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {blocklist.url}
                    </div>
                  </TableCell>
                  <TableCell>{formatNumber(blocklist.entries_count)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {blocklist.last_updated
                      ? new Date(blocklist.last_updated).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={blocklist.enabled}
                      onCheckedChange={() => onToggleBlocklist(blocklist)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteBlocklist(blocklist)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(dnsConfig?.blocklists || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No blocklists configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Custom DNS Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custom DNS Records</CardTitle>
            <CardDescription>
              Override DNS resolution for specific domains
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenDnsRecordDialog()}
            disabled={!dnsConfig?.enabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dnsConfig?.custom_records || []).map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Badge variant="outline">{record.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{record.name}</TableCell>
                  <TableCell className="font-mono text-sm">{record.value}</TableCell>
                  <TableCell className="text-muted-foreground">{record.ttl || 3600}s</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenDnsRecordDialog(record)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteDnsRecord(record)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(dnsConfig?.custom_records || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No custom DNS records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
