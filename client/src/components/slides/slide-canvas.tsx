import { useEffect, useRef, MutableRefObject } from "react"
import * as fabric from "fabric"
import { useTheme } from "next-themes"

interface FabricObjectWithId extends fabric.Object {
    id?: string;
    text?: string;
    isEditing?: boolean;
    /** fabric.IText selection/style methods present at runtime */
    setSelectionStyles?: (styles: Record<string, unknown>, start: number, end: number) => void;
    removeStyle?: (property: string) => void;
    selectionStart?: number;
    selectionEnd?: number;
    /** moveTo is present on fabric objects within a canvas context */
    moveTo?: (index: number) => void;
}

interface SlideCanvasProps {
    objects: Record<string, fabric.Object>;
    updateObject: (id: string, data: fabric.Object | Record<string, unknown>) => void;
    fabricCanvasRef: MutableRefObject<fabric.Canvas | null>;
    isUpdatingRef: MutableRefObject<boolean>;
    onSelectionChange: (obj: fabric.Object | null) => void;
    onCursorMove?: (x: number, y: number) => void;
    showGrid?: boolean;
    snapToGrid?: boolean;
    pageConfig?: {
        orientation: 'portrait' | 'landscape';
        backgroundColor: string;
    };
}

import { aiApi } from '@/lib/api'
import { useAiRouting } from '@/hooks/use-ai-routing'

const GRID_SIZE = 20;

