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
import { Toolbar, ToolbarButton, ToolbarDivider, ToolbarGroup } from '@/components/editor/toolbar'

interface SlideToolbarProps {
    isConnected: boolean
    onAddMagicLayout: () => void
    onAddText: () => void
    onAddShape: () => void
    onExport: () => void
    onExportPPTX?: () => void
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
    onExportPPTX,
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
        <Toolbar className="overflow-x-auto custom-scrollbar flex-nowrap min-h-[44px]">
            <ToolbarGroup>
                <div
                    className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")}
                    title={isConnected ? "Connected" : "Disconnected"}
                />
            </ToolbarGroup>

            <ToolbarDivider />

            {/* History */}
            <ToolbarGroup>
                <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Annuler">
                    <Undo2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={onRedo} disabled={!canRedo} title="Rétablir">
                    <Redo2 className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            {/* Precision Tools */}
            <ToolbarGroup>
                <ToolbarButton onClick={onToggleGrid} isActive={showGrid} title="Afficher la grille">
                    <Grid className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={onToggleSnap} isActive={snapToGrid} title="Aligner sur la grille">
                    <Magnet className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup>
                <ToolbarButton onClick={onToggleFormatPainter} isActive={isFormatPainting} title="Reproduire le format">
                    <Paintbrush className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>
            
            <ToolbarDivider className="hidden sm:block" />

            <ToolbarGroup className="hidden sm:flex">
                <ToolbarButton onClick={onAddText} title="Texte">
                    <Type className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={onAddShape} title="Forme">
                    <Square className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>
            
            <ToolbarDivider className="hidden sm:block" />
            
            <ToolbarGroup className="hidden sm:flex">
                <ToolbarButton onClick={onToggleListen} isActive={isListening} title={isListening ? "Écoute..." : "Saisie vocale"}>
                    <Mic className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>

            {/* Actions Toolbar */}
            <ToolbarGroup className="ml-auto">
                {pageConfig && onPageConfigChange && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 text-gray-700 rounded-lg text-[13px] font-medium transition-colors border border-gray-200/50"
                                title="Mise en page"
                            >
                                <Settings2 className="w-4 h-4" />
                                <span className="hidden lg:inline">Mise en page</span>
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
                                        <SelectTrigger className="h-8 text-[13px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="landscape">Paysage</SelectItem>
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
                                            className="h-8 text-[13px] flex-1"
                                            value={pageConfig.backgroundColor}
                                            onChange={(e) => onPageConfigChange({ ...pageConfig, backgroundColor: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                <ToolbarDivider />

                <ToolbarButton onClick={onClear} title="Vider">
                    <Trash2 className="w-4 h-4 text-red-500" />
                </ToolbarButton>

                <div className="flex items-center gap-1">
                    <ToolbarButton onClick={onExport} title="Exporter PNG">
                        <Download className="w-4 h-4" />
                        <span className="text-[12px] font-medium">PNG</span>
                    </ToolbarButton>
                    <button
                        onClick={onExportPPTX}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#db4437] hover:bg-[#c53929] text-white rounded text-[12px] font-medium shadow-sm transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> PPTX
                    </button>
                </div>
            </ToolbarGroup>
        </Toolbar>
    )
}
