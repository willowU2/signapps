"use client"

// IDEA-037: Inline attachment preview — image thumbnails, PDF first page in email body

import { useState } from "react"
import { FileText, Image, Download, X, Eye, File, Film } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export interface Attachment {
    id: string
    name: string
    size?: number
    mimeType?: string
    mime_type?: string
    url: string
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return Image
    if (mimeType === "application/pdf") return FileText
    if (mimeType.startsWith("video/")) return Film
    return File
}

interface AttachmentThumbnailProps {
    attachment: Attachment
    onDownload?: (att: Attachment) => void
}

function AttachmentThumbnail({ attachment, onDownload }: AttachmentThumbnailProps) {
    const [previewOpen, setPreviewOpen] = useState(false)
    const effectiveMimeType = attachment.mimeType ?? attachment.mime_type ?? ""
    const isImage = effectiveMimeType.startsWith("image/")
    const isPdf = effectiveMimeType === "application/pdf"
    const Icon = getIcon(effectiveMimeType)

    return (
        <>
            <div className="group relative flex flex-col items-center w-28 rounded-xl border border-border/60 bg-muted/30 overflow-hidden hover:border-border transition-all cursor-pointer shadow-sm">
                {/* Preview area */}
                <div
                    className="w-full h-20 flex items-center justify-center bg-muted/50 overflow-hidden"
                    onClick={() => setPreviewOpen(true)}
                >
                    {isImage ? (
                        <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                            }}
                        />
                    ) : isPdf ? (
                        <div className="flex flex-col items-center gap-1 text-red-500">
                            <FileText className="h-8 w-8" />
                            <span className="text-[10px] font-bold uppercase">PDF</span>
                        </div>
                    ) : (
                        <Icon className="h-8 w-8 text-muted-foreground" />
                    )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                        <button
                            className="p-1.5 rounded-full bg-background/90 hover:bg-background shadow text-foreground"
                            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true) }}
                            title="Preview"
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </button>
                        {onDownload && (
                            <button
                                className="p-1.5 rounded-full bg-background/90 hover:bg-background shadow text-foreground"
                                onClick={(e) => { e.stopPropagation(); onDownload(attachment) }}
                                title="Download"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* File info */}
                <div className="w-full px-2 py-1.5">
                    <p className="text-[11px] font-medium truncate text-foreground">{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground">{attachment.size != null ? formatBytes(attachment.size) : ''}</p>
                </div>
            </div>

            {/* Preview dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {attachment.name}
                            <span className="text-sm font-normal text-muted-foreground">{attachment.size != null ? `(${formatBytes(attachment.size)})` : ''}</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto min-h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
                        {isImage ? (
                            <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="max-w-full max-h-[60vh] object-contain rounded"
                            />
                        ) : isPdf ? (
                            <iframe
                                src={attachment.url}
                                className="w-full h-[60vh] rounded"
                                title={attachment.name}
                            />
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <Icon className="h-16 w-16 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Preview not available for this file type</p>
                                {onDownload && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => onDownload(attachment)}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download file
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

interface AttachmentPreviewBarProps {
    attachments: Attachment[]
    onDownload?: (att: Attachment) => void
    onDownloadAll?: () => void
}

export function AttachmentPreviewBar({ attachments, onDownload, onDownloadAll }: AttachmentPreviewBarProps) {
    if (!attachments.length) return null

    return (
        <div className="px-8 py-3 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {attachments.length} Attachment{attachments.length !== 1 ? "s" : ""}
                </span>
                {onDownloadAll && attachments.length > 1 && (
                    <button
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                        onClick={onDownloadAll}
                    >
                        <Download className="h-3 w-3" />
                        Download all
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                    <AttachmentThumbnail key={att.id} attachment={att} onDownload={onDownload} />
                ))}
            </div>
        </div>
    )
}
