'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Copy, Pin, Trash2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClipboardItem {
    id: string
    text: string
    timestamp: number
    pinnedAt?: number
    expiresAt?: number
}

interface SharedClipboardProps {
    onItemSelected?: (text: string) => void
    maxItems?: number
    expiryMs?: number
}

export function SharedClipboard({
    onItemSelected,
    maxItems = 10,
    expiryMs = 60 * 60 * 1000, // 1 hour
}: SharedClipboardProps) {
    const [items, setItems] = useState<ClipboardItem[]>([])
    const [inputValue, setInputValue] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const expiryTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

    // Clean up expired items
    useEffect(() => {
        const cleanupTimer = setInterval(() => {
            setItems((prevItems) =>
                prevItems.filter((item) => {
                    if (item.expiresAt && item.expiresAt < Date.now()) {
                        expiryTimersRef.current.delete(item.id)
                        return false
                    }
                    return true
                })
            )
        }, 10000) // Check every 10 seconds

        return () => clearInterval(cleanupTimer)
    }, [])

    const addItem = (text: string) => {
        if (!text.trim()) return

        const newItem: ClipboardItem = {
            id: Date.now().toString(),
            text: text.trim(),
            timestamp: Date.now(),
            expiresAt: Date.now() + expiryMs,
        }

        setItems((prevItems) => {
            const updated = [newItem, ...prevItems].slice(0, maxItems)
            return updated
        })

        // Set expiry timer
        const timer = setTimeout(() => {
            setItems((prevItems) => prevItems.filter((item) => item.id !== newItem.id))
        }, expiryMs)
        expiryTimersRef.current.set(newItem.id, timer)

        setInputValue('')
    }

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText()
            addItem(text)
        } catch (err) {
            console.error('Failed to read clipboard:', err)
        }
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
            onItemSelected?.(text)
        })
    }

    const togglePin = (id: string) => {
        setItems((prevItems) =>
            prevItems.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        pinnedAt: item.pinnedAt ? undefined : Date.now(),
                    }
                    : item
            )
        )
    }

    const deleteItem = (id: string) => {
        const timer = expiryTimersRef.current.get(id)
        if (timer) {
            clearTimeout(timer)
            expiryTimersRef.current.delete(id)
        }
        setItems((prevItems) => prevItems.filter((item) => item.id !== id))
    }

    const sortedItems = [...items].sort((a, b) => {
        const aPinned = a.pinnedAt || 0
        const bPinned = b.pinnedAt || 0
        if (aPinned !== bPinned) return bPinned - aPinned
        return b.timestamp - a.timestamp
    })

    const getExpiryCountdown = (expiresAt: number | undefined): string => {
        if (!expiresAt) return ''
        const remaining = Math.max(0, expiresAt - Date.now())
        const minutes = Math.floor(remaining / 60000)
        const seconds = Math.floor((remaining % 60000) / 1000)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    return (
        <TooltipProvider>
            <div className="w-full max-w-sm space-y-3 rounded-lg border border-input bg-background p-4 shadow-sm">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Add to Clipboard</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste or type text..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    addItem(inputValue)
                                }
                            }}
                            className="flex-1"
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePaste}
                                >
                                    Paste
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Paste from system clipboard</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                        Saved Items ({items.length}/{maxItems})
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                        {sortedItems.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                                No items saved yet
                            </div>
                        ) : (
                            sortedItems.map((item) => {
                                const expiryCountdown = getExpiryCountdown(item.expiresAt)
                                const preview = item.text.length > 50
                                    ? `${item.text.substring(0, 50)}...`
                                    : item.text

                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            'flex items-center justify-between gap-2 rounded-md border p-2 text-sm transition-colors',
                                            item.pinnedAt
                                                ? 'border-primary/30 bg-primary/5'
                                                : 'border-input bg-muted/30 hover:bg-muted/50'
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-foreground" title={item.text}>
                                                {preview}
                                            </p>
                                            {expiryCountdown && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {expiryCountdown}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => copyToClipboard(item.text, item.id)}
                                                    >
                                                        <Copy
                                                            className={cn(
                                                                'w-3.5 h-3.5 transition-colors',
                                                                copiedId === item.id
                                                                    ? 'text-green-600'
                                                                    : 'text-muted-foreground'
                                                            )}
                                                        />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {copiedId === item.id ? 'Copied!' : 'Copy to clipboard'}
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => togglePin(item.id)}
                                                    >
                                                        <Pin
                                                            className={cn(
                                                                'w-3.5 h-3.5 transition-colors',
                                                                item.pinnedAt
                                                                    ? 'text-primary fill-primary'
                                                                    : 'text-muted-foreground'
                                                            )}
                                                        />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {item.pinnedAt ? 'Unpin' : 'Pin'}
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => deleteItem(item.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Delete</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
