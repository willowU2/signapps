import { cn } from "@/lib/utils"
import { Plus, Trash2 } from "lucide-react"
import { SlideThumbnail } from "./slide-thumbnail"

interface SlideData {
    id: string
    title: string
}

interface SlideSidebarProps {
    slides: SlideData[]
    activeSlideId: string | null
    onSelectSlide: (id: string) => void
    onAddSlide: () => void
    onRemoveSlide: (id: string) => void
}

export function SlideSidebar({ slides, activeSlideId, onSelectSlide, onAddSlide, onRemoveSlide }: SlideSidebarProps) {
    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">Slides</h3>
                <button
                    onClick={onAddSlide}
                    className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500 hover:text-gray-900"
                    title="New Slide"
                >
                    <Plus className="w-4 h-4" />
                </button>
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
                                "flex-1 aspect-video bg-white rounded-lg shadow-sm border transition-all relative overflow-hidden flex items-center justify-center text-xs text-muted-foreground",
                                isActive ? "ring-2 ring-indigo-500 border-transparent shadow-md" : "border-gray-200 group-hover:border-indigo-300"
                            )}>
                                <SlideThumbnail slideId={slide.id} presentationId="demo-presentation-1" />

                                {/* Overlay Actions */}
                                {slides.length > 1 && (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveSlide(slide.id);
                                            }}
                                            className="p-1.5 bg-white/80 hover:bg-rose-50 hover:text-rose-600 text-gray-500 rounded-md backdrop-blur-sm shadow-sm transition-colors"
                                            title="Delete Slide"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                {slides.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-center text-sm text-gray-400">
                        <p>No slides found.</p>
                        <button onClick={onAddSlide} className="mt-2 text-indigo-600 font-medium text-xs hover:underline">Click to create one</button>
                    </div>
                )}
            </div>
        </div>
    )
}
