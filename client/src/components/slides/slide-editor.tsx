import { useRef, useState, useCallback, useEffect } from "react"
import { Wand2 } from "lucide-react"
import * as fabric from "fabric"
import { useSlides } from "./use-slides"
import { SlideToolbar } from "./slide-toolbar"
import { SlideCanvas } from "./slide-canvas"
import { SlidePropertyPanel } from "./slide-property-panel"
import { Ruler } from '../docs/ruler'
import { DocumentOutline } from '../docs/document-outline'
import { OmniboxMenu } from "./omnibox-menu"
import { CursorOverlay } from "./cursor-overlay"
import { aiApi } from "@/lib/api"
import { useAiRouting } from "@/hooks/use-ai-routing"
import { toast } from "sonner"
import { useSimulatedMultiplayer } from "@/hooks/use-simulated-multiplayer"
import { EditorMenu } from "../editor/editor-menu"
import { GenericFeatureModal } from "@/components/editor/generic-feature-modal"
import pptxgen from "pptxgenjs"

// Let's create an interface matching the `useSlides` return type conceptually
interface SlideEditorProps {
    slideState: {
        objects: Record<string, any>;
        updateObject: (id: string, obj: any) => void;
        removeObject: (id: string) => void;
        updateCursor: (x: number, y: number) => void;
        collaborators: Record<number, any>;
        isConnected: boolean;
        activeSlideId: string | null;
        canUndo: boolean;
        canRedo: boolean;
        undo: () => void;
        redo: () => void;
        clearSlide: () => void;
    }
    isReadOnly?: boolean;
}

