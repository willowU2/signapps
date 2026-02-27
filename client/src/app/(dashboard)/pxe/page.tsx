'use client';

import { useEffect, useState } from 'react';
import { Terminal, RefreshCw, Plus, Cpu, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PxeProfile {
    id: string;
    name: string;
    description: string | null;
    boot_script: string;
    os_type: string | null;
    os_version: string | null;
    is_default: boolean | null;
    created_at: string;
}

export default function PxePage() {
    const [profiles, setProfiles] = useState<PxeProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('http://localhost:3016/api/v1/pxe/profiles');
            if (!res.ok) throw new Error('Failed to fetch PXE deployment profiles');
            const data = await res.json();
            setProfiles(data);
        } catch (err: any) {
            setError(err.message || 'Connection error to PXE Server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    return (
        <div className="flex h-full flex-col p-6 space-y-6 bg-background/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Terminal className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">PXE Deployment</h1>
                        <p className="text-muted-foreground">Manage network booting profiles and OS installation images.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Profile
                    </Button>
                </div>
            </div>

            <div className="flex-1 rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-muted-foreground animate-pulse">Contacting iPXE Server Engine (Port 3016)...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-destructive border-red-500/20 bg-red-500/5">
                        <Terminal className="h-12 w-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold">PXE Connect Timeout</h3>
                        <p className="max-w-md text-center text-sm opacity-80 mt-2">{error}</p>
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <Terminal className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Boot Profiles Present</h3>
                        <p className="text-muted-foreground max-w-sm mt-1">
                            Currently, there are no boot script sequences available. Create a new Linux, Windows, or utility profile.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-auto hidden-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 content-start">
                        {profiles.map((profile) => (
                            <div
                                key={profile.id}
                                className={`relative flex flex-col justify-between border rounded-xl p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden ${profile.is_default ? 'bg-primary/5 border-primary/20' : 'bg-background hover:border-primary/50'
                                    }`}
                            >
                                {/* Background Decorator */}
                                <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Cpu className="h-24 w-24" />
                                </div>

                                <div className="relative z-10 flex flex-col space-y-3">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg leading-tight tracking-tight pr-4">
                                            {profile.name}
                                        </h3>
                                        {profile.is_default && (
                                            <span className="absolute top-0 right-0 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
                                                Default
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {profile.description || "No description provided for this boot sequence."}
                                    </p>

                                    <div className="flex gap-2 pt-2">
                                        <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-[10px] uppercase font-semibold">
                                            {profile.os_type || 'Custom'}
                                        </span>
                                        {profile.os_version && (
                                            <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-[10px] font-medium">
                                                {profile.os_version}
                                            </span>
                                        )}
                                    </div>

                                    {/* Code Snippet Box */}
                                    <div className="mt-4 p-3 bg-zinc-950 rounded-md border border-zinc-800">
                                        <pre className="text-[10px] font-mono text-zinc-400 overflow-hidden line-clamp-2">
                                            {profile.boot_script}
                                        </pre>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t flex justify-between items-center relative z-10">
                                    <span className="text-xs text-muted-foreground">
                                        ID: {profile.id.split('-')[0]}...
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
