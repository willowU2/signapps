'use client';

import { useEffect, useState } from 'react';
import { MonitorSmartphone, RefreshCw, Plus, Globe, Key, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RemoteConnection {
    id: string;
    hardware_id: string | null;
    name: string;
    protocol: string;
    hostname: string;
    port: number;
    username: string | null;
    created_at: string;
}

export default function RemoteDesktopPage() {
    const [connections, setConnections] = useState<RemoteConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConnections = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('http://localhost:3017/api/v1/remote/connections');
            if (!res.ok) throw new Error('Failed to fetch remote desktop linkages');
            const data = await res.json();
            setConnections(data);
        } catch (err: any) {
            setError(err.message || 'Connection error to Guacamole Gateway');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    // Map protocol string to icon and color
    const getProtocolConfig = (protocol: string) => {
        switch (protocol.toLowerCase()) {
            case 'rdp':
                return { icon: MonitorSmartphone, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
            case 'ssh':
                return { icon: TerminalSquare, color: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700' };
            case 'vnc':
                return { icon: Globe, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' };
            default:
                return { icon: MonitorSmartphone, color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' };
        }
    };

    return (
        <div className="flex h-full flex-col p-6 space-y-6 bg-background/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MonitorSmartphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Remote Access</h1>
                        <p className="text-muted-foreground">Secure RDP, VNC, and SSH portals via WebRTC Gateway.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchConnections} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Connection
                    </Button>
                </div>
            </div>

            <div className="flex-1 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-muted-foreground animate-pulse">Establishing tunnel to Remote Desktop Gateway (Port 3017)...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-destructive border-red-500/20 bg-red-500/5">
                        <MonitorSmartphone className="h-12 w-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold">Gateway Negotiation Failure</h3>
                        <p className="max-w-md text-center text-sm opacity-80 mt-2">{error}</p>
                    </div>
                ) : connections.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <MonitorSmartphone className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Secure Tunnels Provisioned</h3>
                        <p className="text-muted-foreground max-w-sm mt-1">
                            Add a new remote desktop endpoint. Connections are brokered invisibly through our HTML5 WebSocket Canvas.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-auto hidden-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 content-start">
                        {connections.map((conn) => {
                            const { icon: ProtocolIcon, color, bg } = getProtocolConfig(conn.protocol);
                            return (
                                <div
                                    key={conn.id}
                                    className={`flex flex-col border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group group-hover:bg-muted/10 relative overflow-hidden`}
                                >
                                    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform ${color}`}>
                                        <ProtocolIcon className="h-20 w-20" />
                                    </div>

                                    <div className="flex items-center gap-3 mb-4 relative z-10">
                                        <div className={`p-2 rounded-md border ${bg}`}>
                                            <ProtocolIcon className={`h-5 w-5 ${color}`} />
                                        </div>
                                        <span className="font-semibold text-lg line-clamp-1">{conn.name}</span>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Endpoint</span>
                                            <span className="font-mono">{conn.hostname}:{conn.port}</span>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Username</span>
                                            <div className="flex items-center gap-1.5">
                                                <Key className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{conn.username || 'Prompt on Connect'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t flex justify-between items-center relative z-10">
                                        <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${bg} ${color}`}>
                                            {conn.protocol}
                                        </span>
                                        <Button size="sm" variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors h-8">
                                            Connect
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
