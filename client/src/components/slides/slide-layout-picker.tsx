"use client"

import { SlideLayout } from "./use-slides"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Plus, LayoutTemplate } from "lucide-react"
import { useState } from "react"

interface LayoutOption {
    value: SlideLayout
    label: string
    description: string
    preview: React.ReactNode
}

const layoutOptions: LayoutOption[] = [
    {
        value: 'title_slide',
        label: 'Diapositive de titre',
        description: 'Titre et sous-titre centrés',
        preview: (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                <div className="w-3/4 h-2 bg-primary/60 rounded-sm" />
                <div className="w-1/2 h-1 bg-muted-foreground/40 rounded-sm" />
            </div>
        )
    },
    {
        value: 'title_and_content',
        label: 'Titre et contenu',
        description: 'Titre en haut avec zone de contenu',
        preview: (
            <div className="w-full h-full flex flex-col gap-1 p-1">
                <div className="w-3/4 h-1.5 bg-primary/60 rounded-sm" />
                <div className="flex-1 bg-muted-foreground/20 rounded-sm" />
            </div>
        )
    },
    {
        value: 'two_content',
        label: 'Deux colonnes',
        description: 'Titre avec deux colonnes de contenu',
        preview: (
            <div className="w-full h-full flex flex-col gap-1 p-1">
                <div className="w-3/4 h-1.5 bg-primary/60 rounded-sm" />
                <div className="flex-1 flex gap-0.5">
                    <div className="flex-1 bg-muted-foreground/20 rounded-sm" />
                    <div className="flex-1 bg-muted-foreground/20 rounded-sm" />
                </div>
            </div>
        )
    },
    {
        value: 'section_header',
        label: 'En-tête de section',
        description: 'Diviseur de chapitre',
        preview: (
            <div className="w-full h-full flex flex-col items-start justify-end gap-1 p-1 pb-2">
                <div className="w-1/2 h-1 bg-muted-foreground/40 rounded-sm" />
                <div className="w-3/4 h-2 bg-primary/60 rounded-sm" />
            </div>
        )
    },
    {
        value: 'title_only',
        label: 'Titre seul',
        description: 'Uniquement le titre en haut',
        preview: (
            <div className="w-full h-full flex flex-col gap-1 p-1">
                <div className="w-3/4 h-1.5 bg-primary/60 rounded-sm" />
            </div>
        )
    },
    {
        value: 'blank',
        label: 'Vierge',
        description: 'Diapositive vide',
        preview: (
            <div className="w-full h-full" />
        )
    }
]

interface SlideLayoutPickerProps {
    onSelectLayout: (layout: SlideLayout) => void
}

export function SlideLayoutPicker({ onSelectLayout }: SlideLayoutPickerProps) {
    const [open, setOpen] = useState(false)

    const handleSelect = (layout: SlideLayout) => {
        onSelectLayout(layout)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nouvelle diapositive
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
                <div className="grid grid-cols-2 gap-2">
                    {layoutOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "flex flex-col items-start gap-1 p-2 rounded-md",
                                "hover:bg-accent transition-colors text-left",
                                "border border-transparent hover:border-border"
                            )}
                        >
                            <div className="w-full aspect-[16/9] bg-muted rounded border border-border overflow-hidden">
                                {option.preview}
                            </div>
                            <span className="text-xs font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                                {option.description}
                            </span>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface LayoutSelectorProps {
    currentLayout: SlideLayout
    onLayoutChange: (layout: SlideLayout) => void
    disabled?: boolean
}

export function LayoutSelector({ currentLayout, onLayoutChange, disabled }: LayoutSelectorProps) {
    const [open, setOpen] = useState(false)
    const current = layoutOptions.find(o => o.value === currentLayout)

    const handleSelect = (layout: SlideLayout) => {
        onLayoutChange(layout)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={disabled}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    <span className="hidden sm:inline">{current?.label || 'Layout'}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end">
                <div className="grid grid-cols-2 gap-2">
                    {layoutOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "flex flex-col items-start gap-1 p-2 rounded-md",
                                "hover:bg-accent transition-colors text-left",
                                "border",
                                currentLayout === option.value
                                    ? "border-primary bg-accent"
                                    : "border-transparent hover:border-border"
                            )}
                        >
                            <div className="w-full aspect-[16/9] bg-muted rounded border border-border overflow-hidden">
                                {option.preview}
                            </div>
                            <span className="text-xs font-medium">{option.label}</span>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
