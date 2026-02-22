import { cn } from "@/lib/utils"
import {
    MousePointer2, Hand, ZoomIn, ZoomOut,
    Undo2, Redo2, Download, Trash2,
    Grid, Magnet, Type, Square, Wand2, Mic, Paintbrush, Settings2
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface SlideToolbarProps {
    isConnected: boolean
    onAddMagicLayout: () => void
    onAddText: () => void
    onAddShape: () => void
    onExport: () => void
    canUndo: boolean
    canRedo: boolean
    onUndo: () => void
    onRedo: () => void
    onClear: () => void
    isListening: boolean;
    onToggleListen: () => void;
    isFormatPainting: boolean;
    onToggleFormatPainter: () => void;
    showGrid: boolean
    snapToGrid: boolean
    onToggleGrid: () => void
    onToggleSnap: () => void
    pageConfig?: { orientation: 'portrait' | 'landscape', backgroundColor: string }
    onPageConfigChange?: (config: { orientation: 'portrait' | 'landscape', backgroundColor: string }) => void
}

export function SlideToolbar({
    isConnected,
    onAddMagicLayout,
    onAddText,
    onAddShape,
    onExport,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onClear,
    isListening,
    onToggleListen,
    isFormatPainting,
    onToggleFormatPainter,
    showGrid,
    snapToGrid,
    onToggleGrid,
    onToggleSnap,
    pageConfig,
    onPageConfigChange
}: SlideToolbarProps) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-premium border border-white/20 sticky top-2 z-10 animate-fade-in-up justify-between">
            <div className="flex items-center gap-3">
                <div
                    className={cn("h-2.5 w-2.5 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")}
                    title={isConnected ? "Connected" : "Disconnected"}
                />

                <div className="w-px h-6 bg-gray-200 mx-1" />

                {/* History */}
                <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-lg border border-gray-200/50">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="p-1.5 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Undo"
                    >
                        <Undo2 className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="p-1.5 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Redo"
                    >
                        <Redo2 className="w-4 h-4 text-gray-700" />
                    </button>
                </div>

                <div className="w-px h-6 bg-gray-200 mx-1" />

                {/* Addition Tools */}
                <button
                    onClick={onAddMagicLayout}
                    className="flex items-center gap-2 group px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium shadow-md transition-all sm:hover:scale-105"
                >
                    <Wand2 className="w-4 h-4 text-white/90 group-hover:rotate-12 transition-transform" />
                    Magic Layout
                </button>

                <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />

                {/* Precision Tools */}
                <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-lg border border-gray-200/50">
                    <button
                        onClick={onToggleGrid}
                        className={cn("p-1.5 rounded-md transition-colors", showGrid ? "bg-indigo-100/80 text-indigo-700" : "hover:bg-gray-200 text-gray-500")}
                        title="Toggle Grid View"
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleSnap}
                        className={cn("p-1.5 rounded-md transition-colors", snapToGrid ? "bg-indigo-100/80 text-indigo-700" : "hover:bg-gray-200 text-gray-500")}
                        title="Snap to Grid"
                    >
                        <Magnet className="w-4 h-4" />
                    </button>
                </div>

                <button
                    onClick={onToggleFormatPainter}
                    className={cn(
                        "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                        isFormatPainting
                            ? "bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm"
                            : "bg-gray-50/50 hover:bg-gray-100/80 text-gray-700 border-gray-200/50"
                    )}
                    title={isFormatPainting ? "Format Painter Active (Click to cancel)" : "Format Painter"}
                >
                    <Paintbrush className="w-4 h-4" /> Formats
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />

                <button
                    onClick={onAddText}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200/50"
                >
                    <Type className="w-4 h-4" /> Text
                </button>
                <button
                    onClick={onAddShape}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200/50"
                >
                    <Square className="w-4 h-4" /> Shape
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
                <button
                    onClick={onToggleListen}
                    className={cn(
                        "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                        isListening
                            ? "bg-red-50 text-red-600 border-red-200 animate-pulse shadow-sm"
                            : "bg-gray-50/50 hover:bg-gray-100/80 text-gray-700 border-gray-200/50"
                    )}
                    title={isListening ? "Listening... (Click to stop)" : "Voice Typing (Dictation)"}
                >
                    <Mic className="w-4 h-4" />
                </button>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-2">
                {pageConfig && onPageConfigChange && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-200/50"
                                title="Page Setup"
                            >
                                <Settings2 className="w-4 h-4" /> Setup
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-4 shadow-premium rounded-xl" align="end">
                            <h4 className="font-semibold text-sm mb-4">Page Setup</h4>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500">Orientation</Label>
                                    <Select
                                        value={pageConfig.orientation}
                                        onValueChange={(v: 'portrait' | 'landscape') => onPageConfigChange({ ...pageConfig, orientation: v })}
                                    >
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="landscape">Landscape</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-500">Background Color</Label>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="color"
                                            className="w-8 h-8 p-0 cursor-pointer rounded-md border"
                                            value={pageConfig.backgroundColor}
                                            onChange={(e) => onPageConfigChange({ ...pageConfig, backgroundColor: e.target.value })}
                                        />
                                        <Input
                                            type="text"
                                            className="h-8 text-sm flex-1"
                                            value={pageConfig.backgroundColor}
                                            onChange={(e) => onPageConfigChange({ ...pageConfig, backgroundColor: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                <div className="w-px h-6 bg-gray-200 mx-1" />

                <button
                    onClick={onClear}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-sm font-medium text-gray-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> Clear
                </button>

                <button
                    onClick={onExport}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-gray-800 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
                >
                    <Download className="w-4 h-4" /> Export HD
                </button>
            </div>
        </div>
    )
}
