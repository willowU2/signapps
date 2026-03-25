"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight, Check } from "lucide-react"
import {
    type SlideTransition,
    type SlideTransitionType,
    SLIDE_TRANSITIONS,
} from "./slide-animations"

interface TransitionPickerProps {
    currentTransition: SlideTransition
    onTransitionChange: (transition: SlideTransition) => void
    disabled?: boolean
}

const DURATION_OPTIONS = [
    { value: 300, label: 'Rapide (300ms)' },
    { value: 500, label: 'Normal (500ms)' },
    { value: 1000, label: 'Lent (1000ms)' },
]

export function TransitionPicker({
    currentTransition,
    onTransitionChange,
    disabled,
}: TransitionPickerProps) {
    const [open, setOpen] = useState(false)

    const handleTypeChange = (type: SlideTransitionType) => {
        onTransitionChange({ ...currentTransition, type })
    }

    const handleDurationChange = (durationStr: string) => {
        onTransitionChange({ ...currentTransition, duration: parseInt(durationStr, 10) })
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
                    <ArrowLeftRight className="w-4 h-4" />
                    <span className="hidden sm:inline">Transition</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Transitions de diapositives</h4>

                    {/* Transition Type Grid */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Type de transition</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {(Object.keys(SLIDE_TRANSITIONS) as SlideTransitionType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleTypeChange(type)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors",
                                        "border",
                                        currentTransition.type === type
                                            ? "border-primary bg-primary/10 text-primary font-medium"
                                            : "border-border hover:bg-muted text-foreground"
                                    )}
                                >
                                    <span>{SLIDE_TRANSITIONS[type]}</span>
                                    {currentTransition.type === type && (
                                        <Check className="w-3 h-3" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration Select */}
                    {currentTransition.type !== 'none' && (
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Vitesse</Label>
                            <Select
                                value={String(currentTransition.duration)}
                                onValueChange={handleDurationChange}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DURATION_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Preview indicator */}
                    {currentTransition.type !== 'none' && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
                            <div className="w-8 h-5 bg-primary/20 rounded border border-primary/30 relative overflow-hidden">
                                <div
                                    className="absolute inset-0 bg-primary/40 animate-pulse"
                                    style={{ animationDuration: `${currentTransition.duration}ms` }}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {SLIDE_TRANSITIONS[currentTransition.type]} - {currentTransition.duration}ms
                            </span>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
