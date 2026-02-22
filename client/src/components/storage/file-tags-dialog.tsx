'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { storageApi } from '@/lib/api';
import { Tag, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface FileTagsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileId: string;
    fileName: string;
    onTagsUpdated?: () => void;
}

export function FileTagsDialog({ open, onOpenChange, fileId, fileName, onTagsUpdated }: FileTagsDialogProps) {
    const [allTags, setAllTags] = useState<TagData[]>([]);
    const [fileTagIds, setFileTagIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        if (open && fileId) {
            loadData();
        }
    }, [open, fileId]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Fetch all available tags
            const tagsRes = await storageApi.getTags();
            setAllTags(tagsRes.data);

            // Fetch tags associated with this specific file
            const fileTagsRes = await storageApi.getFileTags(fileId);
            const associatedIds = fileTagsRes.data.map((t: TagData) => t.id);
            setFileTagIds(new Set(associatedIds));
        } catch {
            toast.error('Failed to load tags');
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = async (tagId: string) => {
        const isAssociated = fileTagIds.has(tagId);
        setSavingId(tagId);

        try {
            if (isAssociated) {
                await storageApi.removeFileTag(fileId, tagId);
                const next = new Set(fileTagIds);
                next.delete(tagId);
                setFileTagIds(next);
            } else {
                await storageApi.addFileTag(fileId, tagId);
                const next = new Set(fileTagIds);
                next.add(tagId);
                setFileTagIds(next);
            }
            onTagsUpdated?.();
        } catch (error) {
            toast.error('Failed to update file tags');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        File Tags
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                        Manage tags for <span className="font-medium text-foreground">{fileName}</span>
                    </div>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : allTags.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground">
                            No tags available. Go to "Manage Tags" to create some first.
                        </div>
                    ) : (
                        <div className="flex gap-2 flex-wrap">
                            {allTags.map(tag => {
                                const isSelected = fileTagIds.has(tag.id);
                                return (
                                    <Button
                                        key={tag.id}
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 gap-1 rounded-full border-2 ${isSelected
                                            ? `${tag.color} text-white border-transparent`
                                            : 'border-muted hover:border-muted-foreground/50'
                                            }`}
                                        onClick={() => toggleTag(tag.id)}
                                        disabled={savingId === tag.id}
                                    >
                                        {savingId === tag.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : isSelected && (
                                            <Check className="h-3 w-3" />
                                        )}
                                        {tag.name}
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
