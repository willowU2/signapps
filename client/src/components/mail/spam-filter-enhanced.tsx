"use client"

// IDEA-041: User-configurable spam filter — sensitivity slider, whitelist/blacklist management

import { useState } from "react"
import { Plus, Trash2, ShieldCheck, ShieldAlert, Shield, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

interface SpamFilterConfig {
    sensitivity: number // 0-100
    whitelist: string[]
    blacklist: string[]
}

const DEFAULT_CONFIG: SpamFilterConfig = {
    sensitivity: 70,
    whitelist: [],
    blacklist: [],
}

function usePersistentList(storageKey: string, initial: string[]) {
    const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null
    const [items, setItems] = useState<string[]>(stored ? JSON.parse(stored) : initial)

    const add = (item: string) => {
        const trimmed = item.trim().toLowerCase()
        if (!trimmed) return false
        if (items.includes(trimmed)) { toast.error("Already in list"); return false }
        const updated = [...items, trimmed]
        setItems(updated)
        if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(updated))
        return true
    }

    const remove = (item: string) => {
        const updated = items.filter((i) => i !== item)
        setItems(updated)
        if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(updated))
    }

    return { items, add, remove }
}

interface FilterListProps {
    items: string[]
    onAdd: (item: string) => boolean
    onRemove: (item: string) => void
    placeholder: string
    badgeColor: string
    icon: React.ReactNode
}

function FilterList({ items, onAdd, onRemove, placeholder, badgeColor, icon }: FilterListProps) {
    const [input, setInput] = useState("")

    const handleAdd = () => {
        if (onAdd(input)) {
            setInput("")
            toast.success("Added to list")
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <Button size="sm" variant="outline" onClick={handleAdd} className="h-8 px-3">
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                {items.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Empty list</span>
                )}
                {items.map((item) => (
                    <Badge
                        key={item}
                        className={`${badgeColor} flex items-center gap-1 px-2 py-0.5 text-xs font-medium`}
                    >
                        {icon}
                        {item}
                        <button
                            onClick={() => onRemove(item)}
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                        >
                            <X className="h-2.5 w-2.5" />
                        </button>
                    </Badge>
                ))}
            </div>
        </div>
    )
}

interface SpamFilterEnhancedProps {
    accountId: string
    onSensitivityChange?: (value: number) => void
}

export function SpamFilterEnhanced({ accountId, onSensitivityChange }: SpamFilterEnhancedProps) {
    const [sensitivity, setSensitivity] = useState(DEFAULT_CONFIG.sensitivity)
    const whitelist = usePersistentList(`spam_whitelist_${accountId}`, [])
    const blacklist = usePersistentList(`spam_blacklist_${accountId}`, [])

    const getSensitivityLabel = (val: number) => {
        if (val < 30) return { label: "Permissive", desc: "Only obvious spam blocked", color: "text-green-600" }
        if (val < 60) return { label: "Balanced", desc: "Standard spam filtering", color: "text-blue-600" }
        if (val < 80) return { label: "Strict", desc: "Aggressive spam blocking", color: "text-amber-600" }
        return { label: "Maximum", desc: "Very aggressive — may catch legit emails", color: "text-red-600" }
    }

    const { label, desc, color } = getSensitivityLabel(sensitivity)

    const handleSensitivity = (vals: number[]) => {
        setSensitivity(vals[0])
        onSensitivityChange?.(vals[0])
    }

    return (
        <div className="space-y-4">
            {/* Sensitivity Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        Spam Filter Sensitivity
                    </CardTitle>
                    <CardDescription>Adjust how aggressively spam is detected</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Sensitivity level</Label>
                            <div className="text-right">
                                <span className={`text-sm font-bold ${color}`}>{label}</span>
                                <span className="text-xs text-muted-foreground ml-2">{sensitivity}%</span>
                            </div>
                        </div>
                        <Slider
                            value={[sensitivity]}
                            onValueChange={handleSensitivity}
                            min={0}
                            max={100}
                            step={5}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Permissive</span>
                            <span>Maximum</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">{desc}</p>
                </CardContent>
            </Card>

            {/* Whitelist / Blacklist */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Sender Lists</CardTitle>
                    <CardDescription>Manage trusted and blocked senders/domains</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="whitelist">
                        <TabsList className="w-full mb-4">
                            <TabsTrigger value="whitelist" className="flex-1 gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                                Whitelist ({whitelist.items.length})
                            </TabsTrigger>
                            <TabsTrigger value="blacklist" className="flex-1 gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                                Blacklist ({blacklist.items.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="whitelist" className="mt-0">
                            <p className="text-xs text-muted-foreground mb-3">
                                Emails from these senders/domains are never marked as spam.
                            </p>
                            <FilterList
                                items={whitelist.items}
                                onAdd={whitelist.add}
                                onRemove={whitelist.remove}
                                placeholder="email@example.com or example.com"
                                badgeColor="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50"
                                icon={<ShieldCheck className="h-3 w-3" />}
                            />
                        </TabsContent>

                        <TabsContent value="blacklist" className="mt-0">
                            <p className="text-xs text-muted-foreground mb-3">
                                Emails from these senders/domains are always blocked.
                            </p>
                            <FilterList
                                items={blacklist.items}
                                onAdd={blacklist.add}
                                onRemove={blacklist.remove}
                                placeholder="spam@example.com or example.com"
                                badgeColor="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50"
                                icon={<ShieldAlert className="h-3 w-3" />}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