export function SlideEditor({ slideState, isReadOnly = false }: SlideEditorProps) {
    const {
        objects, updateObject, removeObject, updateCursor, collaborators, isConnected, activeSlideId,
        canUndo, canRedo, undo, redo, clearSlide
    } = slideState;

    const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
    const isUpdatingRef = useRef(false)
    const [activeObject, setActiveObject] = useState<fabric.Object | null>(null)
    const [omniboxMenu, setOmniboxMenu] = useState({ isOpen: false, x: 0, y: 0 })
    const [activeModal, setActiveModal] = useState<{ id: string, label?: string } | null>(null)

    const { getRouteConfig } = useAiRouting()

    // Editor UI Config State
    const [showGrid, setShowGrid] = useState(true)
    const [snapToGrid, setSnapToGrid] = useState(false)

    // --- Format Painter State ---
    const [isFormatPainting, setIsFormatPainting] = useState(false)
    const [copiedFormat, setCopiedFormat] = useState<any>(null)

    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef<any>(null)

    // --- Page Setup State ---
    const [pageConfig, setPageConfig] = useState<{ orientation: 'portrait' | 'landscape', backgroundColor: string }>({ orientation: 'portrait', backgroundColor: '#ffffff' })

    // Global keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (key === 's') { e.preventDefault(); toast.success('Enregistré automatiquement'); }
                else if (key === 'n') { e.preventDefault(); window.open('/slides', '_blank'); }
                else if (key === 'o') { e.preventDefault(); toast.info("Rendez-vous sur l'accueil Drive pour ouvrir un fichier."); }
                else if (key === 'q') { e.preventDefault(); toast.info("Fermez l'onglet du navigateur pour quitter la session."); }
                else if (key === 'a') {
                    const tag = (e.target as HTMLElement).tagName.toLowerCase();
                    if (tag !== 'input' && tag !== 'textarea') {
                        e.preventDefault();
                        const canvas = fabricCanvasRef.current;
                        if (canvas) {
                            canvas.discardActiveObject();
                            const objs = canvas.getObjects();
                            if (objs.length > 0) {
                                import("fabric").then((fabricModule) => {
                                    const sel = new fabricModule.ActiveSelection(objs, { canvas });
                                    canvas.setActiveObject(sel);
                                    canvas.requestRenderAll();
                                });
                            }
                        }
                    }
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const slideMenus = [
        {
            id: 'file', label: 'Fichier', items: [
                { label: 'Nouveau', subItems: [
                    { label: 'Présentation', action: 'new' },
                    { label: 'À partir d\'un modèle', action: 'todo' }
                ] },
                { label: 'Ouvrir', action: 'open', shortcut: 'Ctrl+O' },
                { label: 'Importer des diapositives', action: 'todo' },
                { label: 'Créer une copie', action: 'todo' },
                { sep: true },
                { label: 'Télécharger', subItems: [
                    { label: 'Microsoft PowerPoint (.pptx)', action: 'todo' },
                    { label: 'Document PDF (.pdf)', action: 'todo' },
                    { label: 'Image PNG (.png)', action: 'export' }
                ] },
                { sep: true },
                { label: 'Paramètres mis en page', subItems: [
                    { label: 'Portrait', action: 'pageSetup_portrait' },
                    { label: 'Paysage', action: 'pageSetup_landscape' }
                ] }
            ]
        },
        {
            id: 'edit', label: 'Édition', items: [
                { label: 'Annuler', action: 'undo', shortcut: 'Ctrl+Z' },
                { label: 'Rétablir', action: 'redo', shortcut: 'Ctrl+Y' },
                { sep: true },
                { label: 'Effacer la page', action: 'clear' }
            ]
        },
        {
            id: 'view', label: 'Affichage', items: [
                { label: 'Diaporama', action: 'fullScreen', shortcut: 'Ctrl+F5' },
                { sep: true },
                { label: 'Afficher la grille', action: 'toggleGrid' },
                { label: 'Aligner sur la grille', action: 'toggleSnap' }
            ]
        },
        {
            id: 'insert', label: 'Insertion', items: [
                { label: 'Texte', action: 'addText', shortcut: 'T' },
                { label: 'Forme', subItems: [
                    { label: 'Rectangle', action: 'addShapeRect' },
                    { label: 'Cercle', action: 'addShapeCircle' },
                    { label: 'Triangle', action: 'addShapeTriangle' }
                ] },
                { label: 'Ligne', action: 'addShapeLine' },
                { sep: true },
                { label: 'Image', action: 'todo' },
                { label: 'Mise en page AI', action: 'addMagicLayout' }
            ]
        },
        {
            id: 'format', label: 'Format', items: [
                { label: 'Reproduire la mise en forme', action: 'toggleFormatPainter' },
                { sep: true },
                { label: 'Premier plan', action: 'bringToFront', shortcut: 'Ctrl+Maj+Up' },
                { label: 'Arrière plan', action: 'sendToBack', shortcut: 'Ctrl+Maj+Down' },
                { sep: true },
                { label: 'Grouper', action: 'groupItems', shortcut: 'Ctrl+G' },
                { label: 'Dégrouper', action: 'ungroupItems', shortcut: 'Ctrl+Maj+G' }
            ]
        },
        {
            id: 'tools', label: 'Outils', items: [
                { label: 'Saisie vocale', action: 'toggleListen' }
            ]
        }
    ];

    // --- Simulated Multiplayer Presence ---
    const { collaborators: simCollabs } = useSimulatedMultiplayer(activeSlideId || "doc", true)

    // Merge Yjs true collaborators with our Simulated AI Ghosts
    const mergedCollaborators = { ...collaborators }
    simCollabs.forEach((guest, index) => {
        // Use negative/high IDs for ghosts to avoid collision with real Y.js client IDs
        mergedCollaborators[1000 + index] = {
            user: { name: guest.name, color: guest.color },
            cursor: guest.cursor ? { x: guest.cursor.x, y: guest.cursor.y, slideId: guest.activeSlideId || "doc" } : undefined
        }
    })

    useEffect(() => {
        // Initialize Web Speech API if supported
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = true
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'fr-FR' // Set default language to French

            let finalTranscript = ""

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = ""
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + " "
                    } else {
                        interimTranscript += transcript
                    }
                }

                // Update the active object immediately with the recognized text
                const canvas = fabricCanvasRef.current;
                const active = canvas?.getActiveObject();
                if (active && (active.type === 'i-text' || active.type === 'textbox' || active.type === 'text')) {
                    const textObj = active as any;

                    // We overwrite the whole text if it was empty, or append if it wasn't.
                    // For better UX we just append to existing to avoid wiping work
                    const existingText = textObj.text || ""

                    // Note: A smarter implementation would remember where we started dictating,
                    // but appending works well for this building block iteration.
                    // We only append the final parts, and temporarily show interim parts.
                    const newText = (finalTranscript + interimTranscript).trim()

                    // Prevent infinite appending bug by clearing our local tracker on stop
                    textObj.set({ text: newText });
                    canvas?.requestRenderAll();
                }
            }

            recognitionRef.current.onerror = (event: any) => {
                console.debug("Speech recognition error", event.error)
                setIsListening(false)
                toast.error("Microphone issue: " + event.error)
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
            }
        }
    }, [])

    const toggleListen = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
        } else {
            const canvas = fabricCanvasRef.current;
            const active = canvas?.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                toast.error("Veuillez sélectionner une zone de texte pour dicter.");
                return;
            }

            try {
                recognitionRef.current?.start()
                setIsListening(true)
                toast.info("Microphone activé. Parlez maintenant.")
            } catch (err) {
                console.debug("Could not start speech recognition", err)
            }
        }
    }, [isListening])


    // Clear canvas entirely when the slide ID changes
    useEffect(() => {
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.clear()
            fabricCanvasRef.current.backgroundColor = "#fff"
            setActiveObject(null)
        }
    }, [activeSlideId])

    // Handle Format Painter
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const handleSelectionCreated = (e: any) => {
            if (!isFormatPainting || !copiedFormat || !e.selected || e.selected.length === 0) return;

            const target = e.selected[0];
            // Only apply text formatting to text-like objects
            if (target.type === 'i-text' || target.type === 'textbox' || target.type === 'text') {
                target.set(copiedFormat);
                canvas.requestRenderAll();

                // Sync to Yjs
                isUpdatingRef.current = true;
                updateObject(target.id, target.toObject());
                isUpdatingRef.current = false;

                // Turn off painter after one use
                setIsFormatPainting(false);
                setCopiedFormat(null);

                toast.success('Format applied');
            }
        };

        canvas.on('selection:created', handleSelectionCreated);
        canvas.on('selection:updated', handleSelectionCreated);

        return () => {
            canvas.off('selection:created', handleSelectionCreated);
            canvas.off('selection:updated', handleSelectionCreated);
        }
    }, [fabricCanvasRef, isFormatPainting, copiedFormat, updateObject])

    // Trigger Format Painter mode
    const toggleFormatPainter = useCallback(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        if (isFormatPainting) {
            // Turning off
            setIsFormatPainting(false);
            setCopiedFormat(null);
            canvas.defaultCursor = 'default';
            canvas.hoverCursor = 'move';
        } else {
            // Turning on: must have a text object selected to copy format from
            const active = canvas.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                toast.error("Please select a text object first to copy its format");
                return;
            }

            // Extract core text styling attrs
            const formatToCopy = {
                fontFamily: (active as any).fontFamily,
                fontSize: (active as any).fontSize,
                fontWeight: (active as any).fontWeight,
                fontStyle: (active as any).fontStyle,
                fill: active.fill,
                underline: (active as any).underline,
                linethrough: (active as any).linethrough,
                textAlign: (active as any).textAlign,
            };

            setCopiedFormat(formatToCopy);
            setIsFormatPainting(true);

            // Visual feedback: change cursor
            canvas.defaultCursor = 'crosshair'; // A substitute for a paintbrush cursor
            canvas.hoverCursor = 'crosshair';

            toast.success("Format copied. Click another text to apply.");
        }
    }, [isFormatPainting]);

    // Clipboard for Fabric objects
    const clipboardRef = useRef<any>(null);

    // Listen for global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            // 1. Omnibox trigger
            if (!isTyping && (e.key === '/' || e.key === '@')) {
                e.preventDefault()
                setOmniboxMenu({ isOpen: true, x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 200 })
                return;
            }

            const canvas = fabricCanvasRef.current;
            if (!canvas || isTyping) return;

            // Escape: Deselect all objects or close omnibox
            if (e.key === 'Escape') {
                e.preventDefault();
                if (omniboxMenu.isOpen) {
                    setOmniboxMenu({ isOpen: false, x: 0, y: 0 });
                } else {
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                }
                return;
            }

            const activeObject = canvas.getActiveObject();
            if (!activeObject || (activeObject as any).isEditing) return;

            // 2. Delete object
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                isUpdatingRef.current = true;
                if (activeObject.type === 'activeSelection') {
                    const groupItems = (activeObject as any).getObjects();
                    groupItems.forEach((item: any) => {
                        canvas.remove(item);
                        removeObject(item.id);
                    });
                    canvas.discardActiveObject();
                } else {
                    canvas.remove(activeObject);
                    removeObject((activeObject as any).id);
                }
                isUpdatingRef.current = false;
                canvas.requestRenderAll();
                return;
            }

            // 3. Copy (Ctrl+C / Cmd+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                activeObject.clone().then((cloned: any) => {
                    clipboardRef.current = cloned;
                });
                return;
            }

            // 4. Paste (Ctrl+V / Cmd+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current) {
                e.preventDefault();
                
                // clone again so you can paste multiple times
                clipboardRef.current.clone().then((clonedObj: any) => {
                    canvas.discardActiveObject();
                    clonedObj.set({
                        left: clonedObj.left + 20,
                        top: clonedObj.top + 20,
                        evented: true,
                    });
                    
                    if (clonedObj.type === 'activeSelection') {
                        // active selection needs a loop to add objects individually
                        clonedObj.canvas = canvas;
                        clonedObj.forEachObject((obj: any) => {
                            obj.id = Math.random().toString(36).substr(2, 9);
                            canvas.add(obj);
                        });
                        // this should reset the selection to its original position
                        clonedObj.setCoords();
                    } else {
                        clonedObj.id = Math.random().toString(36).substr(2, 9);
                        canvas.add(clonedObj);
                    }
                    clipboardRef.current.top += 20;
                    clipboardRef.current.left += 20;
                    
                    canvas.setActiveObject(clonedObj);
                    canvas.requestRenderAll();
                    
                    // Update state
                    isUpdatingRef.current = true;
                    if (clonedObj.type === 'activeSelection') {
                        clonedObj.forEachObject((obj: any) => updateObject(obj.id, obj.toObject()));
                    } else {
                        updateObject(clonedObj.id, clonedObj.toObject());
                    }
                    isUpdatingRef.current = false;
                });
                return;
            }

            // 5. Duplicate (Ctrl+D / Cmd+D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                activeObject.clone().then((clonedObj: any) => {
                    canvas.discardActiveObject();
                    clonedObj.set({
                        left: clonedObj.left + 20,
                        top: clonedObj.top + 20,
                        evented: true,
                    });
                    
                    if (clonedObj.type === 'activeSelection') {
                        clonedObj.canvas = canvas;
                        clonedObj.forEachObject((obj: any) => {
                            obj.id = Math.random().toString(36).substr(2, 9);
                            canvas.add(obj);
                        });
                        clonedObj.setCoords();
                    } else {
                        clonedObj.id = Math.random().toString(36).substr(2, 9);
                        canvas.add(clonedObj);
                    }
                    
                    canvas.setActiveObject(clonedObj);
                    canvas.requestRenderAll();
                    
                    isUpdatingRef.current = true;
                    if (clonedObj.type === 'activeSelection') {
                        clonedObj.forEachObject((obj: any) => updateObject(obj.id, obj.toObject()));
                    } else {
                        updateObject(clonedObj.id, clonedObj.toObject());
                    }
                    isUpdatingRef.current = false;
                });
                return;
            }

            // 6. Nudging (Arrows)
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0; let dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;

                const objs = activeObject.type === 'activeSelection' ? (activeObject as any).getObjects() : [activeObject];
                // Move selection box
                activeObject.set({ left: (activeObject.left || 0) + dx, top: (activeObject.top || 0) + dy });
                activeObject.setCoords();

                isUpdatingRef.current = true;
                objs.forEach((obj: any) => {
                    // Update object inside group correctly handled by Fabric magically, or we trigger full update
                    updateObject(obj.id || (activeObject as any).id, obj.toObject());
                });
                isUpdatingRef.current = false;
                canvas.requestRenderAll();
                return;
            }

            // 7. Cut (Ctrl+X / Cmd+X)
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                activeObject.clone().then((cloned: any) => {
                    clipboardRef.current = cloned;
                    isUpdatingRef.current = true;
                    if (activeObject.type === 'activeSelection') {
                        const groupItems = (activeObject as any).getObjects();
                        groupItems.forEach((item: any) => {
                            canvas.remove(item);
                            removeObject(item.id);
                        });
                        canvas.discardActiveObject();
                    } else {
                        canvas.remove(activeObject);
                        removeObject((activeObject as any).id);
                    }
                    isUpdatingRef.current = false;
                    canvas.requestRenderAll();
                });
                return;
            }

            // 8. Bold (Ctrl+B / Cmd+B) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentWeight = textObj.fontWeight;
                    textObj.set('fontWeight', currentWeight === 'bold' ? 'normal' : 'bold');
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    updateObject((activeObject as any).id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }

            // 9. Italic (Ctrl+I / Cmd+I) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentStyle = textObj.fontStyle;
                    textObj.set('fontStyle', currentStyle === 'italic' ? 'normal' : 'italic');
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    updateObject((activeObject as any).id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }

            // 10. Underline (Ctrl+U / Cmd+U) - for text objects
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
                    const textObj = activeObject as fabric.IText;
                    const currentUnderline = textObj.underline;
                    textObj.set('underline', !currentUnderline);
                    canvas.requestRenderAll();
                    isUpdatingRef.current = true;
                    updateObject((activeObject as any).id, activeObject.toObject());
                    isUpdatingRef.current = false;
                }
                return;
            }
        }

        // Listen context menu / double click on canvas area for mouse-aware positioning
        const handleGlobalClick = (e: MouseEvent) => {
            if (e.button === 2) { // Right click
                // Prevent default context menu elsewhere? Optional.
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [omniboxMenu.isOpen, removeObject, updateObject])

    // Define a stable object modification pipeline
    const handleUpdateActiveObject = useCallback((id: string, updates: any) => {
        isUpdatingRef.current = true
        // Merge updates with the current object data directly in Yjs via hook
        const currentData = objects[id] || {};
        updateObject(id, { ...currentData, ...updates })
        isUpdatingRef.current = false

        // Force state update to re-render the properties panel
        if (fabricCanvasRef.current) {
            const currentSelected = fabricCanvasRef.current.getActiveObject()
            // We clone merely to trigger React's re-render
            setActiveObject(currentSelected ? Object.assign(Object.create(Object.getPrototypeOf(currentSelected)), currentSelected) : null)
        }
    }, [objects, updateObject])

    const addMagicLayout = async () => {
        const config = getRouteConfig('slides');
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const toastId = toast.loading("✨ AI Generation in progress...");

        try {
            const prompt = "You are a strict JSON generator. Return a JSON array of objects representing a presentation slide layout about 'Q3 Performance Review' containing a title, a subtitle, 3 bullet points, and a placeholder rect for a chart. Each object must have a 'type' ('text' or 'rect'), 'text' (if type is text), 'left', 'top', 'width', 'height', 'fill', 'fontSize', 'fontFamily', 'fontWeight'. Return ONLY valid JSON array with no markdown blocks. Use beautiful colors.";

            const response = await aiApi.chat(prompt, {
                provider: config.providerId || undefined,
                model: config.modelId || undefined,
                systemPrompt: "You are an assistant that outputs strictly raw JSON arrays. Do not wrap in ```json blocks. Generate clean, well-aligned dimensions.",
            });

            // Try to parse the answer as JSON
            let answer = response.data.answer.trim();
            // Clean markdown if present
            if (answer.startsWith("```json")) {
                answer = answer.replace(/^```json/, "").replace(/```$/, "").trim();
            } else if (answer.startsWith("```")) {
                answer = answer.replace(/^```/, "").replace(/```$/, "").trim();
            }

            const layoutData = JSON.parse(answer);

            import("fabric").then((fabricModule) => {
                canvas.getObjects().forEach(obj => canvas.remove(obj));
                canvas.backgroundColor = "#F8F9FA";

                const layoutObjects: any[] = [];

                for (const item of layoutData) {
                    let obj;
                    if (item.type === 'text') {
                        obj = new fabricModule.IText(item.text || 'Text', {
                            left: item.left || 50,
                            top: item.top || 50,
                            fontFamily: item.fontFamily || "Inter, sans-serif",
                            fontSize: item.fontSize || 20,
                            fill: item.fill || "#000000",
                            fontWeight: item.fontWeight || "normal"
                        });
                    } else if (item.type === 'rect') {
                        obj = new fabricModule.Rect({
                            left: item.left || 50,
                            top: item.top || 50,
                            width: item.width || 100,
                            height: item.height || 100,
                            fill: item.fill || "#818cf8",
                            rx: 8,
                            ry: 8
                        });
                    }
                    if (obj) {
                        (obj as any).id = Math.random().toString(36).substr(2, 9);
                        layoutObjects.push(obj);
                        canvas.add(obj);
                    }
                }

                canvas.requestRenderAll();

                layoutObjects.forEach((obj: any) => {
                    isUpdatingRef.current = true;
                    updateObject(obj.id, obj.toObject());
                    isUpdatingRef.current = false;
                });

                toast.success("Magic Layout generated successfully!", { id: toastId });
            });

        } catch (error) {
            console.debug("Layout generation failed", error);
            toast.error("Failed to generate layout. AI model may have returned invalid JSON or provider is unavailable.", { id: toastId });
        }
    };

    const addText = (defaultText: string = "New Text", options: any = {}) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const text = new fabricModule.IText(defaultText, {
                    left: 100,
                    top: 100,
                    fontFamily: "Inter, sans-serif",
                    ...options
                })
                canvas.add(text)
                canvas.setActiveObject(text)
            }
        })
    }

    const addShape = (type: 'rect' | 'circle' | 'triangle' | 'line') => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                let shape: any;
                const defaultOpts = { left: 200, top: 200, fill: '#818cf8' }

                switch (type) {
                    case 'rect':
                        shape = new fabricModule.Rect({ ...defaultOpts, width: 100, height: 100, rx: 8, ry: 8 })
                        break;
                    case 'circle':
                        shape = new fabricModule.Circle({ ...defaultOpts, radius: 50 })
                        break;
                    case 'triangle':
                        shape = new fabricModule.Triangle({ ...defaultOpts, width: 100, height: 100 })
                        break;
                    case 'line':
                        shape = new fabricModule.Line([50, 50, 200, 50], { ...defaultOpts, stroke: '#818cf8', strokeWidth: 4, fill: undefined })
                        break;
                }

                if (shape) {
                    canvas.add(shape)
                    canvas.setActiveObject(shape)
                }
            }
        })
    }

    const addImage = (url: string) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                fabricModule.Image.fromURL(url).then((img: import("fabric").Image) => {
                    // Auto-scale huge images to fit into the canvas (800x450 bounds)
                    const maxWidth = 400
                    const maxHeight = 300

                    if (img.width && img.width > maxWidth) {
                        img.scaleToWidth(maxWidth)
                    }
                    if (img.height && img.getScaledHeight() > maxHeight) {
                        img.scaleToHeight(maxHeight)
                    }

                    img.set({
                        left: 200,
                        top: 200,
                        originX: 'center',
                        originY: 'center',
                        rx: 4, // Slight corner rounding for modern look
                        ry: 4
                    })

                    canvas.add(img)
                    canvas.setActiveObject(img)
                }).catch((err: any) => {
                    console.debug("Failed to load image:", err)
                    alert("Impossible de charger cette image. Vérifiez que l'URL est publique et que le serveur autorise le CORS.")
                })
            }
        })
    }

    const addSmartChip = (type: 'user' | 'status' | 'date' | 'file', label: string, color?: string) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                // Formatting based on type
                let chipColor = color || '#e2e8f0'; // default gray
                let textColor = '#1e293b';
                let icon = '';

                switch (type) {
                    case 'user':
                        chipColor = '#dbeafe'; // light blue
                        textColor = '#1e40af';
                        icon = '👤 ';
                        break;
                    case 'date':
                        chipColor = '#fef3c7'; // light yellow
                        textColor = '#b45309';
                        icon = '📅 ';
                        break;
                    case 'file':
                        chipColor = '#f3e8ff'; // light purple
                        textColor = '#6b21a8';
                        icon = '📄 ';
                        break;
                    case 'status':
                        chipColor = color || '#10b981'; // Green by default
                        textColor = '#ffffff';
                        icon = '';
                        break;
                }

                const displayLabel = icon + label;

                const text = new fabricModule.IText(displayLabel, {
                    fontSize: 14,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: "600",
                    fill: textColor,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0
                })

                // Calculate width based on text
                const paddingX = 20
                const paddingY = 10
                const width = (text.width || 50) + paddingX
                const height = (text.height || 20) + paddingY

                const bg = new fabricModule.Rect({
                    width,
                    height,
                    rx: height / 2,
                    ry: height / 2,
                    fill: chipColor,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0,
                    stroke: type === 'user' ? '#bfdbfe' : undefined, // Subtle border
                    strokeWidth: type === 'user' ? 1 : 0
                })

                const group = new fabricModule.Group([bg, text], {
                    left: 200,
                    top: 200,
                    lockScalingY: true, // Prevent breaking the pill shape
                    // @ts-ignore
                    isSmartChip: true,
                    // @ts-ignore
                    chipType: type
                })

                canvas.add(group)
                canvas.setActiveObject(group)
            }
        })
    }

    const addWorkflow = (type: 'signature' | 'email' | 'meeting') => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                let groupObjects: any[] = []

                // Get center of current view
                const vpt = canvas.viewportTransform;
                const startX = vpt ? (-vpt[4] + canvas.width! / 2) - 200 : 100;
                const startY = vpt ? (-vpt[5] + canvas.height! / 2) - 100 : 100;

                if (type === 'signature') {
                    // --- Premium eSignature Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 340, height: 160, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.08)', blur: 15, offsetY: 4 }) })

                    const headerBg = new fabricModule.Rect({ left: startX, top: startY, width: 340, height: 42, fill: '#f8fafc', rx: 12, ry: 12 }) // Clip path not possible easily on group, we accept overlap
                    const headerLine = new fabricModule.Line([startX, startY + 42, startX + 340, startY + 42], { stroke: '#e2e8f0', strokeWidth: 1 })

                    const iconBox = new fabricModule.Rect({ left: startX + 16, top: startY + 11, width: 20, height: 20, rx: 4, ry: 4, fill: '#ede9fe' })
                    const title = new fabricModule.IText("🖋️ eSignature Request", { left: startX + 18, top: startY + 13, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#4f46e5' })

                    const signLabel = new fabricModule.IText("Sign here:", { left: startX + 24, top: startY + 64, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const signZoneBg = new fabricModule.Rect({ left: startX + 24, top: startY + 84, width: 180, height: 50, fill: '#f1f5f9', rx: 4, ry: 4, stroke: '#cbd5e1', strokeWidth: 1, strokeDashArray: [4, 4] })
                    const signZoneTxt = new fabricModule.IText("Click to sign", { left: startX + 76, top: startY + 102, fontSize: 12, fontFamily: "Inter, sans-serif", fill: '#94a3b8' })

                    const dateLabel = new fabricModule.IText("Date:", { left: startX + 220, top: startY + 64, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const dateZoneBg = new fabricModule.Rect({ left: startX + 220, top: startY + 84, width: 96, height: 50, fill: '#f8fafc', rx: 4, ry: 4, stroke: '#e2e8f0', strokeWidth: 1 })

                    groupObjects = [bg, headerBg, headerLine, title, signLabel, signZoneBg, signZoneTxt, dateLabel, dateZoneBg]
                }
                else if (type === 'email') {
                    // --- Premium Email Draft Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 440, height: 280, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 20, offsetY: 8 }) })

                    const headerBg = new fabricModule.Rect({ left: startX, top: startY, width: 440, height: 48, fill: '#f8fafc' })
                    const title = new fabricModule.IText("✉️ Email Draft", { left: startX + 20, top: startY + 16, fontSize: 14, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#0f172a' })

                    // Button Send preview
                    const btnBg = new fabricModule.Rect({ left: startX + 340, top: startY + 12, width: 80, height: 26, fill: '#2563eb', rx: 13, ry: 13 })
                    const btnTxt = new fabricModule.IText("Send", { left: startX + 364, top: startY + 18, fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#ffffff' })

                    const line1 = new fabricModule.Line([startX, startY + 48, startX + 440, startY + 48], { stroke: '#e2e8f0', strokeWidth: 1 })
                    const toLabel = new fabricModule.IText("To:", { left: startX + 20, top: startY + 62, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })

                    // Smart chip simulated for "To"
                    const toChipBg = new fabricModule.Rect({ left: startX + 50, top: startY + 58, width: 140, height: 22, fill: '#eff6ff', rx: 11, ry: 11 })
                    const toChipTxt = new fabricModule.IText("👤 client@company.com", { left: startX + 58, top: startY + 63, fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#1d4ed8' })

                    const line2 = new fabricModule.Line([startX, startY + 90, startX + 440, startY + 90], { stroke: '#f1f5f9', strokeWidth: 1 })
                    const subjLabel = new fabricModule.IText("Subject:", { left: startX + 20, top: startY + 104, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "500", fill: '#64748b' })
                    const subjInput = new fabricModule.IText("Project Proposal Q3", { left: startX + 80, top: startY + 104, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#0f172a' })

                    const line3 = new fabricModule.Line([startX, startY + 132, startX + 440, startY + 132], { stroke: '#f1f5f9', strokeWidth: 1 })
                    const body = new fabricModule.IText("Hi there,\n\nPlease find attached the latest strategy draft.\n\nBest regards,", { left: startX + 20, top: startY + 150, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#334155', lineHeight: 1.5 })

                    groupObjects = [bg, headerBg, title, btnBg, btnTxt, line1, toLabel, toChipBg, toChipTxt, line2, subjLabel, subjInput, line3, body]
                }
                else if (type === 'meeting') {
                    // --- Premium Meeting Notes Block ---
                    const bg = new fabricModule.Rect({ left: startX, top: startY, width: 500, height: 220, fill: '#ffffff', rx: 12, ry: 12, stroke: '#e2e8f0', strokeWidth: 1, shadow: new fabricModule.Shadow({ color: 'rgba(0,0,0,0.06)', blur: 12, offsetY: 4 }) })

                    const topBar = new fabricModule.Rect({ left: startX, top: startY, width: 500, height: 6, fill: '#8b5cf6', rx: 12, ry: 12 }) // Top colored accent

                    const title = new fabricModule.IText("📅 Weekly Sync: Product Team", { left: startX + 24, top: startY + 24, fontSize: 16, fontFamily: "Inter, sans-serif", fontWeight: "bold", fill: '#0f172a' })

                    // Date chip
                    const dateChipBg = new fabricModule.Rect({ left: startX + 24, top: startY + 54, width: 90, height: 22, fill: '#fef3c7', rx: 4, ry: 4 })
                    const dateChipTxt = new fabricModule.IText("Oct 24, 2024", { left: startX + 32, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#b45309' })

                    // Attendees
                    const attLabel = new fabricModule.IText("Attendees:", { left: startX + 130, top: startY + 59, fontSize: 12, fontFamily: "Inter, sans-serif", fill: '#64748b' })
                    const att1Bg = new fabricModule.Rect({ left: startX + 196, top: startY + 54, width: 64, height: 22, fill: '#f1f5f9', rx: 11, ry: 11 })
                    const att1Txt = new fabricModule.IText("👤 Alice", { left: startX + 204, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fill: '#475569' })
                    const att2Bg = new fabricModule.Rect({ left: startX + 266, top: startY + 54, width: 60, height: 22, fill: '#f1f5f9', rx: 11, ry: 11 })
                    const att2Txt = new fabricModule.IText("👤 Bob", { left: startX + 274, top: startY + 59, fontSize: 11, fontFamily: "Inter, sans-serif", fill: '#475569' })

                    const line = new fabricModule.Line([startX + 24, startY + 90, startX + 476, startY + 90], { stroke: '#f1f5f9', strokeWidth: 1 })

                    const agendaTitle = new fabricModule.IText("Notes & Agenda", { left: startX + 24, top: startY + 110, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#334155' })
                    const agendaItems = new fabricModule.IText("• Review Q3 Metrics\n• Discussion on onboarding flow", { left: startX + 24, top: startY + 134, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#475569', lineHeight: 1.5 })

                    const actionTitle = new fabricModule.IText("Action Items", { left: startX + 260, top: startY + 110, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: "600", fill: '#334155' })
                    const actionItems = new fabricModule.IText("☐ Update design system (Alice)\n☐ Schedule user interviews (Bob)", { left: startX + 260, top: startY + 134, fontSize: 13, fontFamily: "Inter, sans-serif", fill: '#475569', lineHeight: 1.5 })

                    groupObjects = [bg, topBar, title, dateChipBg, dateChipTxt, attLabel, att1Bg, att1Txt, att2Bg, att2Txt, line, agendaTitle, agendaItems, actionTitle, actionItems]
                }

                if (groupObjects.length > 0) {
                    const group = new fabricModule.Group(groupObjects, {
                        left: startX,
                        top: startY,
                        // @ts-ignore
                        isWorkflowBlock: true,
                        // @ts-ignore
                        workflowType: type
                    })
                    canvas.add(group)
                    canvas.setActiveObject(group)
                }
            }
        })
    }

    const addTable = (rows = 3, cols = 3) => {
        import("fabric").then((fabricModule) => {
            const canvas = fabricCanvasRef.current
            if (canvas) {
                const groupObjects: any[] = []

                // Get center of current view
                const vpt = canvas.viewportTransform;
                const startX = vpt ? (-vpt[4] + canvas.width! / 2) - 200 : 100;
                const startY = vpt ? (-vpt[5] + canvas.height! / 2) - 100 : 100;

                const cellWidth = 120;
                const cellHeight = 40;

                // Build header (Row 0)
                for (let c = 0; c < cols; c++) {
                    const bg = new fabricModule.Rect({
                        left: startX + c * cellWidth,
                        top: startY,
                        width: cellWidth,
                        height: cellHeight,
                        fill: '#f1f5f9', // subtle gray header
                        stroke: '#cbd5e1',
                        strokeWidth: 1
                    });
                    const text = new fabricModule.IText(`Col ${c + 1}`, {
                        left: startX + c * cellWidth + 12,
                        top: startY + 12,
                        fontSize: 13,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: "600",
                        fill: '#334155'
                    });
                    groupObjects.push(bg, text);
                }

                // Build body rows
                for (let r = 1; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bg = new fabricModule.Rect({
                            left: startX + c * cellWidth,
                            top: startY + r * cellHeight,
                            width: cellWidth,
                            height: cellHeight,
                            fill: '#ffffff',
                            stroke: '#cbd5e1',
                            strokeWidth: 1
                        });
                        const text = new fabricModule.IText("", {
                            left: startX + c * cellWidth + 12,
                            top: startY + r * cellHeight + 12,
                            fontSize: 13,
                            fontFamily: "Inter, sans-serif",
                            fill: '#475569'
                        });

                        // Fake placeholder text if empty cell (for clickability visually mostly)
                        // If we set text to "" it might be hard to click with IText sometimes in a group. 
                        // Actually in a group, the text cannot be double-clicked cleanly without entering group mode.
                        // We will just leave it empty.
                        groupObjects.push(bg, text);
                    }
                }

                if (groupObjects.length > 0) {
                    const group = new fabricModule.Group(groupObjects, {
                        left: startX,
                        top: startY,
                        // @ts-ignore
                        isTableBlock: true,
                        // @ts-ignore
                        subTargetCheck: true // Required for editing items inside a group
                    })
                    canvas.add(group)
                    canvas.setActiveObject(group)
                }
            }
        })
    }

    const exportToPNG = () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        // Export with multiplier 2 for High Resolution (Retina ready)
        const dataURL = canvas.toDataURL({
            format: 'png',
            multiplier: 2
        })

        const link = document.createElement('a')
        link.download = `Slide-Export-${new Date().toISOString().slice(0, 10)}.png`
        link.href = dataURL
        document.body.appendChild(link)
        document.body.removeChild(link)
    }

    const exportToPPTX = () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        
        const pres = new pptxgen()
        const slide = pres.addSlide()
        
        // "Best-effort" PPTX generation
        canvas.getObjects().forEach((obj) => {
             const o = obj as any
             const scaleX = o.scaleX || 1
             const scaleY = o.scaleY || 1
             const x = (o.left || 0) / 100
             const y = (o.top || 0) / 100
             const w = (o.width || 0) * scaleX / 100
             const h = (o.height || 0) * scaleY / 100
             
             if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
                 slide.addText(o.text || '', { x, y, w, h, fontSize: (o.fontSize || 18) * scaleY, color: o.fill?.replace('#', '') || '000000' })
             } else if (obj.type === 'rect') {
                 slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: o.fill?.replace('#', '') || 'CCCCCC' } })
             } else if (obj.type === 'circle') {
                 slide.addShape(pres.ShapeType.ellipse, { x, y, w, h, fill: { color: o.fill?.replace('#', '') || 'CCCCCC' } })
             } else if (obj.type === 'image') {
                 try {
                     const dataUrl = o.toDataURL()
                     slide.addImage({ data: dataUrl, x, y, w, h })
                 } catch (err) {
                     console.debug("Could not export image to PPTX", err)
                 }
             }
        })
        
        pres.writeFile({ fileName: `Slide-Export-${new Date().toISOString().slice(0, 10)}.pptx` })
        toast.success("Diapositive exportée au format PPTX")
    }

    // --- Read Only Lock ---
    useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const isInteractive = !isReadOnly;
        canvas.selection = isInteractive;
        canvas.getObjects().forEach(obj => {
            obj.selectable = isInteractive;
            obj.evented = isInteractive;
        });
        canvas.requestRenderAll();
    }, [isReadOnly, objects, activeSlideId]);
    
    // --- Global Command Bar AI Integration ---
    useEffect(() => {
        const handleAiAction = async (e: CustomEvent) => {
            const { action } = e.detail;
            const config = getRouteConfig('slides');

            if (action === 'generate-layout') {
                addMagicLayout();
                return;
            }

            const canvas = fabricCanvasRef.current;
            const active = canvas?.getActiveObject();
            if (!active || (active.type !== 'i-text' && active.type !== 'textbox' && active.type !== 'text')) {
                if (action !== 'generate-layout') {
                    toast.error("Veuillez sélectionner une zone de texte d'abord.");
                }
                return;
            }

            const textObj = active as any;
            const currentText = textObj.text || "";
            const toastId = toast.loading("✨ IA en cours de traitement...");

            try {
                let prompt = "";
                let systemPrompt = "";

                if (action === 'simplify-text') {
                    prompt = `Simplifie ce texte pour une présentation courte : "${currentText}"`;
                    systemPrompt = "Tu es un relecteur. Ne retourne QUE le texte corrigé/simplifié, sans guillemets ni intro.";
                } else if (action === 'grammar-check') {
                    prompt = `Corrige les fautes d'orthographe et de grammaire de ce texte : "${currentText}"`;
                    systemPrompt = "Tu es un correcteur orthographique professionnel. Retourne uniquement le texte corrigé.";
                } else if (action === 'translate-en') {
                    prompt = `Traduis précisément ceci en anglais fluide : "${currentText}"`;
                    systemPrompt = "You are a professional translator. Return ONLY the English translation without any surrounding quotes.";
                } else if (action === 'expand-text') {
                    prompt = `Développe cette idée en un paragraphe complet et professionnel : "${currentText}"`;
                    systemPrompt = "Tu es rédacteur. Rédige un bout de texte clair et étoffé. Ne réponds que le texte métier.";
                }

                const response = await aiApi.chat(prompt, {
                    provider: config.providerId || undefined,
                    model: config.modelId || undefined,
                    systemPrompt
                });

                textObj.set({
                    text: response.data.answer.trim(),
                    // Optionally visual feedback:
                    fill: action === 'grammar-check' ? '#10b981' : (action === 'translate-en' ? '#f59e0b' : '#3b82f6')
                });

                canvas?.requestRenderAll();
                updateObject(textObj.id, textObj.toObject());
                toast.success("Texte mis à jour avec succès !", { id: toastId });

            } catch (err) {
                console.debug("AI Text Action failed", err);
                toast.error("Erreur lors de la génération IA.", { id: toastId });
            }
        };

        window.addEventListener('app:ai-action', handleAiAction as unknown as EventListener);
        return () => window.removeEventListener('app:ai-action', handleAiAction as unknown as EventListener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateObject, getRouteConfig])



    return (
        <div className="flex flex-col w-full h-full gap-0.5 relative animate-fade-in flex-1 min-h-0">
            {!isReadOnly && (
                <div className="-ml-1.5 flex flex-col pt-0.5">
                    <EditorMenu menus={slideMenus} onAction={(action, label) => {
                        const NATIVE_ACTIONS = ['open', 'new', 'undo', 'redo', 'clear', 'export', 'export_pptx', 'toggleGrid', 'toggleSnap', 'addText', 'addShapeRect', 'addShapeCircle', 'addShapeTriangle', 'addShapeLine', 'addMagicLayout', 'toggleFormatPainter', 'toggleListen', 'fullScreen', 'bringToFront', 'sendToBack', 'pageSetup_portrait', 'pageSetup_landscape', 'groupItems', 'ungroupItems'];
                        
                        if (action === 'todo' || !NATIVE_ACTIONS.includes(action)) {
                            setActiveModal({ id: action, label });
                            return;
                        }

                        if (action === 'open') toast.info("Rendez-vous sur l'accueil Drive pour ouvrir une présentation.")
                        if (action === 'new') window.open('/slides', '_blank');
                        if (action === 'undo') undo();
                        if (action === 'redo') redo();
                        if (action === 'clear') clearSlide();
                        if (action === 'export') exportToPNG();
                        if (action === 'export_pptx') exportToPPTX();
                        if (action === 'toggleGrid') setShowGrid(!showGrid);
                        if (action === 'toggleSnap') setSnapToGrid(!snapToGrid);
                        if (action === 'addText') addText();
                        if (action === 'addShapeRect') addShape('rect');
                        if (action === 'addShapeCircle') addShape('circle');
                        if (action === 'addShapeTriangle') addShape('triangle');
                        if (action === 'addShapeLine') addShape('line');
                        if (action === 'addMagicLayout') addMagicLayout();
                        if (action === 'toggleFormatPainter') toggleFormatPainter();
                        if (action === 'toggleListen') toggleListen();
                        if (action === 'pageSetup_portrait') setPageConfig({ ...pageConfig, orientation: 'portrait' });
                        if (action === 'pageSetup_landscape') setPageConfig({ ...pageConfig, orientation: 'landscape' });
                        if (action === 'bringToFront') {
                            const canvas = fabricCanvasRef.current;
                            const active = canvas?.getActiveObject();
                            if (active && canvas) {
                                const maxZ = Math.max(0, ...canvas.getObjects().map((o: any) => o.zIndex || 0));
                                (active as any).zIndex = maxZ + 1;
                                canvas.bringObjectToFront(active);
                                isUpdatingRef.current = true;
                                updateObject((active as any).id, active.toObject(['id', 'zIndex']));
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            }
                        }
                        if (action === 'sendToBack') {
                            const canvas = fabricCanvasRef.current;
                            const active = canvas?.getActiveObject();
                            if (active && canvas) {
                                const minZ = Math.min(0, ...canvas.getObjects().map((o: any) => o.zIndex || 0));
                                (active as any).zIndex = minZ - 1;
                                canvas.sendObjectToBack(active);
                                isUpdatingRef.current = true;
                                updateObject((active as any).id, active.toObject(['id', 'zIndex']));
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            }
                        }
                        if (action === 'groupItems') {
                            const canvas = fabricCanvasRef.current;
                            if (!canvas) return;
                            const active = canvas.getActiveObject();
                            if (active && active.type === 'activeSelection') {
                                isUpdatingRef.current = true;
                                const groupItems = (active as any).getObjects();
                                const groupId = Math.random().toString(36).substr(2, 9);
                                const group = (active as any).toGroup();
                                group.id = groupId;
                                // Save the new group
                                updateObject(group.id, group.toObject(['id', 'zIndex']));
                                // Clean up old separated objects from state
                                groupItems.forEach((item: any) => removeObject(item.id));
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            } else {
                                toast.error("Sélectionnez plusieurs éléments avec Shift ou la souris pour les grouper.");
                            }
                        }
                        if (action === 'ungroupItems') {
                            const canvas = fabricCanvasRef.current;
                            if (!canvas) return;
                            const active = canvas.getActiveObject();
                            if (active && active.type === 'group') {
                                isUpdatingRef.current = true;
                                const groupId = (active as any).id;
                                const items = (active as any).getObjects();
                                (active as any).toActiveSelection();
                                // Clean up the old group from state
                                if (groupId) removeObject(groupId);
                                // Save the new separated objects to state
                                items.forEach((item: any) => {
                                    if (!item.id) item.id = Math.random().toString(36).substr(2, 9);
                                    updateObject(item.id, item.toObject(['id', 'zIndex']));
                                });
                                isUpdatingRef.current = false;
                                canvas.requestRenderAll();
                            } else {
                                toast.error("Sélectionnez un groupe existant pour le dégrouper.");
                            }
                        }
                        if (action === 'fullScreen') {
                            if (!document.fullscreenElement) {
                                 document.documentElement.requestFullscreen().catch(() => toast.error("Le plein écran est bloqué."));
                            } else {
                                 document.exitFullscreen();
                            }
                        }
                    }} />
                </div>
            )}

            {!isReadOnly && (
                <SlideToolbar
                    isConnected={isConnected}
                    onAddMagicLayout={addMagicLayout}
                    onAddText={addText}
                    onAddShape={() => addShape('rect')}
                    onExport={exportToPNG}
                    onExportPPTX={exportToPPTX}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    onClear={clearSlide}
                    isListening={isListening}
                    onToggleListen={toggleListen}
                    isFormatPainting={isFormatPainting}
                    onToggleFormatPainter={toggleFormatPainter}
                    showGrid={showGrid}
                    snapToGrid={snapToGrid}
                    onToggleGrid={() => setShowGrid(s => !s)}
                    onToggleSnap={() => setSnapToGrid(s => !s)}
                    pageConfig={pageConfig}
                    onPageConfigChange={setPageConfig}
                />
            )}

            {!isReadOnly && (
                <OmniboxMenu
                    isOpen={omniboxMenu.isOpen}
                    x={omniboxMenu.x}
                    y={omniboxMenu.y}
                    onClose={() => setOmniboxMenu({ ...omniboxMenu, isOpen: false })}
                    onInsertText={addText}
                    onInsertShape={addShape}
                    onInsertImage={addImage}
                    onInsertMagicLayout={addMagicLayout}
                    onInsertSmartChip={addSmartChip}
                    onInsertWorkflow={addWorkflow}
                    onInsertTable={addTable}
                />
            )}

            {/* Main Editor Area */}
            <div className="flex flex-col w-full h-full relative animate-fade-in flex-1 min-h-0">


                <div className="flex-1 w-full flex items-stretch min-h-0 relative">
                    {/* Outline Sidebar (Left) */}
                    <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-background dark:bg-[#1a1a1a] hidden md:block z-10">
                        <DocumentOutline canvasRef={fabricCanvasRef} />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-start min-h-0 overflow-hidden relative">
                        <Ruler width={816} />
                        <div className="relative flex-1 w-full overflow-hidden">
                            <SlideCanvas
                                objects={objects}
                                updateObject={updateObject}
                                fabricCanvasRef={fabricCanvasRef}
                                isUpdatingRef={isUpdatingRef}
                                onSelectionChange={setActiveObject}
                                onCursorMove={updateCursor}
                                showGrid={showGrid}
                                snapToGrid={snapToGrid}
                                pageConfig={pageConfig}
                            />
                            <CursorOverlay
                                collaborators={mergedCollaborators}
                                activeSlideId={activeSlideId || "doc"}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Contextual Properties Panel (Right)
                Only show when an object is selected
            */}
            {!isReadOnly && (
                <SlidePropertyPanel
                    activeObject={activeObject}
                    updateObjectRemotely={handleUpdateActiveObject}
                    canvasRef={fabricCanvasRef}
                />
            )}

            {/* Floating AI Bottom Pill */}
            {!isReadOnly && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 shadow-lg rounded-full animate-fade-in-up">
                    <button
                    onClick={addMagicLayout}
                    className="flex items-center gap-2 group px-6 py-2.5 bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full text-[14px] font-medium transition-all shadow-md dark:bg-[#004a77] dark:hover:bg-[#005a92] dark:text-[#c2e7ff]"
                >
                    <Wand2 className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa] group-hover:scale-110 transition-transform" />
                    Améliorer cette diapositive
                </button>
            </div>
            )}

            <GenericFeatureModal 
                isOpen={!!activeModal} 
                actionId={activeModal?.id || null} 
                actionLabel={activeModal?.label}
                onClose={() => setActiveModal(null)} 
            />
        </div>
    )
}
