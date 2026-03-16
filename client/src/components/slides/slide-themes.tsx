"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Palette, Check } from "lucide-react"

// Theme color scheme
export interface SlideTheme {
    id: string
    name: string
    colors: {
        background: string
        primary: string      // For titles
        secondary: string    // For subtitles
        accent: string       // For highlights
        text: string         // For body text
        muted: string        // For secondary text
    }
    fonts: {
        heading: string
        body: string
    }
}

// Pre-built themes
export const SLIDE_THEMES: SlideTheme[] = [
    {
        id: 'default',
        name: 'Classique',
        colors: {
            background: '#ffffff',
            primary: '#1e293b',
            secondary: '#475569',
            accent: '#3b82f6',
            text: '#334155',
            muted: '#94a3b8'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'dark',
        name: 'Sombre',
        colors: {
            background: '#0f172a',
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            accent: '#60a5fa',
            text: '#e2e8f0',
            muted: '#64748b'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'ocean',
        name: 'Océan',
        colors: {
            background: '#0c4a6e',
            primary: '#ffffff',
            secondary: '#bae6fd',
            accent: '#38bdf8',
            text: '#e0f2fe',
            muted: '#7dd3fc'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'forest',
        name: 'Forêt',
        colors: {
            background: '#14532d',
            primary: '#ffffff',
            secondary: '#bbf7d0',
            accent: '#4ade80',
            text: '#dcfce7',
            muted: '#86efac'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'sunset',
        name: 'Coucher de soleil',
        colors: {
            background: '#7c2d12',
            primary: '#ffffff',
            secondary: '#fed7aa',
            accent: '#fb923c',
            text: '#ffedd5',
            muted: '#fdba74'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'lavender',
        name: 'Lavande',
        colors: {
            background: '#4c1d95',
            primary: '#ffffff',
            secondary: '#ddd6fe',
            accent: '#a78bfa',
            text: '#ede9fe',
            muted: '#c4b5fd'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'minimal',
        name: 'Minimaliste',
        colors: {
            background: '#fafafa',
            primary: '#171717',
            secondary: '#525252',
            accent: '#171717',
            text: '#404040',
            muted: '#737373'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'corporate',
        name: 'Entreprise',
        colors: {
            background: '#1e3a5f',
            primary: '#ffffff',
            secondary: '#93c5fd',
            accent: '#fbbf24',
            text: '#dbeafe',
            muted: '#60a5fa'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'rose',
        name: 'Rose',
        colors: {
            background: '#881337',
            primary: '#ffffff',
            secondary: '#fecdd3',
            accent: '#fb7185',
            text: '#ffe4e6',
            muted: '#fda4af'
        },
        fonts: {
            heading: 'Inter, sans-serif',
            body: 'Inter, sans-serif'
        }
    },
    {
        id: 'cream',
        name: 'Crème',
        colors: {
            background: '#fef7ed',
            primary: '#78350f',
            secondary: '#a16207',
            accent: '#d97706',
            text: '#451a03',
            muted: '#92400e'
        },
        fonts: {
            heading: 'Georgia, serif',
            body: 'Georgia, serif'
        }
    }
]

export function getThemeById(id: string): SlideTheme {
    return SLIDE_THEMES.find(t => t.id === id) || SLIDE_THEMES[0]
}

// Theme Picker Component
interface ThemePickerProps {
    currentThemeId: string
    onThemeChange: (theme: SlideTheme) => void
    disabled?: boolean
}

export function ThemePicker({ currentThemeId, onThemeChange, disabled }: ThemePickerProps) {
    const [open, setOpen] = useState(false)
    const currentTheme = getThemeById(currentThemeId)

    const handleSelect = (theme: SlideTheme) => {
        onThemeChange(theme)
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
                    <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ background: `linear-gradient(135deg, ${currentTheme.colors.primary} 50%, ${currentTheme.colors.accent} 50%)` }}
                    />
                    <Palette className="w-4 h-4" />
                    <span className="hidden sm:inline">{currentTheme.name}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold mb-3">Thèmes de présentation</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {SLIDE_THEMES.map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => handleSelect(theme)}
                                className={cn(
                                    "relative flex flex-col items-start gap-1.5 p-2 rounded-lg",
                                    "hover:bg-accent/50 transition-colors text-left",
                                    "border",
                                    currentThemeId === theme.id
                                        ? "border-primary bg-accent/30"
                                        : "border-transparent hover:border-border"
                                )}
                            >
                                {/* Theme Preview */}
                                <div
                                    className="w-full aspect-[16/9] rounded border border-border/50 overflow-hidden relative"
                                    style={{ backgroundColor: theme.colors.background }}
                                >
                                    {/* Title bar */}
                                    <div
                                        className="absolute top-1 left-1 right-1 h-1.5 rounded-sm"
                                        style={{ backgroundColor: theme.colors.primary }}
                                    />
                                    {/* Subtitle bar */}
                                    <div
                                        className="absolute top-3.5 left-1 w-2/3 h-1 rounded-sm"
                                        style={{ backgroundColor: theme.colors.secondary }}
                                    />
                                    {/* Content bars */}
                                    <div
                                        className="absolute bottom-3 left-1 w-3/4 h-0.5 rounded-sm"
                                        style={{ backgroundColor: theme.colors.text, opacity: 0.6 }}
                                    />
                                    <div
                                        className="absolute bottom-1.5 left-1 w-1/2 h-0.5 rounded-sm"
                                        style={{ backgroundColor: theme.colors.text, opacity: 0.6 }}
                                    />
                                    {/* Accent dot */}
                                    <div
                                        className="absolute bottom-2 right-1.5 w-2 h-2 rounded-full"
                                        style={{ backgroundColor: theme.colors.accent }}
                                    />
                                </div>

                                <div className="flex items-center justify-between w-full">
                                    <span className="text-xs font-medium">{theme.name}</span>
                                    {currentThemeId === theme.id && (
                                        <Check className="w-3 h-3 text-primary" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// Inline Theme Preview for sidebar or compact views
interface ThemePreviewProps {
    theme: SlideTheme
    size?: 'sm' | 'md'
}

export function ThemePreview({ theme, size = 'sm' }: ThemePreviewProps) {
    const dimensions = size === 'sm' ? 'w-8 h-5' : 'w-12 h-7'

    return (
        <div
            className={cn(dimensions, "rounded border border-border/50 overflow-hidden relative")}
            style={{ backgroundColor: theme.colors.background }}
        >
            <div
                className="absolute top-0.5 left-0.5 right-0.5 h-0.5 rounded-sm"
                style={{ backgroundColor: theme.colors.primary }}
            />
            <div
                className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full"
                style={{ backgroundColor: theme.colors.accent }}
            />
        </div>
    )
}
