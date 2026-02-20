"use client"

import { useEffect, useRef, useState } from "react"
import * as fabric from "fabric"
import { useSlides } from "./use-slides"
import { cn } from "@/lib/utils"

export function SlideEditor() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const { objects, updateObject, removeObject, isConnected } = useSlides("slides-demo")
    const isUpdatingRef = useRef(false)

    // Init Canvas
    useEffect(() => {
        let canvas: any = null

        // Dynamic import to avoid SSR issues with fabric
        import("fabric").then((fabricModule) => {
            if (!canvasRef.current) return

            // If a canvas is already assigned to this element (Strict Mode case), dispose it first
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose()
            }

            canvas = new fabricModule.Canvas(canvasRef.current, {
                width: 800,
                height: 450, // 16:9
                backgroundColor: "#fff"
            })
            fabricCanvasRef.current = canvas

            // Event Listeners
            canvas.on("object:modified", (e: any) => {
                const target = e.target
                if (target && target.id) {
                    isUpdatingRef.current = true
                    updateObject(target.id, target.toObject())
                    isUpdatingRef.current = false
                }
            })

            canvas.on("object:added", (e: any) => {
                const target = e.target
                if (target && !target.id) {
                    // Assign ID if new
                    target.id = Math.random().toString(36).substr(2, 9)
                    isUpdatingRef.current = true
                    updateObject(target.id, target.toObject())
                    isUpdatingRef.current = false
                }
            })
        })

        return () => {
            if (canvas) {
                canvas.dispose()
            }
            // Also nullify the ref to ensure clean state
            fabricCanvasRef.current = null
        }
    }, []) // Run once on mount

    // Sync from Yjs to Canvas
    useEffect(() => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        if (isUpdatingRef.current) return

        // Import 'fabric' again to access classes
        import("fabric").then((fabricModule) => {
            // Diffing (naive)
            Object.entries(objects).forEach(([id, objData]) => {
                const existing = canvas.getObjects().find((o: any) => o.id === id)
                if (existing) {
                    // Update existing
                    // Avoid loop if we just updated it
                    // (Ideally compare content)
                    existing.set(objData as any)
                    existing.setCoords()
                } else {
                    // Add new
                    // Fabric object restoration from JSON
                    fabricModule.util.enlivenObjects([objData]).then((enlivenedObjects) => {
                        enlivenedObjects.forEach((obj: any) => {
                            obj.id = id
                            canvas.add(obj)
                        })
                        canvas.requestRenderAll()
                    })
                }
            })
            canvas.requestRenderAll()
        })

    }, [objects])


    const addText = () => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const text = new fabricModule.IText("New Text", {
                    left: 100,
                    top: 100
                })
                canvas.add(text)
            }
        })
    }

    const addRect = () => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const rect = new fabricModule.Rect({
                    left: 200,
                    top: 200,
                    fill: 'red',
                    width: 50,
                    height: 50
                })
                canvas.add(rect)
            }
        })
    }

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Simple Toolbar */}
            <div className="flex gap-2 p-2 bg-white rounded shadow sticky top-2 z-10">
                <div className={cn("h-3 w-3 rounded-full self-center", isConnected ? "bg-green-500" : "bg-red-500")} />
                <button onClick={addText} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Add Text</button>
                <button onClick={addRect} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">Add Rect</button>
            </div>

            <div className="shadow-lg border bg-white">
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}
