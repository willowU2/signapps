"use client"

import { SlideEditor } from "./slide-editor"
import { SlideSidebar } from "./slide-sidebar"
import { useSlides } from "./use-slides"

export function SlidesContent() {
    const slideState = useSlides("demo-presentation-1")
    const activeSlide = slideState.slides.find(s => s.id === slideState.activeSlideId)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Toolbar / Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 w-fit cursor-text">
                        {activeSlide?.title || "Untitled Presentation"}
                    </h1>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                        <span className="hover:text-black cursor-pointer">File</span>
                        <span className="hover:text-black cursor-pointer">Edit</span>
                        <span className="hover:text-black cursor-pointer">View</span>
                        <span className="hover:text-black cursor-pointer">Insert</span>
                        <span className="hover:text-black cursor-pointer">Format</span>
                        <span className="hover:text-black cursor-pointer">Slide</span>
                        <span className="hover:text-black cursor-pointer">Arrange</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors">
                        Slideshow
                    </button>
                    <button className="bg-indigo-600 text-white px-5 py-1.5 rounded-full text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors">
                        Share
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden bg-gray-50/50">
                {/* Sidebar (Slides List) */}
                <div className="w-48 border-r border-gray-200 bg-white/50 z-20">
                    <SlideSidebar
                        slides={slideState.slides}
                        activeSlideId={slideState.activeSlideId}
                        onSelectSlide={slideState.setActiveSlideId}
                        onAddSlide={slideState.addSlide}
                        onRemoveSlide={slideState.removeSlide}
                    />
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 min-w-0">
                    {slideState.activeSlideId ? (
                        <SlideEditor slideState={slideState} />
                    ) : (
                        <div className="text-gray-400 text-sm">Create a slide to start editing</div>
                    )}
                </div>
            </div>
        </div>
    )
}
