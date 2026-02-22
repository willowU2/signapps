'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { storageApi } from '@/lib/api';
import { Clock, Loader2, RotateCcw, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export interface FileVersion {
    id: string;
    file_id: string;
    version_number: number;
    size: number;
    content_type: string;
    storage_key: string;
    created_at: string;
}

interface VersionHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileId: string;
    fileName: string;
    onVersionRestored?: () => void;
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function VersionHistoryDialog({ open, onOpenChange, fileId, fileName, onVersionRestored }: VersionHistoryDialogProps) {
    const [versions, setVersions] = useState<FileVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    useEffect(() => {
        if (open && fileId) {
            loadVersions();
        }
    }, [open, fileId]);

    const loadVersions = async () => {
        try {
            setLoading(true);
            const response = await storageApi.getFileVersions(fileId);
            setVersions(response.data);
        } catch (error) {
            toast.error('Failed to load version history');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: FileVersion) => {
        if (!confirm(`Are you sure you want to restore Version ${version.version_number}? Current file contents will become a new version.`)) return;

        try {
            setRestoringId(version.id);
            await storageApi.restoreFileVersion(fileId, version.id);
            toast.success(`Successfully restored Version ${version.version_number}`);
            onVersionRestored?.();
            onOpenChange(false);
        } catch (error: any) {
            // Note: Current backend returns 501 Not Implemented
            if (error?.response?.status === 501) {
                toast.error('Version restoration is not fully implemented on the server yet.', { duration: 5000 });
            } else {
                toast.error('Failed to restore version');
            }
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        Version History
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                        History for <span className="font-medium text-foreground">{fileName}</span>
                    </div>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No previous versions found.</p>
                            <p className="text-sm mt-1">When this file is overwritten, its older contents will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {versions.map((version, index) => (
                                <div key={version.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">Version {version.version_number}</span>
                                            {index === 0 && <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-semibold">Latest saved</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <div className="text-xs text-muted-foreground">
                                            {formatBytes(version.size)} • {version.content_type}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                disabled={restoringId !== null}
                                                onClick={() => handleRestore(version)}
                                            >
                                                {restoringId === version.id ? (
                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                )}
                                                Restore
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
