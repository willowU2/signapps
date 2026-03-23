"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock, Wrench, ArrowRight } from "lucide-react"

export function ArMaintenanceStub() {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <Card className="p-8 border-dashed">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 rounded-lg">
                    <Wrench className="w-8 h-8 text-red-600 dark:text-red-300" />
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Maintenance AR Guidee
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Coming Soon
                    </p>
                </div>

                <div
                    className="w-full max-w-xs p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <Lock className={`w-12 h-12 transition-all ${
                        isHovered
                            ? "text-red-500 scale-110"
                            : "text-gray-400 dark:text-gray-600"
                    }`} />
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                    AR-guided maintenance procedures and equipment instructions
                </p>

                <Button disabled className="gap-2">
                    Découvrir
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    )
}
