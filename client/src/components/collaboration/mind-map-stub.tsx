"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GitBranch, ArrowRight } from "lucide-react"

export function MindMapStub() {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <Card className="p-8 border-dashed">
            <div className="flex flex-col items-center justify-center gap-6">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-lg">
                    <GitBranch className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-foreground dark:text-gray-100">
                        Mind Mapping
                    </h3>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                        Coming Soon
                    </p>
                </div>

                <div
                    className="w-full max-w-xs p-6 border border-border dark:border-gray-700 rounded-lg bg-muted dark:bg-gray-900 flex items-center justify-center"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div className="relative w-32 h-24 flex items-center justify-center">
                        {/* Center node */}
                        <div
                            className={`absolute w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                isHovered
                                    ? "bg-purple-500 scale-125"
                                    : "bg-purple-400 dark:bg-purple-600"
                            }`}
                        >
                            <div className="w-1.5 h-1.5 bg-card rounded-full" />
                        </div>

                        {/* Branch nodes */}
                        {[0, 90, 180, 270].map((angle, idx) => {
                            const rad = (angle * Math.PI) / 180
                            const x = 16 * Math.cos(rad)
                            const y = 12 * Math.sin(rad)
                            return (
                                <div
                                    key={idx}
                                    className="absolute"
                                    style={{
                                        transform: `translate(${x}px, ${y}px)`,
                                    }}
                                >
                                    <svg
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                        width={Math.abs(x) * 2}
                                        height={Math.abs(y) * 2}
                                        style={{ zIndex: -1 }}
                                    >
                                        <line
                                            x1={-x}
                                            y1={-y}
                                            x2={0}
                                            y2={0}
                                            stroke={isHovered ? "#a855f7" : "#d1d5db"}
                                            strokeWidth="1"
                                        />
                                    </svg>
                                    <div
                                        className={`w-4 h-4 rounded-full transition-colors ${
                                            isHovered
                                                ? "bg-purple-300 dark:bg-purple-700"
                                                : "bg-gray-300 dark:bg-gray-600"
                                        }`}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground dark:text-gray-400 max-w-xs">
                    Interactive mind maps with drag-and-drop nodes, AI suggestions, and team
                    collaboration
                </p>

                <Button disabled className="gap-2">
                    Explorer
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    )
}