export function SlideCanvas({
    objects,
    updateObject,
    fabricCanvasRef,
    isUpdatingRef,
    onSelectionChange,
    onCursorMove,
    showGrid,
    snapToGrid,
    pageConfig = { orientation: 'portrait', backgroundColor: '#ffffff' }
}: SlideCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { resolvedTheme } = useTheme()

    // Determine actual canvas background color based on theme
    const actualBg = pageConfig.backgroundColor === '#ffffff' && resolvedTheme === 'dark' 
        ? '#1a1a1a' // Dark mode default backdrop
        : pageConfig.backgroundColor;

    // Init Canvas
    useEffect(() => {
        let canvas: fabric.Canvas | null = null

        import("fabric").then((fabricModule) => {
            if (!canvasRef.current) return

            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose()
            }

            const c = new fabricModule.Canvas(canvasRef.current, {
                width: pageConfig.orientation === 'landscape' ? 1056 : 816,
                height: pageConfig.orientation === 'landscape' ? 816 : 1056,
                backgroundColor: actualBg
            })
            canvas = c
            fabricCanvasRef.current = c

            c.on("object:modified", (e: { target?: FabricObjectWithId }) => {
                const target = e.target
                if (target && target.id) {
                    isUpdatingRef.current = true
                    updateObject(target.id, target.toObject())
                    isUpdatingRef.current = false
                }
            })

            c.on("object:added", (e: { target?: FabricObjectWithId }) => {
                const target = e.target
                if (target && !target.id) {
                    target.id = Math.random().toString(36).substr(2, 9)
                    isUpdatingRef.current = true
                    updateObject(target.id, target.toObject())
                    isUpdatingRef.current = false
                }
            })

            // Selection events
            c.on("selection:created", (e: { selected?: FabricObjectWithId[]; target?: FabricObjectWithId }) => {
                const target = e.selected?.[0] || e.target
                onSelectionChange(target || null)
            })

            c.on("selection:updated", (e: { selected?: FabricObjectWithId[]; target?: FabricObjectWithId }) => {
                const target = e.selected?.[0] || e.target
                onSelectionChange(target || null)
            })

            // Deselection Handling
            c.on("selection:cleared", () => {
                if (onSelectionChange) onSelectionChange(null)
                isUpdatingRef.current = false
            })

            // --- 1. Grid Rendering via Native Canvas Context ---
            c.on('after:render', (opt: { ctx?: CanvasRenderingContext2D }) => {
                if (!showGrid) return // Wait for prop boolean flag

                const ctx = opt.ctx;
                if (!ctx) return;

                ctx.save();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
                ctx.lineWidth = 1;

                // Draw Vertical lines
                for (let i = 0; i < c.getWidth(); i += GRID_SIZE) {
                    ctx.beginPath();
                    ctx.moveTo(i, 0);
                    ctx.lineTo(i, c.getHeight());
                    ctx.stroke();
                }

                // Draw Horizontal lines
                for (let i = 0; i < c.getHeight(); i += GRID_SIZE) {
                    ctx.beginPath();
                    ctx.moveTo(0, i);
                    ctx.lineTo(c.getWidth(), i);
                    ctx.stroke();
                }

                ctx.restore();
            });

            // --- 2. Mathematical Snap-to-Grid during drag ---
            c.on('object:moving', (options: { target?: fabric.Object }) => {
                if (!snapToGrid) return;
                const target = options.target;
                if (!target) return;
                const snap = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
                if (target.left !== undefined) {
                    target.set('left', snap(target.left));
                }
                if (target.top !== undefined) {
                    target.set('top', snap(target.top));
                }
            });

            // --- 3. Smart Compose / Autocomplete Logic ---
            let debounceTimer: NodeJS.Timeout | null = null;
            let currentGhostText = "";
            let ghostedObject: FabricObjectWithId | null = null;

            (c as unknown as fabric.IText).on('text:changed' as never, (e: { target?: FabricObjectWithId }) => {
                const target = e.target;
                if (!target || target.isEditing === false) return;

                // Clear previous ghost visual
                if (currentGhostText && ghostedObject && ghostedObject.text?.endsWith(currentGhostText)) {
                    // Removing ghost text before continuing typing
                    ghostedObject.set({
                        text: ghostedObject.text!.slice(0, -currentGhostText.length)
                    });
                    currentGhostText = "";
                    c.requestRenderAll();
                }

                if (debounceTimer) clearTimeout(debounceTimer);

                const fullText = target.text;
                // Only trigger if we have at least a few words to provide context
                if (!fullText || fullText.split(" ").length < 3) return;

                debounceTimer = setTimeout(async () => {
                    try {
                        const config = useAiRouting.getState().getRouteConfig('slides');
                        const prompt = `Voici le début d'une phrase tapée par un utilisateur : "${fullText}". Complète la suite immédiate de cette phrase en restant logique avec le contexte. Retourne UNIQUEMENT 1 à 4 mots max de complétion, sans majuscule au début, ni point final, sans aucun autre commentaire. Si tu n'as pas de bonne suite, retourne RIEN.`;

                        // Using our generic chat backend, but asking for a very short, raw completion
                        const response = await aiApi.chat(prompt, {
                            provider: config.providerId || undefined,
                            model: config.modelId || undefined,
                            systemPrompt: "Tu es un assistant de frappe prédictive hyper-rapide (Smart Compose). Tu ne réponds QUE par la complétion exacte de la phrase, en minuscules de préférence, max 4 mots."
                        });

                        const suggestion = response.data.answer.trim();
                        if (suggestion && target.isEditing) { // Ensure still editing after await
                            currentGhostText = suggestion.startsWith(' ') ? suggestion : ' ' + suggestion;
                            ghostedObject = target;

                            // Visual hack for Fabric: append text, and select it to look "ghosted"
                            // A real implementation would draw it under the cursor, but selecting and coloring is a good proxy.
                            const originalLen = (target.text ?? '').length;
                            target.set({ text: (target.text ?? '') + currentGhostText });

                            // Style the ghosted part lightly
                            target.setSelectionStyles?.({ fill: '#9ca3af', fontStyle: 'italic' }, originalLen, (target.text ?? '').length);
                            c.requestRenderAll();
                        }
                    } catch (err) {
                        console.warn("Smart Compose error:", err);
                    }
                }, 1200); // 1.2s pause triggers completion
            });

            // We listen to keydown at the canvas container level to catch Tab
            c.wrapperEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Tab' && currentGhostText && ghostedObject) {
                    e.preventDefault();
                    // User accepts the prediction

                    // Remove all styling and solidify text
                    const len = (ghostedObject.text ?? '').length;
                    ghostedObject.removeStyle?.('fill');
                    ghostedObject.removeStyle?.('fontStyle');
                    ghostedObject.set({
                        fill: '#000000', // Reset to black or original color ideally
                        fontStyle: 'normal'
                    });

                    // Move cursor to end explicitly
                    ghostedObject.selectionStart = len;
                    ghostedObject.selectionEnd = len;

                    isUpdatingRef.current = true;
                    updateObject(ghostedObject.id!, ghostedObject.toObject());
                    isUpdatingRef.current = false;

                    currentGhostText = "";
                    ghostedObject = null;
                    c.requestRenderAll();
                } else if (e.key !== 'Tab' && currentGhostText && ghostedObject) {
                    // User overrides / ignores suggestion
                    ghostedObject.set({
                        text: (ghostedObject.text ?? '').slice(0, -currentGhostText.length)
                    });
                    currentGhostText = "";
                    c.requestRenderAll();
                }
            });

        });

        return () => {
            if (canvas) {
                canvas.dispose()
            }
            fabricCanvasRef.current = null
        }
    // actualBg and pageConfig.orientation intentionally omitted — canvas init runs once;
    // the second useEffect below handles dimension/bg updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateObject, fabricCanvasRef, isUpdatingRef, onSelectionChange, showGrid, snapToGrid])

    // Update canvas dimensions and background when pageConfig changes
    useEffect(() => {
        import("fabric").then(() => {
            const canvas = fabricCanvasRef.current
            if (!canvas) return

            // Update physical and background size
            canvas.setDimensions({
                width: pageConfig.orientation === 'landscape' ? 1056 : 816,
                height: pageConfig.orientation === 'landscape' ? 816 : 1056
            })
            canvas.backgroundColor = actualBg

            // Re-render
            canvas.requestRenderAll()
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageConfig.orientation, pageConfig.backgroundColor, actualBg, fabricCanvasRef])

    // Sync from Yjs to Canvas
    useEffect(() => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        if (isUpdatingRef.current) return

        import("fabric").then((fabricModule) => {
            Object.entries(objects).forEach(([id, objData]) => {
                const existing = (canvas.getObjects() as FabricObjectWithId[]).find((o) => o.id === id)
                if (existing) {
                    existing.set(objData as Partial<fabric.Object>)
                    existing.setCoords()
                } else {
                    fabricModule.util.enlivenObjects([objData]).then((enlivenedObjects) => {
                        enlivenedObjects.forEach((obj) => {
                            (obj as FabricObjectWithId).id = id
                            canvas.add(obj as fabric.FabricObject)
                        })
                    })
                }
            })

            // Appliquer l'ordre Z-Index
            const allObjs = [...canvas.getObjects()] as (FabricObjectWithId & { zIndex?: number })[];
            allObjs.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            allObjs.forEach((obj, idx) => {
                obj.moveTo?.(idx);
            });
            
            canvas.requestRenderAll()
        })
    }, [objects, fabricCanvasRef, isUpdatingRef])

    const handleWrapperMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onCursorMove) return

        // Calculate position relative to the center canvas area if we want to be exact,
        // or just relative to this wrapper container to sync nicely with the CursorOverlay.
        // For simplicity, we send coordinates relative to the div wrapper itself.
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        onCursorMove(x, y)
    }

    const wrapperRef = useRef<HTMLDivElement>(null);

    // Call calcOffset automatically when layout changes (e.g., right sidebar opens)
    useEffect(() => {
        if (!wrapperRef.current || !fabricCanvasRef.current) return;

        // Use a small timeout to allow layout shifts to settle before recalc
        let timeoutId: NodeJS.Timeout;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (fabricCanvasRef.current) {
                    fabricCanvasRef.current.calcOffset();
                    fabricCanvasRef.current.requestRenderAll();
                }
            }, 50);
        });

        resizeObserver.observe(wrapperRef.current);
        // Also observe the body to catch global flex shifts that might move the canvas
        // without necessarily resizing its exact wrapper width/height
        resizeObserver.observe(document.body);

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        };
    }, [fabricCanvasRef]);

    return (
        <div className="w-full h-full bg-[#f8f9fa] dark:bg-[#1f1f1f] flex justify-center overflow-auto p-8 relative">
            <div
                ref={wrapperRef}
                className={`bg-background shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] rounded-sm overflow-hidden relative transition-all duration-300 mx-auto shrink-0`}
                style={{
                    width: pageConfig.orientation === 'landscape' ? '1056px' : '816px',
                    height: pageConfig.orientation === 'landscape' ? '816px' : '1056px',
                    backgroundColor: actualBg
                }}
                onMouseMove={handleWrapperMouseMove}
            >
                <canvas ref={canvasRef} />
            </div>
        </div>
    )
}
