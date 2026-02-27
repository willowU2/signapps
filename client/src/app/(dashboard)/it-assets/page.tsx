'use client';

import { useEffect, useState } from 'react';
import { Server, RefreshCw, Plus, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HardwareAsset {
    id: string;
    name: string;
    type: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    status: string | null;
    location: string | null;
    created_at: string;
}

export default function ITAssetsPage() {
    const [assets, setAssets] = useState<HardwareAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('http://localhost:3015/api/v1/it-assets/hardware');
            if (!res.ok) throw new Error('Failed to fetch hardware assets');
            const data = await res.json();
            setAssets(data);
        } catch (err: any) {
            setError(err.message || 'Connection error to Asset Database');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    return (
        <div className="flex h-full flex-col p-6 space-y-6 bg-background/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Server className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">IT Assets</h1>
                        <p className="text-muted-foreground">Manage your hardware inventory and infrastructure components.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchAssets} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Asset
                    </Button>
                </div>
            </div>

            <div className="flex-1 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-muted-foreground animate-pulse">Syncing with SignApps PostgreSQL Engine...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-destructive border-red-500/20 bg-red-500/5">
                        <HardDrive className="h-12 w-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold">Database Connection Failure</h3>
                        <p className="max-w-md text-center text-sm opacity-80 mt-2">{error}</p>
                    </div>
                ) : assets.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <Server className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Inventory is Empty</h3>
                        <p className="text-muted-foreground max-w-sm mt-1">
                            Your hardware database is currently empty. Click 'Add Asset' or use the REST API to populate the system.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-auto hidden-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Hostname / ID</th>
                                    <th className="px-6 py-4 font-medium">Type</th>
                                    <th className="px-6 py-4 font-medium">Manufacturer</th>
                                    <th className="px-6 py-4 font-medium">Serial Number</th>
                                    <th className="px-6 py-4 font-medium">Location</th>
                                    <th className="px-6 py-4 font-medium text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {assets.map((asset) => (
                                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors group cursor-pointer">
                                        <td className="px-6 py-4 font-medium flex items-center gap-3">
                                            <div className="p-1.5 bg-background rounded-md border shadow-sm group-hover:border-primary/30 transition-colors">
                                                <HardDrive className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            {asset.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-semibold uppercase tracking-wider">
                                                {asset.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{asset.manufacturer || asset.model || 'Unknown'}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{asset.serial_number || 'N/A'}</td>
                                        <td className="px-6 py-4">{asset.location || 'Unassigned'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="relative flex h-2 w-2">
                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${asset.status === 'Active' ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${asset.status === 'Active' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                                </span>
                                                <span className="font-medium text-xs uppercase tracking-wider">{asset.status || 'Provisioning'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
