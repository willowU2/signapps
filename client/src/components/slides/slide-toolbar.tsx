import { cn } from "@/lib/utils"
import {
    MousePointer2, Hand, ZoomIn, ZoomOut,
    Undo2, Redo2, Download, Trash2,
    Grid, Magnet, Type, Square, Wand2, Mic, Paintbrush, Settings2,
    Sparkles, LayoutTemplate, MonitorPlay, LayoutGrid, Pencil, Crosshair
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Toolbar, ToolbarButton, ToolbarDivider, ToolbarGroup } from '@/components/editor/toolbar'
import { LayoutSelector } from "./slide-layout-picker"
import { ThemePicker, type SlideTheme } from "./slide-themes"
import { TransitionPicker } from "./transition-picker"
import type { SlideLayout } from "./use-slides"
import type { SlideTransition } from "./slide-animations"

// RT2: Collaborator presence type
export interface CollabUser {
    name: string
    color: string
    clientId: number
}

interface SlideToolbarProps {
    isConnecté: boolean
    collaborators?: CollabUser[]
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
    // Transition support
    currentTransition?: SlideTransition
    onTransitionChange?: (transition: SlideTransition) => void
    // Animation panel
    onToggleAnimations?: () => void
    showAnimations?: boolean
    // Master slide editor
    onToggleMasterEditor?: () => void
    showMasterEditor?: boolean
    // Live presentation
    onStartLivePresentation?: () => void
    // Auto layout
    onAutoLayout?: () => void
    // Smart guides
    smartGuidesEnabled?: boolean
    onToggleSmartGuides?: () => void
    // Drawing mode
    isDrawingMode?: boolean
    onToggleDrawingMode?: () => void
}

export function SlideToolbar({
    isConnecté,
    collaborators = [],
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
    onAddSlide,
    currentTransition,
    onTransitionChange,
    onToggleAnimations,
    showAnimations,
    onToggleMasterEditor,
    showMasterEditor,
    onStartLivePresentation,
    onAutoLayout,
    smartGuidesEnabled,
    onToggleSmartGuides,
    isDrawingMode,
    onToggleDrawingMode
}: SlideToolbarProps) {
    return (
        <Toolbar className="overflow-x-auto custom-scrollbar flex-nowrap min-h-[44px]">


            <ToolbarGroup>
                <div
                    className={cn("h-2 w-2 rounded-full", isConnecté ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")}
                    title={isConnecté ? "Connecté" : "Déconnecté"}
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
                {onToggleSmartGuides !== undefined && (
                    <ToolbarButton onClick={onToggleSmartGuides} isActive={smartGuidesEnabled} title="Guides intelligents">
                        <Crosshair className="w-4 h-4" />
                    </ToolbarButton>
                )}
                {onToggleDrawingMode !== undefined && (
                    <ToolbarButton onClick={onToggleDrawingMode} isActive={isDrawingMode} title="Dessin libre">
                        <Pencil className="w-4 h-4" />
                    </ToolbarButton>
                )}
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


            {/* Transition Picker */}
            {currentTransition && onTransitionChange && (
                <>
                    <ToolbarDivider className="hidden sm:block" />
                    <ToolbarGroup className="hidden sm:flex">
                        <TransitionPicker
                            currentTransition={currentTransition}
                            onTransitionChange={onTransitionChange}
                        />
                    </ToolbarGroup>
                </>
            )}

            <ToolbarDivider className="hidden sm:block" />

            {/* Animation & Master & AI Layout */}
            <ToolbarGroup className="hidden sm:flex">
                {onToggleAnimations && (
                    <ToolbarButton onClick={onToggleAnimations} isActive={showAnimations} title="Animations">
                        <Sparkles className="w-4 h-4" />
                    </ToolbarButton>
                )}
                {onToggleMasterEditor && (
                    <ToolbarButton onClick={onToggleMasterEditor} isActive={showMasterEditor} title="Modeles de diapositives">
                        <LayoutTemplate className="w-4 h-4" />
                    </ToolbarButton>
                )}
                {onAutoLayout && (
                    <ToolbarButton onClick={onAutoLayout} title="Disposition automatique">
                        <LayoutGrid className="w-4 h-4" />
                    </ToolbarButton>
                )}
            </ToolbarGroup>

            {/* Actions Toolbar */}
            <ToolbarGroup className="ml-auto gap-1">
                {/* RT2: Collaborator presence avatars */}
                {collaborators.length > 0 && (
                    <div className="flex items-center -space-x-2 mr-1" title="Utilisateurs connectés">
                        {collaborators.slice(0, 5).map((u) => (
                            <div
                                key={u.clientId}
                                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-background shrink-0"
                                style={{ backgroundColor: u.color }}
                                title={u.name}
                            >
                                {u.name.slice(0, 2).toUpperCase()}
                            </div>
                        ))}
                        {collaborators.length > 5 && (
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold bg-muted ring-2 ring-background shrink-0">
                                +{collaborators.length - 5}
                            </div>
                        )}
                    </div>
                )}
                {onStartLivePresentation && (
                    <ToolbarButton onClick={onStartLivePresentation} title="Presentation en direct">
                        <MonitorPlay className="w-4 h-4" />
                    </ToolbarButton>
                )}
            </ToolbarGroup>
        </Toolbar>
    )
}
