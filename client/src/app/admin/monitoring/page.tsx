"use client"

import { useEffect, useState, useCallback } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    getSystemMetrics, type SystemMetrics,
    getSlowQueries, type SlowQueriesResponse,
    getPoolStats, type PoolStats,
} from "@/lib/api-admin"
import { Activity, HardDrive, Cpu, Network, Database, AlertTriangle, RefreshCw } from "lucide-react"
import { usePageTitle } from '@/hooks/use-page-title';
import { cn } from "@/lib/utils"

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'slow-queries' | 'pool';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec === 0) return "0 B/s";
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatDuration(sec: number): string {
    if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
    if (sec < 60) return `${sec.toFixed(1)} s`;
    return `${Math.floor(sec / 60)}m ${(sec % 60).toFixed(0)}s`;
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Vue generale', icon: <Activity className="h-3.5 w-3.5" /> },
        { id: 'slow-queries', label: 'Queries lentes', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
        { id: 'pool', label: 'Pool DB', icon: <Database className="h-3.5 w-3.5" /> },
    ];
    return (
        <div className="flex gap-1 border-b border-border pb-0">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    className={cn(
                        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                        active === t.id
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                >
                    {t.icon}
                    {t.label}
                </button>
            ))}
        </div>
    );
}

// ─── Slow queries tab ─────────────────────────────────────────────────────────

function SlowQueriesTab() {
    const [data, setData] = useState<SlowQueriesResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getSlowQueries();
        setData(result);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 15_000);
        return () => clearInterval(t);
    }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Requetes actives depuis plus de {data?.threshold_seconds ?? 1}s
                    {data?.pg_stat_statements_available && (
                        <Badge variant="outline" className="ml-2 text-[10px]">pg_stat_statements actif</Badge>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
                    Actualiser
                </Button>
            </div>

            {!data || data.queries.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                    Aucune requete lente detectee
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40 text-left">
                                <th className="px-4 py-2 font-medium">PID</th>
                                <th className="px-4 py-2 font-medium">Duree</th>
                                <th className="px-4 py-2 font-medium">Etat</th>
                                <th className="px-4 py-2 font-medium">Utilisateur</th>
                                <th className="px-4 py-2 font-medium">Requete</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.queries.map((q, i) => (
                                <tr key={q.pid ?? i} className="border-b border-border last:border-0">
                                    <td className="px-4 py-2 font-mono text-xs">{q.pid}</td>
                                    <td className={cn(
                                        "px-4 py-2 font-semibold font-mono text-xs",
                                        q.duration_seconds > 10 ? "text-red-500" :
                                        q.duration_seconds > 3 ? "text-amber-500" : "text-foreground"
                                    )}>
                                        {formatDuration(q.duration_seconds)}
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge variant="outline" className="text-[10px]">
                                            {q.state ?? '—'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">
                                        {q.usename ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 max-w-xs">
                                        <code className="text-[11px] text-muted-foreground truncate block max-w-xs" title={q.query ?? ''}>
                                            {q.query ?? '—'}
                                        </code>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Pool stats tab ───────────────────────────────────────────────────────────

function PoolStatsTab() {
    const [stats, setStats] = useState<PoolStats | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getPoolStats();
        setStats(result);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 10_000);
        return () => clearInterval(t);
    }, [load]);

    const usagePercent = stats ? Math.round((stats.active / stats.max) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Statistiques du pool de connexions PostgreSQL du service metrics
                </p>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
                    Actualiser
                </Button>
            </div>

            {!stats ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                    Impossible de charger les stats du pool
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Actives
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-3xl font-bold">{stats.active}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Inactives
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.idle}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Total / Max
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className="text-3xl font-bold">{stats.size} / {stats.max}</p>
                        </CardContent>
                    </Card>
                    <Card className={stats.at_capacity ? 'border-red-500/50' : ''}>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Saturation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <p className={cn(
                                "text-3xl font-bold",
                                stats.at_capacity ? "text-red-500" : "text-foreground"
                            )}>
                                {usagePercent}%
                            </p>
                            {stats.at_capacity && (
                                <p className="text-xs text-red-500 mt-1">Pool sature</p>
                            )}
                        </CardContent>
                    </Card>

                    <div className="sm:col-span-2 lg:col-span-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Utilisation du pool</span>
                            <span>{stats.active} / {stats.max}</span>
                        </div>
                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    usagePercent > 90 ? "bg-red-500" :
                                    usagePercent > 70 ? "bg-amber-500" : "bg-green-500"
                                )}
                                style={{ width: `${Math.min(100, usagePercent)}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Ajustez DB_MAX_CONNECTIONS dans .env si le pool est frequemment sature.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
    usePageTitle('Supervision');
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
    const [prevMetrics, setPrevMetrics] = useState<SystemMetrics | null>(null)
    const [netSpeed, setNetSpeed] = useState({ rx: 0, tx: 0 })

    // Polling for live metrics
    useEffect(() => {
        const fetchMetrics = () => {
            getSystemMetrics().then(newMetrics => {
                setPrevMetrics(prev => {
                    if (prev) {
                        const rxDiff = (newMetrics.network_rx_bytes || 0) - (prev.network_rx_bytes || 0);
                        const txDiff = (newMetrics.network_tx_bytes || 0) - (prev.network_tx_bytes || 0);
                        // Convert bytes/5sec to bytes/sec
                        setNetSpeed({
                            rx: Math.max(0, rxDiff / 5),
                            tx: Math.max(0, txDiff / 5)
                        });
                    }
                    return newMetrics;
                });
                setMetrics(newMetrics);
            }).catch(err => console.debug(err))
        }

        fetchMetrics()
        const interval = setInterval(fetchMetrics, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <AppLayout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>

                <TabNav active={activeTab} onChange={setActiveTab} />

                {activeTab === 'overview' && (
                    <>
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* CPU */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-medium">CPU Usage</CardTitle>
                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-bold">{metrics?.cpu_usage?.toFixed(1)}%</div>
                                    <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-500"
                                            style={{ width: `${Math.min(100, metrics?.cpu_usage || 0)}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Memory */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-medium">Memory Usage</CardTitle>
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-bold">{metrics?.memory_usage?.toFixed(1)}%</div>
                                    <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, metrics?.memory_usage || 0)}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Disk */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-medium">Disk Usage</CardTitle>
                                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-bold">{metrics?.disk_usage?.toFixed(1)}%</div>
                                    <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, metrics?.disk_usage || 0)}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Network Live Feed */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-medium">Network I/O</CardTitle>
                                    <Network className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-2xl font-bold">{formatSpeed(netSpeed.rx)}</div>
                                            <p className="text-xs text-muted-foreground">Inbound</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">{formatSpeed(netSpeed.tx)}</div>
                                            <p className="text-xs text-muted-foreground">Outbound</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Uptime */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">System Uptime</p>
                                        <div className="text-2xl font-bold">
                                            {metrics?.uptime ? `${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m` : 'Chargement...'}
                                        </div>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {activeTab === 'slow-queries' && <SlowQueriesTab />}
                {activeTab === 'pool' && <PoolStatsTab />}
            </div>
        </AppLayout>
    )
}
