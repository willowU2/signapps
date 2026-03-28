"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSystemMetrics, type SystemMetrics } from "@/lib/api-admin"
import { Activity, HardDrive, Cpu, Network } from "lucide-react"
import { usePageTitle } from '@/hooks/use-page-title';

export default function MonitoringPage() {
  usePageTitle('Supervision');
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

    const formatSpeed = (bytesPerSec: number) => {
        if (bytesPerSec === 0) return "0 B/s";
        if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
        if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>

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
            </div>
        </AppLayout>
    )
}
