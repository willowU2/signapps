"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor } from "lucide-react"
import { getClient, ServiceName } from "@/lib/api/factory"

const itAssetsClient = getClient(ServiceName.IT_ASSETS)

// ─── Types ────────────────────────────────────────────────────────────────────

interface HardwareComponent {
    id: string;
    hardware_id: string;
    type: string;
    model: string;
    capacity?: string;
    serial_number?: string;
    created_at?: string;
}

interface AssetMonitorInfoProps {
    hardwareId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssetMonitorInfo({ hardwareId }: AssetMonitorInfoProps) {
    const [components, setComponents] = useState<HardwareComponent[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setLoading(true)
        itAssetsClient
            .get<HardwareComponent[]>(`/it-assets/hardware/${hardwareId}/components`)
            .then((res) => {
                const monitors = (res.data || []).filter((c) => c.type === "display" || c.type === "monitor")
                setComponents(monitors)
            })
            .catch(() => {
                // Non-critical: silently fail if components endpoint not available
            })
            .finally(() => setLoading(false))
    }, [hardwareId])

    if (loading) return null
    if (components.length === 0) return null

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-blue-500" />
                    Ecrans ({components.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {components.map((monitor, idx) => (
                        <div
                            key={monitor.id}
                            className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md bg-muted/40"
                        >
                            <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                    Ecran {idx + 1}{monitor.model ? ` — ${monitor.model}` : ""}
                                </p>
                                {monitor.capacity && (
                                    <p className="text-xs text-muted-foreground">{monitor.capacity}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
