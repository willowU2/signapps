import { cn } from "@/lib/utils"
import { Trash2, Copy, Save, Download, Plus } from "lucide-react"
import { SlideThumbnail } from "./slide-thumbnail"

import type { SlideLayout } from "./use-slides"

interface SlideData {
    id: string
    title: string
    layout?: SlideLayout
}

interface SlideSidebarProps {
    slides: SlideData[]
    activeSlideId: string | null
    onSelectSlide: (id: string) => void
    onAddSlide: (layout?: SlideLayout) => void
    onRemoveSlide: (id: string) => void
    onDuplicateSlide?: (id: string) => void
    onSaveToDrive?: () => void
    onExportPPTX?: () => void
}

export function SlideSidebar({ slides, activeSlideId, onSelectSlide, onAddSlide, onRemoveSlide, onDuplicateSlide, onSaveToDrive, onExportPPTX }: SlideSidebarProps) {
    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">Slides</h3>
                <div className="flex items-center gap-1">
                    {onSaveToDrive && (
                        <button
                            onClick={onSaveToDrive}
                            className="p-1.5 hover:bg-green-100 rounded-md transition-colors text-gray-500 hover:text-green-600"
                            title="Enregistrer dans le Drive"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                    )}
                    {onExportPPTX && (
                        <button
                            onClick={onExportPPTX}
                            className="p-1.5 hover:bg-blue-100 rounded-md transition-colors text-gray-500 hover:text-blue-600"
                            title="Exporter en PPTX"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}

                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                {slides.map((slide, index) => {
                    const isActive = slide.id === activeSlideId

                    return (
                        <div
                            key={slide.id}
                            onClick={() => onSelectSlide(slide.id)}
                            className="group flex gap-3 relative cursor-pointer"
                        >
                            {/* Slide Number counter */}
                            <div className="text-xs font-semibold text-gray-400 w-4 text-right pt-1 selection:bg-transparent">
                                {index + 1}
                            </div>

                            {/* Thumbnail Container */}
                            <div className={cn(
                                "flex-1 aspect-video bg-background rounded-lg shadow-sm border transition-all relative overflow-hidden flex items-center justify-center text-xs text-muted-foreground",
                                isActive ? "ring-2 ring-indigo-500 border-transparent shadow-md" : "border-gray-200 group-hover:border-indigo-300"
                            )}>
                                <SlideThumbnail slideId={slide.id} presentationId="demo-presentation-1" />

                                {/* Overlay Actions */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    {onDuplicateSlide && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDuplicateSlide(slide.id);
                                            }}
                                            className="p-1.5 bg-background/80 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 rounded-md backdrop-blur-sm shadow-sm transition-colors"
                                            title="Dupliquer la diapositive"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {slides.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveSlide(slide.id);
                                            }}
                                            className="p-1.5 bg-background/80 hover:bg-rose-50 hover:text-rose-600 text-gray-500 rounded-md backdrop-blur-sm shadow-sm transition-colors"
                                            title="Supprimer la diapositive"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {slides.length > 0 && (
                    <div 
                        onClick={() => onAddSlide('title_and_content')}
                        className="group flex gap-3 relative cursor-pointer"
                    >
                        {/* Spacer for numbering alignment */}
                        <div className="w-4" />

                        {/* Add Slide Tile */}
                        <div className="flex-1 aspect-video rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center text-gray-500 hover:text-indigo-600 bg-background/50 group-hover:shadow-sm">
                            <Plus className="w-6 h-6 mb-1 opacity-70 group-hover:opacity-100" />
                            <span className="text-xs font-medium opacity-80 group-hover:opacity-100 mt-1">Nouvelle diapositive</span>
                        </div>
                    </div>
                )}

                {slides.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-center text-sm text-gray-400">
                        <p>Aucune diapositive.</p>
                        <button onClick={() => onAddSlide('title_slide')} className="mt-2 text-indigo-600 font-medium text-xs hover:underline">
                            Cliquez pour en créer une
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
