'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    PenTool,
    Highlighter,
    Square,
    Type,
    ArrowRight,
    Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AnnotationTool = 'pen' | 'highlight' | 'rectangle' | 'text' | 'arrow' | null

interface AnnotationToolsProps {
    onToolChange?: (tool: AnnotationTool) => void
    onColorChange?: (color: string) => void
    onUndo?: () => void
    activeTool?: AnnotationTool
    canUndo?: boolean
}

const ANNOTATION_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
]

const tools = [
    { id: 'pen', label: 'Pen', icon: PenTool },
    { id: 'highlight', label: 'Highlight', icon: Highlighter },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'arrow', label: 'Arrow', icon: ArrowRight },
] as const

export function AnnotationTools({
    onToolChange,
    onColorChange,
    onUndo,
    activeTool,
    canUndo = true,
}: AnnotationToolsProps) {
    const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].value)

    const handleToolClick = (toolId: AnnotationTool) => {
        const newTool = activeTool === toolId ? null : toolId
        onToolChange?.(newTool)
    }

    const handleColorSelect = (color: string) => {
        setSelectedColor(color)
        onColorChange?.(color)
    }

    return (
        <TooltipProvider>
            <div className="flex items-center gap-1 rounded-lg border border-input bg-background p-2 shadow-sm">
                {/* Tool Buttons */}
                <div className="flex gap-1">
                    {tools.map((tool) => {
                        const Icon = tool.icon
                        const isActive = activeTool === tool.id

                        return (
                            <Tooltip key={tool.id}>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant={isActive ? 'default' : 'ghost'}
                                        className={cn(
                                            'h-8 w-8 p-0 transition-all',
                                            isActive && 'bg-primary text-primary-foreground'
                                        )}
                                        onClick={() => handleToolClick(tool.id as AnnotationTool)}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{tool.label}</TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>

                {/* Separator */}
                <div className="h-6 w-px bg-border mx-1" />

                {/* Color Picker */}
                <Popover>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                >
                                    <div
                                        className="w-5 h-5 rounded-full border border-input"
                                        style={{ backgroundColor: selectedColor }}
                                    />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Choose color</TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground">Annotation Color</p>
                            <div className="flex gap-2">
                                {ANNOTATION_COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        className={cn(
                                            'w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
                                            selectedColor === color.value
                                                ? 'border-foreground ring-2 ring-foreground/30'
                                                : 'border-transparent'
                                        )}
                                        style={{ backgroundColor: color.value }}
                                        onClick={() => handleColorSelect(color.value)}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Separator */}
                <div className="h-6 w-px bg-border mx-1" />

                {/* Undo Button */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={onUndo}
                            disabled={!canUndo}
                        >
                            <Undo2 className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>

                {/* Active Tool Indicator */}
                {activeTool && (
                    <div className="ml-2 text-xs font-medium text-muted-foreground">
                        {tools.find((t) => t.id === activeTool)?.label}
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
