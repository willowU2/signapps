"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Grid3X3, ArrowRight } from "lucide-react"

export function SpreadsheetStub() {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <Card className="p-8 border-dashed">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg">
                    <Grid3X3 className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-foreground dark:text-gray-100">
                        Tableur Collaboratif
                    </h3>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                        Coming Soon
                    </p>
                </div>

                <div
                    className="w-full max-w-xs p-4 border border-border dark:border-gray-700 rounded-lg bg-muted dark:bg-gray-900"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div className="grid grid-cols-4 gap-1">
                        {Array.from({ length: 12 }).map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-6 rounded transition-colors ${
                                    isHovered && idx < 8
                                        ? "bg-blue-200 dark:bg-blue-800"
                                        : "bg-gray-200 dark:bg-gray-700"
                                }`}
                            />
                        ))}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground dark:text-gray-400 max-w-xs">
                    Real-time collaborative spreadsheet with shared cursors, comments, and data
                    integration
                </p>

                <Button disabled className="gap-2">
                    Explorer
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    )
}
