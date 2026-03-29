"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Circle, ArrowRight } from "lucide-react"

export function ScreenRecorderStub() {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <Card className="p-8 border-dashed">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 rounded-lg">
                    <Circle className="w-8 h-8 text-red-600 dark:text-red-300" fill="currentColor" />
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-foreground dark:text-gray-100">
                        Screen Recording
                    </h3>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                        Coming Soon
                    </p>
                </div>

                <div
                    className="w-full max-w-xs aspect-video border border-border dark:border-gray-700 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div
                        className={`w-4 h-4 rounded-full transition-all ${
                            isHovered
                                ? "bg-red-500 scale-125"
                                : "bg-gray-400 dark:bg-gray-600"
                        }`}
                    />
                </div>

                <Button
                    disabled
                    variant="outline"
                    className="gap-2 border-red-200 dark:border-red-800"
                    size="lg"
                >
                    <Circle className="w-4 h-4 fill-red-600 text-red-600" />
                    Commencer l'enregistrement
                </Button>

                <p className="text-xs text-muted-foreground dark:text-gray-400 max-w-xs">
                    Record your screen with annotation tools, camera overlay, and instant cloud
                    upload
                </p>

                <Button disabled className="gap-2">
                    Découvrir
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    )
}
