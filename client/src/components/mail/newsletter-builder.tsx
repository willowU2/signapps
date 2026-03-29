"use client"

// IDEA-039: Newsletter builder — drag-and-drop email template builder with blocks

import { useState, useCallback } from "react"
import { Plus, Trash2, GripVertical, Type, Image, Square, AlignLeft, Minus, Eye, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type BlockType = "header" | "text" | "image" | "button" | "divider" | "footer"

interface Block {
    id: string
    type: BlockType
    content: Record<string, string>
}

const BLOCK_TEMPLATES: Record<BlockType, { icon: React.ReactNode; label: string; defaultContent: Record<string, string> }> = {
    header: { icon: <Type className="h-4 w-4" />, label: "Header", defaultContent: { title: "Newsletter Title", subtitle: "Subtitle or tagline", bg: "#1a73e8" } },
    text: { icon: <AlignLeft className="h-4 w-4" />, label: "Text", defaultContent: { body: "Write your content here. Tell your story, share updates, or provide information." } },
    image: { icon: <Image className="h-4 w-4" />, label: "Image", defaultContent: { src: "", alt: "Image description", width: "100%" } },
    button: { icon: <Square className="h-4 w-4" />, label: "Button", defaultContent: { text: "Click here", url: "https://", bg: "#1a73e8", color: "#ffffff" } },
    divider: { icon: <Minus className="h-4 w-4" />, label: "Divider", defaultContent: { color: "#e0e0e0", margin: "16px" } },
    footer: { icon: <AlignLeft className="h-4 w-4" />, label: "Footer", defaultContent: { text: "© 2025 Your Company. All rights reserved.", unsubscribe: "Unsubscribe" } },
}

function generateId() {
    return Math.random().toString(36).slice(2, 9)
}

function renderBlockHtml(block: Block): string {
    const { type, content } = block
    switch (type) {
        case "header":
            return `<table width="100%" style="background:${content.bg};padding:40px 32px;text-align:center;"><tr><td><h1 style="color:#fff;font-size:28px;margin:0 0 8px;">${content.title}</h1><p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px;">${content.subtitle}</p></td></tr></table>`
        case "text":
            return `<table width="100%" style="padding:24px 32px;"><tr><td><p style="font-size:15px;line-height:1.6;color:#333;margin:0;">${content.body}</p></td></tr></table>`
        case "image":
            return content.src ? `<table width="100%" style="padding:16px 32px;"><tr><td style="text-align:center;"><img src="${content.src}" alt="${content.alt}" style="max-width:${content.width};height:auto;" /></td></tr></table>` : ""
        case "button":
            return `<table width="100%" style="padding:16px 32px;"><tr><td style="text-align:center;"><a href="${content.url}" style="display:inline-block;background:${content.bg};color:${content.color};padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${content.text}</a></td></tr></table>`
        case "divider":
            return `<table width="100%" style="padding:${content.margin} 32px;"><tr><td><hr style="border:none;border-top:1px solid ${content.color};" /></td></tr></table>`
        case "footer":
            return `<table width="100%" style="background:#f8f9fa;padding:24px 32px;text-align:center;"><tr><td><p style="font-size:12px;color:#888;margin:0 0 8px;">${content.text}</p><a href="#" style="font-size:12px;color:#888;">${content.unsubscribe}</a></td></tr></table>`
        default:
            return ""
    }
}

function BlockEditor({ block, onChange, onDelete, onMoveUp, onMoveDown }: {
    block: Block
    onChange: (b: Block) => void
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
}) {
    const { type, content } = block
    const updateContent = (key: string, val: string) => onChange({ ...block, content: { ...content, [key]: val } })

    return (
        <div className="border border-border rounded-xl p-3 space-y-2 bg-background group">
            <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {BLOCK_TEMPLATES[type].label}
                    </span>
                </div>
                <div className="flex gap-1">
                    <button onClick={onMoveUp} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs">↑</button>
                    <button onClick={onMoveDown} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs">↓</button>
                    <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 hover:text-red-600 text-muted-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {type === "header" && (
                <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Title</Label><Input className="h-7 text-xs mt-1" value={content.title} onChange={(e) => updateContent("title", e.target.value)} /></div>
                    <div><Label className="text-xs">Subtitle</Label><Input className="h-7 text-xs mt-1" value={content.subtitle} onChange={(e) => updateContent("subtitle", e.target.value)} /></div>
                    <div><Label className="text-xs">Background</Label><Input type="color" className="h-7 mt-1 p-0.5 w-full" value={content.bg} onChange={(e) => updateContent("bg", e.target.value)} /></div>
                </div>
            )}
            {type === "text" && (
                <Textarea rows={4} className="text-sm" value={content.body} onChange={(e) => updateContent("body", e.target.value)} placeholder="Email content..." />
            )}
            {type === "image" && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2"><Label className="text-xs">Image URL</Label><Input className="h-7 text-xs mt-1" value={content.src} onChange={(e) => updateContent("src", e.target.value)} placeholder="https://..." /></div>
                    <div><Label className="text-xs">Alt text</Label><Input className="h-7 text-xs mt-1" value={content.alt} onChange={(e) => updateContent("alt", e.target.value)} /></div>
                    <div><Label className="text-xs">Width</Label><Input className="h-7 text-xs mt-1" value={content.width} onChange={(e) => updateContent("width", e.target.value)} placeholder="100%" /></div>
                </div>
            )}
            {type === "button" && (
                <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Button text</Label><Input className="h-7 text-xs mt-1" value={content.text} onChange={(e) => updateContent("text", e.target.value)} /></div>
                    <div><Label className="text-xs">URL</Label><Input className="h-7 text-xs mt-1" value={content.url} onChange={(e) => updateContent("url", e.target.value)} /></div>
                    <div><Label className="text-xs">Background</Label><Input type="color" className="h-7 mt-1 p-0.5 w-full" value={content.bg} onChange={(e) => updateContent("bg", e.target.value)} /></div>
                    <div><Label className="text-xs">Text color</Label><Input type="color" className="h-7 mt-1 p-0.5 w-full" value={content.color} onChange={(e) => updateContent("color", e.target.value)} /></div>
                </div>
            )}
            {type === "footer" && (
                <div className="space-y-2">
                    <div><Label className="text-xs">Footer text</Label><Input className="h-7 text-xs mt-1" value={content.text} onChange={(e) => updateContent("text", e.target.value)} /></div>
                    <div><Label className="text-xs">Unsubscribe label</Label><Input className="h-7 text-xs mt-1" value={content.unsubscribe} onChange={(e) => updateContent("unsubscribe", e.target.value)} /></div>
                </div>
            )}
            {type === "divider" && (
                <div className="flex gap-2">
                    <div className="flex-1"><Label className="text-xs">Color</Label><Input type="color" className="h-7 mt-1 p-0.5 w-full" value={content.color} onChange={(e) => updateContent("color", e.target.value)} /></div>
                    <div className="flex-1"><Label className="text-xs">Margin</Label><Input className="h-7 text-xs mt-1" value={content.margin} onChange={(e) => updateContent("margin", e.target.value)} placeholder="16px" /></div>
                </div>
            )}
        </div>
    )
}

