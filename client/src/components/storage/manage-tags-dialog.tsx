'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { storageApi } from '@/lib/api';
import { Tag, Loader2, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface TagData {
    id: string;
    name: string;
    color: string;
}

interface ManageTagsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTagsUpdated?: () => void;
}

const PREDEFINED_COLORS = [
    'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500',
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
    'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
];

export function ManageTagsDialog({ open, onOpenChange, onTagsUpdated }: ManageTagsDialogProps) {
    const [tags, setTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(false);

    // Create mode
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PREDEFINED_COLORS[0]);

    // Edit mode
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    useEffect(() => {
        if (open) {
            loadTags();
            setIsCreating(false);
            setEditingId(null);
        }
    }, [open]);

    const loadTags = async () => {
        try {
            setLoading(true);
            // In a real implementation this would fetch from /api/v1/tags
            const response = await storageApi.getTags();
            setTags(response.data);
        } catch (error) {
            toast.error('Failed to load tags');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async () => {
        if (!newName.trim()) return;

        try {
            await storageApi.createTag({
                name: newName,
                color: newColor,
            });
            toast.success('Tag created successfully');
            setNewName('');
            setIsCreating(false);
            loadTags();
            onTagsUpdated?.();
        } catch (error) {
            toast.error('Failed to create tag');
        }
    };

    const handleUpdateTag = async () => {
        if (!editingId || !editName.trim()) return;

        try {
            await storageApi.updateTag(editingId, {
                name: editName,
                color: editColor,
            });
            toast.success('Tag updated successfully');
            setEditingId(null);
            loadTags();
            onTagsUpdated?.();
        } catch (error) {
            toast.error('Failed to update tag');
        }
    };

    const handleDeleteTag = async (id: string) => {
        try {
            await storageApi.deleteTag(id);
            toast.success('Tag deleted successfully');
            loadTags();
            onTagsUpdated?.();
        } catch (error) {
            toast.error('Failed to delete tag');
        }
    };

    const startEditing = (tag: TagData) => {
        setEditingId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
        setIsCreating(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        Manage Global Tags
                    </DialogTitle>
                    <DialogDescription>
                        Create and manage tags to organize your files. These tags can be applied to any of your files.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {/* Create new tag button/form */}
                    {!isCreating && !editingId && (
                        <Button
                            variant="outline"
                            className="w-full mb-4 border-dashed"
                            onClick={() => setIsCreating(true)}
                        >
                            + Create New Tag
                        </Button>
                    )}

                    {isCreating && (
                        <div className="bg-muted p-3 rounded-md mb-4 space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Tag Name</Label>
                                <Input
                                    className="h-8 text-sm"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Finance, Urgent, Draft..."
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Color</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {PREDEFINED_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`w-6 h-6 rounded-full ${c} ${newColor === c ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                                            onClick={() => setNewColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={handleCreateTag} disabled={!newName.trim()}>
                                    Create
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Tags list */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {loading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : tags.length === 0 && !isCreating ? (
                            <div className="text-center text-sm text-muted-foreground py-6">
                                No tags created yet.
                            </div>
                        ) : (
                            tags.map(tag => (
                                <div key={tag.id} className="border rounded-md p-2 flex items-center justify-between">
                                    {editingId === tag.id ? (
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                className="h-8 text-sm"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                            <div className="flex flex-wrap gap-1.5">
                                                {PREDEFINED_COLORS.map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        className={`w-5 h-5 rounded-full ${c} ${editColor === c ? 'ring-2 ring-offset-1 ring-foreground' : ''}`}
                                                        onClick={() => setEditColor(c)}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex gap-1 justify-end">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdateTag}>
                                                    <Check className="h-4 w-4 text-green-500" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Badge className={`${tag.color} text-white hover:${tag.color} px-2 py-1`}>
                                                {tag.name}
                                            </Badge>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground"
                                                    onClick={() => startEditing(tag)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleDeleteTag(tag.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
