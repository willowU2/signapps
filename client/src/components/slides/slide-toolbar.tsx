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
import { LayoutSelector } from "./slide-layout-picker"
import { ThemePicker, type SlideTheme } from "./slide-themes"
import type { SlideLayout } from "./use-slides"

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
    // Layout support
    currentLayout?: SlideLayout
    onLayoutChange?: (layout: SlideLayout) => void
    // Theme support
    currentThemeId?: string
    onThemeChange?: (theme: SlideTheme) => void
    // Add Slide support
    onAddSlide?: (layout?: SlideLayout) => void
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
    isFormatPainting,
    onToggleFormatPainter,
    showGrid,
    snapToGrid,
    onToggleGrid,
    onToggleSnap,
    pageConfig,
    onPageConfigChange,
    currentLayout,
    onLayoutChange,
    currentThemeId,
    onThemeChange,
    onAddSlide
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

            {/* Layout Selector */}
            {currentLayout && onLayoutChange && (
                <>
                    <ToolbarDivider className="hidden sm:block" />
                    <ToolbarGroup className="hidden sm:flex">
                        <LayoutSelector
                            currentLayout={currentLayout}
                            onLayoutChange={onLayoutChange}
                        />
                    </ToolbarGroup>
                </>
            )}

            {/* Theme Picker */}
            {currentThemeId && onThemeChange && (
                <>
                    <ToolbarDivider className="hidden sm:block" />
                    <ToolbarGroup className="hidden sm:flex">
                        <ThemePicker
                            currentThemeId={currentThemeId}
                            onThemeChange={onThemeChange}
                        />
                    </ToolbarGroup>
                </>
            )}

            <ToolbarDivider className="hidden sm:block" />

            <ToolbarGroup className="hidden sm:flex">
                <ToolbarButton onClick={onAddText} title="Texte">
                    <Type className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton onClick={onAddShape} title="Forme">
                    <Square className="w-4 h-4" />
                </ToolbarButton>
            </ToolbarGroup>


            {/* Actions Toolbar */}
            <ToolbarGroup className="ml-auto">

            </ToolbarGroup>
        </Toolbar>
    )
}
