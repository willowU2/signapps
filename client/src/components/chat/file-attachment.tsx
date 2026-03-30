"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, File, Image, FileText, Film, Music, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatApi, ChatAttachment as Attachment } from "@/lib/api/chat";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FileAttachButtonProps {
    channelId: string;
    onAttach: (attachment: Attachment) => void;
    disabled?: boolean;
}

/**
 * IDEA-134: File sharing in chat.
 * Attach button + drag-drop support + upload progress.
 * Parent component is responsible for drag-over state forwarding.
 */
export function FileAttachButton({ channelId, onAttach, disabled }: FileAttachButtonProps) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = async (file: File) => {
        setUploading(true);
        setProgress(0);
        try {
            const res = await chatApi.uploadFile(channelId, file, (pct) => setProgress(pct));
            onAttach(res.data);
        } catch {
            toast.error("Erreur lors de l'envoi du fichier");
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
        // Reset so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 text-muted-foreground hover:text-foreground relative", uploading && "text-primary")}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || uploading}
                    >
                        {uploading ? (
                            <div className="relative h-4 w-4">
                                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 20 20">
                                    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                                    <circle
                                        cx="10" cy="10" r="8"
                                        fill="none" stroke="currentColor" strokeWidth="2"
                                        strokeDasharray={`${(progress / 100) * 50.27} 50.27`}
                                    />
                                </svg>
                            </div>
                        ) : (
                            <Paperclip className="h-4 w-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach file</TooltipContent>
            </Tooltip>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFile}
                disabled={disabled || uploading}
            />
        </TooltipProvider>
    );
}

// ---------------------------------------------------------------------------
// Drag & Drop overlay
// ---------------------------------------------------------------------------

interface DropZoneProps {
    channelId: string;
    onAttach: (attachment: Attachment) => void;
    children: React.ReactNode;
}

export function ChatDropZone({ channelId, onAttach, children }: DropZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await chatApi.uploadFile(channelId, file);
            onAttach(res.data);
        } catch {
            // ignore
        } finally {
            setUploading(false);
        }
    }, [channelId, onAttach]);

    return (
        <div
            className="relative flex flex-col h-full"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            {children}
            {isDragOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl pointer-events-none animate-in fade-in">
                    <Upload className="h-12 w-12 text-primary mb-3" />
                    <p className="text-lg font-semibold text-primary">Drop to upload</p>
                    <p className="text-sm text-muted-foreground">File will be shared in this channel</p>
                </div>
            )}
            {uploading && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20 z-50">
                    <div className="h-full bg-primary animate-pulse rounded-full" />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Attachment preview in message
// ---------------------------------------------------------------------------

interface AttachmentPreviewProps {
    attachment: Attachment;
}

function getFileIcon(contentType: string) {
    if (contentType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (contentType.startsWith("video/")) return <Film className="h-4 w-4" />;
    if (contentType.startsWith("audio/")) return <Music className="h-4 w-4" />;
    if (contentType.includes("pdf") || contentType.includes("text")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
    const isImage = attachment.content_type.startsWith("image/");

    if (isImage) {
        return (
            <div className="mt-2 rounded-lg overflow-hidden border bg-muted/20 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className="max-w-full max-h-64 object-contain"
                    loading="lazy"
                />
                <div className="px-2 py-1 text-[10px] text-muted-foreground truncate border-t">
                    {attachment.filename} · {formatBytes(attachment.size)}
                </div>
            </div>
        );
    }

    return (
        <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors px-3 py-2 max-w-xs group"
        >
            <div className="text-primary shrink-0">{getFileIcon(attachment.content_type)}</div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate group-hover:underline">{attachment.filename}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</p>
            </div>
        </a>
    );
}

// ---------------------------------------------------------------------------
// Pending attachment chip (before send)
// ---------------------------------------------------------------------------

interface PendingAttachmentProps {
    attachment: Attachment;
    onRemove: () => void;
}

export function PendingAttachment({ attachment, onRemove }: PendingAttachmentProps) {
    return (
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 pl-2 pr-1 py-0.5 max-w-[180px]">
            <div className="text-primary shrink-0">{getFileIcon(attachment.content_type)}</div>
            <span className="text-xs truncate">{attachment.filename}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 rounded-full hover:bg-muted shrink-0"
                onClick={onRemove}
            >
                <X className="h-2.5 w-2.5" />
            </Button>
        </div>
    );
}
