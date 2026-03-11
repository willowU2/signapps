'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sharesApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Link as LinkIcon, Lock, Calendar } from 'lucide-react';
import { FileItem } from './types';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: FileItem | null;
}

export function ShareDialog({ open, onOpenChange, item }: ShareDialogProps) {
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [expiresInParts, setExpiresInParts] = useState('');
    const [shareUrl, setShareUrl] = useState('');

    const handleShare = async () => {
        if (!item || !item.bucket) return;
        setLoading(true);
        try {
            const expires = parseInt(expiresInParts, 10);
            const response = await sharesApi.create({
                bucket: item.bucket,
                key: item.key,
                expires_in_hours: isNaN(expires) ? undefined : expires,
                password: password || undefined,
            });
            setShareUrl(response.data.url);
            toast.success('Share link created successfully');
        } catch (error) {
            console.debug(error);
            toast.error('Failed to create share link');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
        onOpenChange(false);
        // Reset state for next time
        setTimeout(() => {
            setShareUrl('');
            setPassword('');
            setExpiresInParts('');
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Share {item?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {shareUrl ? (
                        <div className="space-y-2">
                            <Label>Share Link</Label>
                            <div className="flex gap-2">
                                <Input readOnly value={shareUrl} />
                                <Button onClick={handleCopy} className="shrink-0">
                                    Copy Link
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Lock className="w-4 h-4" /> Optional Password
                                </Label>
                                <Input
                                    type="password"
                                    placeholder="Leave blank for no password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Expiration (Hours)
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="Leave blank to never expire"
                                    value={expiresInParts}
                                    onChange={(e) => setExpiresInParts(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </>
                    )}
                </div>

                {!shareUrl && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button onClick={handleShare} disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                            Create Link
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
