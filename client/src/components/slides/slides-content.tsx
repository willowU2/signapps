"use client"

import { SlideSidebar } from "./slide-sidebar"
import { useSlides, SlideData } from "./use-slides"
import { useState, useRef, useEffect, useCallback } from "react"
import { SlideEditor } from "./slide-editor"
import { SlidesFileFormat } from "@/lib/file-parsers"
import { storageApi } from "@/lib/api"
import { toast } from "sonner"
import pptxgen from "pptxgenjs"

interface SlidesContentProps {
    documentId?: string
    documentName?: string
    initialData?: SlidesFileFormat
}

export function SlidesContent({ documentId, documentName, initialData }: SlidesContentProps) {
    const slideState = useSlides(documentId || "demo-presentation-1")
    const activeSlide = slideState.slides.find(s => s.id === slideState.activeSlideId)

    const [localTitle, setLocalTitle] = useState(activeSlide?.title || "Présentation sans titre")
    const [isInitialized, setIsInitialized] = useState(false)

    useEffect(() => {
        if (activeSlide?.title) setLocalTitle(activeSlide.title)
    }, [activeSlide?.title])

    // Load initial data from S3 if provided
    useEffect(() => {
        if (initialData && !isInitialized && slideState.isConnecté) {
            loadInitialData(initialData)
            setIsInitialized(true)
        }
    }, [initialData, isInitialized, slideState.isConnecté])

    const loadInitialData = async (data: SlidesFileFormat) => {
        // Clear existing slides first (except if there's only the default slide)
        if (slideState.slides.length > 0) {
            // We'll replace content rather than clearing everything
        }

        // Load slides from the file data
        data.slides.forEach((slideData, index) => {
            if (index === 0 && slideState.slides.length > 0) {
                // Update first slide instead of adding
                const slideId = slideState.slides[0].id
                slideState.setActiveSlideId(slideId)
                // Load objects for this slide
                slideData.objects.forEach(obj => {
                    slideState.updateObject(obj.id, obj)
                })
                // Load speaker notes if present
                if (slideData.notes) {
                    slideState.updateSlideNotes(slideId, slideData.notes)
                }
            } else {
                // Add new slide
                slideState.addSlide()
                // Objects and notes will be loaded when slide becomes active
            }
        })

        toast.success("Présentation chargée depuis le Drive")
    }

    // Save to S3 Drive
    const saveToDrive = useCallback(async () => {
        if (!documentName) {
            toast.error("Impossible d'enregistrer: Le nom du fichier est manquant.")
            return
        }

        const tId = toast.loading("Enregistrement dans le Drive...")

        try {
            // Get all slides with their objects
            const allSlidesData = slideState.getAllSlidesWithObjects()

            // Build the slides file format
            const slidesData: SlidesFileFormat = {
                version: 1,
                slides: allSlidesData.map(slide => ({
                    id: slide.id,
                    title: slide.title,
                    objects: Object.entries(slide.objects)
                        .filter(([_, obj]) => obj)
                        .map(([id, obj]) => ({ id, ...obj })),
                    notes: slide.notes || undefined, // Include speaker notes
                })),
                metadata: {
                    updatedAt: new Date().toISOString(),
                }
            }

            // Create blob and save
            const jsonStr = JSON.stringify(slidesData, null, 2)
            const blob = new Blob([jsonStr], { type: 'application/json' })

            // Use targetKey UUID as filename instead of documentName
            const targetKey = documentId && documentId !== 'new-presentation' ? `${documentId}.signslides` : documentName.replace(/\.[^/.]+$/, '') + '.signslides';

            await storageApi.uploadWithKey('drive', targetKey, blob)

            toast.success("Présentation enregistrée !", { id: tId })
        } catch (err: any) {
            console.error("Erreur enregistrement slides", err)
            toast.error("Erreur d'enregistrement: " + err.message, { id: tId })
        }
    }, [documentName, slideState])

    // Export to PPTX (multi-slide support)
    const exportToPPTX = useCallback(() => {
        const pres = new pptxgen()
        pres.title = documentName || "Presentation"
        pres.author = "SignApps Platform"

        // Get presentation theme for colors
        const theme = slideState.presentationTheme
        const bgColor = theme?.backgroundColor?.replace('#', '') || 'FFFFFF'
        const primaryColor = theme?.primaryColor?.replace('#', '') || '1e293b'
        const textColor = theme?.textColor?.replace('#', '') || '334155'
        const accentColor = theme?.accentColor?.replace('#', '') || '3b82f6'
        const defaultFont = theme?.headingFont || 'Arial'

        // Get all slides with their objects
        const allSlidesData = slideState.getAllSlidesWithObjects()

        // Iterate through all slides
        allSlidesData.forEach((slideData) => {
            const pptxSlide = pres.addSlide()

            // Apply theme background color
            pptxSlide.background = { color: bgColor }

            // Add speaker notes if present
            if (slideData.notes) {
                pptxSlide.addNotes(slideData.notes)
            }

            // Get objects for this slide
            const slideObjects = slideData.objects
            const hasObjects = Object.keys(slideObjects).length > 0

            if (hasObjects) {
                Object.entries(slideObjects).forEach(([id, obj]) => {
                    if (!obj) return

                    const o = obj as any
                    const scaleX = o.scaleX || 1
                    const scaleY = o.scaleY || 1
                    const x = (o.left || 0) / 100
                    const y = (o.top || 0) / 100
                    const w = Math.max(0.5, (o.width || 0) * scaleX / 100)
                    const h = Math.max(0.5, (o.height || 0) * scaleY / 100)

                    if (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text') {
                        // Use theme text color as fallback
                        const objColor = o.fill?.replace('#', '') || textColor
                        pptxSlide.addText(o.text || '', {
                            x, y, w, h,
                            fontSize: (o.fontSize || 18) * scaleY,
                            color: objColor,
                            fontFace: o.fontFamily || defaultFont,
                            bold: o.fontWeight === 'bold',
                            italic: o.fontStyle === 'italic',
                        })
                    } else if (o.type === 'rect') {
                        // Use theme accent color as fallback
                        const fillColor = o.fill?.replace('#', '') || accentColor
                        pptxSlide.addShape(pres.ShapeType.rect, {
                            x, y, w, h,
                            fill: { color: fillColor }
                        })
                    } else if (o.type === 'circle') {
                        const fillColor = o.fill?.replace('#', '') || accentColor
                        pptxSlide.addShape(pres.ShapeType.ellipse, {
                            x, y, w, h,
                            fill: { color: fillColor }
                        })
                    } else if (o.type === 'triangle') {
                        const fillColor = o.fill?.replace('#', '') || accentColor
                        pptxSlide.addShape(pres.ShapeType.triangle, {
                            x, y, w, h,
                            fill: { color: fillColor }
                        })
                    } else if (o.type === 'line') {
                        // Lines use x1,y1,x2,y2 in pptxgen
                        const strokeColor = o.stroke?.replace('#', '') || primaryColor
                        pptxSlide.addShape(pres.ShapeType.line, {
                            x, y, w, h,
                            line: { color: strokeColor, width: o.strokeWidth || 1 }
                        })
                    } else if (o.type === 'image' && o.src) {
                        try {
                            pptxSlide.addImage({
                                data: o.src,
                                x, y, w, h
                            })
                        } catch (err) {
                            console.debug("Could not export image to PPTX", err)
                        }
                    }
                })
            } else {
                // Empty slide - add title using theme colors
                pptxSlide.addText(slideData.title || `Slide`, {
                    x: 0.5,
                    y: 0.5,
                    fontSize: 24,
                    color: primaryColor,
                    fontFace: defaultFont
                })
            }
        })

        const fileName = documentName
            ? documentName.replace(/\.[^/.]+$/, '.pptx')
            : `Presentation-Export-${new Date().toISOString().slice(0, 10)}.pptx`

        pres.writeFile({ fileName })
        toast.success(`Présentation exportée (${allSlidesData.length} diapositives)`)
    }, [slideState, documentName])

    // Keyboard shortcuts for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (documentName) {
                    saveToDrive()
                } else {
                    toast.success('Enregistré automatiquement')
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [saveToDrive, documentName])

    // Listen for slide actions from editor menu
    useEffect(() => {
        const handleAddSlide = () => slideState.addSlide()
        const handleDuplicateSlide = () => {
            if (slideState.activeSlideId) {
                slideState.duplicateSlide(slideState.activeSlideId)
            }
        }
        const handleDeleteSlide = () => {
            if (slideState.activeSlideId) {
                slideState.removeSlide(slideState.activeSlideId)
            }
        }

        window.addEventListener('slides:addSlide', handleAddSlide)
        window.addEventListener('slides:duplicateSlide', handleDuplicateSlide)
        window.addEventListener('slides:deleteSlide', handleDeleteSlide)

        return () => {
            window.removeEventListener('slides:addSlide', handleAddSlide)
            window.removeEventListener('slides:duplicateSlide', handleDuplicateSlide)
            window.removeEventListener('slides:deleteSlide', handleDeleteSlide)
        }
    }, [slideState])

    return (
        <div className="flex flex-col h-full overflow-hidden font-sans bg-[#f8f9fa] dark:bg-[#1f1f1f] min-h-0 relative">
            <div className="flex flex-1 overflow-hidden relative min-h-0">
                {/* Sidebar (Slides List) */}
                <div className="w-48 border-r border-gray-200 bg-background/50 z-20">
                    <SlideSidebar
                        slides={slideState.slides}
                        activeSlideId={slideState.activeSlideId}
                        onSelectSlide={slideState.setActiveSlideId}
                        onAddSlide={slideState.addSlide}
                        onRemoveSlide={slideState.removeSlide}
                        onDuplicateSlide={slideState.duplicateSlide}
                        onSaveToDrive={documentName ? saveToDrive : undefined}
                        onExportPPTX={exportToPPTX}
                    />
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 min-w-0">
                    {slideState.activeSlideId ? (
                        <SlideEditor slideState={{
                            ...slideState,
                            slides: slideState.slides,
                            getSlideObjects: slideState.getSlideObjects,
                            getAllSlidesWithObjects: slideState.getAllSlidesWithObjects,
                        }} />
                    ) : (
                        <div className="text-gray-400 text-sm">Créez une diapositive pour commencer</div>
                    )}
                </div>
            </div>
        </div>
    )
}