interface NewsletterBuilderProps {
    onExport?: (html: string) => void
}

export function NewsletterBuilder({ onExport }: NewsletterBuilderProps) {
    const [blocks, setBlocks] = useState<Block[]>([
        { id: generateId(), type: "header", content: { ...BLOCK_TEMPLATES.header.defaultContent } },
        { id: generateId(), type: "text", content: { ...BLOCK_TEMPLATES.text.defaultContent } },
        { id: generateId(), type: "button", content: { ...BLOCK_TEMPLATES.button.defaultContent } },
        { id: generateId(), type: "footer", content: { ...BLOCK_TEMPLATES.footer.defaultContent } },
    ])
    const [preview, setPreview] = useState(false)

    const addBlock = (type: BlockType) => {
        setBlocks((prev) => [...prev, { id: generateId(), type, content: { ...BLOCK_TEMPLATES[type].defaultContent } }])
    }

    const updateBlock = (id: string, updated: Block) => {
        setBlocks((prev) => prev.map((b) => (b.id === id ? updated : b)))
    }

    const deleteBlock = (id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id))
    }

    const moveBlock = (idx: number, dir: -1 | 1) => {
        const newBlocks = [...blocks]
        const target = idx + dir
        if (target < 0 || target >= newBlocks.length) return
        ;[newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]]
        setBlocks(newBlocks)
    }

    const buildHtml = useCallback(() => {
        const body = blocks.map(renderBlockHtml).join("\n")
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;"><table width="100%" style="background:#f5f5f5;padding:32px 0;"><tr><td align="center"><table width="600" style="background:#ffffff;border-radius:8px;overflow:hidden;">${body}</table></td></tr></table></body></html>`
    }, [blocks])

    const handleExport = () => {
        const html = buildHtml()
        onExport?.(html)
        navigator.clipboard.writeText(html).then(() => toast.success("HTML copied to clipboard"))
    }

    return (
        <div className="flex h-full gap-4">
            {/* Block palette */}
            <div className="w-44 shrink-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Add block</p>
                {(Object.keys(BLOCK_TEMPLATES) as BlockType[]).map((type) => {
                    const t = BLOCK_TEMPLATES[type]
                    return (
                        <button
                            key={type}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                            onClick={() => addBlock(type)}
                        >
                            {t.icon}
                            <span className="font-medium">{t.label}</span>
                            <Plus className="h-3 w-3 ml-auto text-muted-foreground" />
                        </button>
                    )
                })}
            </div>

            {/* Editor area */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-0">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
                        {preview ? <Code2 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {preview ? "Modifier" : "Aperçu"}
                    </Button>
                    <Button size="sm" onClick={handleExport}>
                        <Code2 className="h-4 w-4 mr-1" />
                        Export HTML
                    </Button>
                </div>

                {preview ? (
                    <div
                        className="flex-1 rounded-xl border bg-gray-50 overflow-auto p-4"
                        dangerouslySetInnerHTML={{ __html: buildHtml() }}
                    />
                ) : (
                    <div className="space-y-2">
                        {blocks.map((block, i) => (
                            <BlockEditor
                                key={block.id}
                                block={block}
                                onChange={(updated) => updateBlock(block.id, updated)}
                                onDelete={() => deleteBlock(block.id)}
                                onMoveUp={() => moveBlock(i, -1)}
                                onMoveDown={() => moveBlock(i, 1)}
                            />
                        ))}
                        {blocks.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                <p className="text-sm">Add blocks from the palette to build your newsletter</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
