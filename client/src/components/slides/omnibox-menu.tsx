import { useEffect, useRef, useState } from "react"
import { Type, Square, Circle, Triangle, Wand2, Minus, LayoutTemplate, Tag, User, Image as ImageIcon, PenTool, Mail, Calendar, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export interface OmniboxItem {
    id: string
    title: string
    description?: string
    icon: React.ReactNode
    category: "Basic" | "Shapes" | "Smart Blocks" | "Smart Chips" | "Workflows"
    action: () => void
}

interface OmniboxMenuProps {
    x: number
    y: number
    isOpen: boolean
    onClose: () => void
    onInsertText: (text: string, style?: any) => void
    onInsertShape: (type: 'rect' | 'circle' | 'triangle' | 'line') => void
    onInsertImage: (url: string) => void
    onInsertMagicLayout: () => void
    onInsertSmartChip: (type: 'user' | 'status' | 'date' | 'file', label: string, color?: string) => void
    onInsertWorkflow: (type: 'signature' | 'email' | 'meeting') => void
    onInsertTable: (rows?: number, cols?: number) => void
}

export function OmniboxMenu({ x, y, isOpen, onClose, onInsertText, onInsertShape, onInsertImage, onInsertMagicLayout, onInsertSmartChip, onInsertWorkflow, onInsertTable }: OmniboxMenuProps) {
    const [query, setQuery] = useState("")
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const [showImageDialog, setShowImageDialog] = useState(false)
    const [imageUrl, setImageUrl] = useState("")

    const items: OmniboxItem[] = [
        // Basic
        { id: "text", title: "Text Box", description: "Insert a plain text block", icon: <Type className="w-4 h-4 text-muted-foreground" />, category: "Basic", action: () => onInsertText("New Text") },
        { id: "heading", title: "Heading 1", description: "Large title", icon: <Type className="w-4 h-4 text-muted-foreground" />, category: "Basic", action: () => onInsertText("Heading", { fontSize: 48, fontWeight: "bold" }) },
        { id: "table", title: "Table", description: "Insert a 3x3 editable grid", icon: <Table2 className="w-4 h-4 text-muted-foreground" />, category: "Basic", action: () => onInsertTable(3, 3) },
        {
            id: "image", title: "Image Wrapper", description: "Import web image via URL", icon: <ImageIcon className="w-4 h-4 text-muted-foreground" />, category: "Basic", action: () => {
                setImageUrl("https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=800&q=80");
                setShowImageDialog(true);
            }
        },

        // Shapes
        { id: "square", title: "Rectangle", description: "Basic rectangular shape", icon: <Square className="w-4 h-4" />, category: "Shapes", action: () => onInsertShape('rect') },
        { id: "circle", title: "Circle", description: "Basic circular shape", icon: <Circle className="w-4 h-4" />, category: "Shapes", action: () => onInsertShape('circle') },
        { id: "triangle", title: "Triangle", description: "Basic triangular shape", icon: <Triangle className="w-4 h-4" />, category: "Shapes", action: () => onInsertShape('triangle') },
        { id: "line", title: "Line", description: "Straight separator line", icon: <Minus className="w-4 h-4" />, category: "Shapes", action: () => onInsertShape('line') },

        // Smart Blocks
        { id: "magic", title: "Magic Layout", description: "AI generated dashboard layout", icon: <Wand2 className="w-4 h-4 text-indigo-500" />, category: "Smart Blocks", action: onInsertMagicLayout },
        { id: "template", title: "Strategy Template", description: "Pre-built strategy slide", icon: <LayoutTemplate className="w-4 h-4 text-indigo-500" />, category: "Smart Blocks", action: () => onInsertText("Strategy Review", { fontSize: 48, fontWeight: "bold" }) },

        // Smart Chips
        { id: "status-done", title: "Status: Done", description: "Green success badge", icon: <Tag className="w-4 h-4 text-emerald-500" />, category: "Smart Chips", action: () => onInsertSmartChip('status', 'Done', '#10b981') },
        { id: "status-todo", title: "Status: To Do", description: "Gray pending badge", icon: <Tag className="w-4 h-4 text-muted-foreground" />, category: "Smart Chips", action: () => onInsertSmartChip('status', 'To Do', '#6b7280') },
        { id: "status-urgent", title: "Status: Urgent", description: "Red alert badge", icon: <Tag className="w-4 h-4 text-rose-500" />, category: "Smart Chips", action: () => onInsertSmartChip('status', 'Urgent', '#f43f5e') },
        { id: "user-tag", title: "User Mention", description: "Tag a collaborator", icon: <User className="w-4 h-4 text-blue-500" />, category: "Smart Chips", action: () => onInsertSmartChip('user', '@Etienne') },
        { id: "date-tag", title: "Date", description: "Insert today's date", icon: <Calendar className="w-4 h-4 text-yellow-500" />, category: "Smart Chips", action: () => onInsertSmartChip('date', new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })) },
        { id: "file-tag", title: "File Reference", description: "Link another document", icon: <ImageIcon className="w-4 h-4 text-purple-500" />, category: "Smart Chips", action: () => onInsertSmartChip('file', 'Annual Report.pdf') },

        // Workflows (SaaS Building Blocks)
        { id: "workflow-signature", title: "eSignature Block", description: "Collect a formal signature & date", icon: <PenTool className="w-4 h-4 text-purple-500" />, category: "Workflows", action: () => onInsertWorkflow('signature') },
        { id: "workflow-email", title: "Email Draft", description: "Collaborate on an email template", icon: <Mail className="w-4 h-4 text-blue-500" />, category: "Workflows", action: () => onInsertWorkflow('email') },
        { id: "workflow-meeting", title: "Meeting Notes", description: "Structured agenda and action items", icon: <Calendar className="w-4 h-4 text-emerald-600" />, category: "Workflows", action: () => onInsertWorkflow('meeting') },
    ]

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
    )

    useEffect(() => {
        if (isOpen) {
            setQuery("")
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 10)
        }
    }, [isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === "Escape") {
                e.preventDefault()
                onClose()
            } else if (e.key === "ArrowDown") {
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1))
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
            } else if (e.key === "Enter") {
                e.preventDefault()
                const selectedItem = filteredItems[selectedIndex]
                if (selectedItem) {
                    selectedItem.action()
                    onClose()
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, filteredItems, selectedIndex, onClose])

    // Group items for rendering
    const groupedItems = filteredItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
    }, {} as Record<string, OmniboxItem[]>)

    // Ensure menu stays within screen bounds (roughly)
    const safeX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 320) : x
    const safeY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 400) : y

    return (
        <>
        {!isOpen ? null : <div
            ref={menuRef}
            className="fixed z-50 w-80 bg-background/95 backdrop-blur-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
            style={{ left: safeX, top: safeY, maxHeight: 400 }}
        >
            <div className="p-3 border-b border-gray-100 bg-muted/50">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type to filter..."
                    className="w-full bg-background border border-border text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 block p-2 outline-none shadow-sm"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setSelectedIndex(0)
                    }}
                />
            </div>

            <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                {Object.entries(groupedItems).map(([category, catItems], catIndex) => {
                    // Calculate absolute index to match selectedIndex state
                    const priorItemsCount = Object.keys(groupedItems)
                        .slice(0, catIndex)
                        .reduce((sum, key) => sum + groupedItems[key].length, 0)

                    return (
                        <div key={category} className="mb-4 last:mb-0">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                {category}
                            </div>
                            <div className="space-y-0.5">
                                {catItems.map((item, index) => {
                                    const absoluteIndex = priorItemsCount + index
                                    const isSelected = absoluteIndex === selectedIndex

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                item.action()
                                                onClose()
                                            }}
                                            onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-muted text-muted-foreground'}`}
                                        >
                                            <div className={`flex items-center justify-center p-2 rounded-md ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground'}`}>
                                                {item.icon}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-foreground'}`}>
                                                    {item.title}
                                                </span>
                                                {item.description && (
                                                    <span className={`text-xs ${isSelected ? 'text-indigo-500' : 'text-muted-foreground'}`}>
                                                        {item.description}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}

                {filteredItems.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        Aucun résultat trouvé for "{query}"
                    </div>
                )}
            </div>

            <div className="px-4 py-2 bg-muted border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-sans shadow-sm">↑↓</kbd> to navigate
                </div>
                <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-sans shadow-sm">Enter</kbd> to select
                </div>
            </div>
        </div>}

        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
            <DialogContent>
                <DialogHeader><DialogTitle>Enter image URL</DialogTitle></DialogHeader>
                <Input
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    autoFocus
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            if (imageUrl) { onInsertImage(imageUrl); onClose(); }
                            setShowImageDialog(false);
                        }
                    }}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowImageDialog(false)}>Annuler</Button>
                    <Button onClick={() => { if (imageUrl) { onInsertImage(imageUrl); onClose(); } setShowImageDialog(false); }}>Insert</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
