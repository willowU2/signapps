'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderTree } from './folder-tree';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileItem {
    key: string;
    name: string;
    type: 'folder' | 'file';
}

interface MoveToDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: FileItem | null;
    currentBucket: string;
    onMove: (destPath: string) => Promise<void>;
}

export function MoveToDialog({
    open,
    onOpenChange,
    item,
    currentBucket,
    onMove,
}: MoveToDialogProps) {
    const [selectedPath, setSelectedPath] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Reset selected path when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedPath('');
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!selectedPath && selectedPath !== '') return; // Allow root? Yes.

        setLoading(true);
        try {
            await onMove(selectedPath);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Move {item?.name} to...</DialogTitle>
                </DialogHeader>
                <div className="h-[300px] border rounded-md">
                    <ScrollArea className="h-full p-4">
                        <FolderTree
                            bucket={currentBucket}
                            currentPath={selectedPath} // Highlight selected?
                            onSelectFolder={(path) => {
                                // path is like "folder1/folder2/"
                                setSelectedPath(path);
                            }}
                        />
                    </ScrollArea>
                </div>
                <div className="text-sm text-muted-foreground">
                    Selected: {selectedPath || 'Root'}
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Moving...' : 'Move Here'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
