"use client"

import { useEffect, useRef, useState } from "react"
import * as fabric from "fabric"
import { useSlides } from "./use-slides"
import { cn } from "@/lib/utils"
import { Wand2 } from "lucide-react"

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


    const addMagicLayout = () => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current;
            if (canvas) {
                // Clear existing
                canvas.getObjects().forEach(obj => canvas.remove(obj));
                canvas.backgroundColor = "#F8F9FA";

                const title = new fabricModule.IText("Q3 Performance Review", {
                    left: 60,
                    top: 80,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 'bold',
                    fontSize: 48,
                    fill: "#111827",
                });

                const subtitle = new fabricModule.IText("Marketing & Sales alignment strategy", {
                    left: 60,
                    top: 140,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 24,
                    fill: "#6B7280",
                });

                const content = new fabricModule.IText("• 15% User retention increase\n• $1.2M MRR achievement\n• Successful V2 Launch", {
                    left: 60,
                    top: 220,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 20,
                    lineHeight: 1.6,
                    fill: "#374151"
                });

                const chartPlaceholder = new fabricModule.Rect({
                    left: 420,
                    top: 180,
                    width: 320,
                    height: 200,
                    fill: "#818cf8", // Indigo-400
                    rx: 16,
                    ry: 16
                });

                const chartLabel = new fabricModule.IText("YoY Growth Chart", {
                    left: 580,
                    top: 280,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 20,
                    fill: "#FFFFFF",
                    fontWeight: "bold",
                    originX: "center",
                    originY: "center"
                });

                const objects = [title, subtitle, content, chartPlaceholder, chartLabel];
                objects.forEach(obj => {
                    (obj as any).id = Math.random().toString(36).substr(2, 9);
                    canvas.add(obj);
                });

                canvas.requestRenderAll();

                objects.forEach(obj => {
                    isUpdatingRef.current = true;
                    updateObject((obj as any).id, (obj as any).toObject());
                    isUpdatingRef.current = false;
                });
            }
        });
    };

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
        <div className="flex flex-col items-center gap-4 w-full h-full p-4 relative">
            {/* Simple Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-premium border border-white/20 sticky top-2 z-10 animate-fade-in-up">
                <div className={cn("h-2.5 w-2.5 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")} title={isConnected ? "Connected" : "Disconnected"} />
                <div className="w-px h-6 bg-gray-200 mx-1" />

                <button
                    onClick={addMagicLayout}
                    className="flex items-center gap-2 group px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium shadow-md transition-all sm:hover:scale-105"
                >
                    <Wand2 className="w-4 h-4 text-white/90 group-hover:rotate-12 transition-transform" />
                    Magic Layout
                </button>

                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button onClick={addText} className="px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200/50">Add Text</button>
                <button onClick={addRect} className="px-3 py-1.5 bg-gray-50/50 hover:bg-gray-100/80 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200/50">Add Shape</button>
            </div>

            <div className="shadow-2xl border border-gray-100 bg-white rounded-lg overflow-hidden transition-all">
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}
