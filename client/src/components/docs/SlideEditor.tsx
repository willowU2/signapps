"use client";

import { useYjsDocument } from "@/hooks/use-yjs-document";
import { useState, useEffect } from "react";

interface Slide {
  id: string;
  index: number;
  title: string;
  content: string;
}

interface SlideEditorProps {
  docId: string;
}

export function SlideEditor({ docId }: SlideEditorProps) {
  const { ydoc, isSynced } = useYjsDocument(docId);
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: "1",
      index: 0,
      title: "Slide 1",
      content: "Welcome to your presentation",
    },
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    if (!ydoc) return;

    // Initialize presentation structure
    const slidesArray = ydoc.getArray("slides");

    // Observe changes
    const observer = () => {
      // Rebuild slides from Y.Array
    };

    slidesArray.observe(observer);
    return () => slidesArray.unobserve(observer);
  }, [ydoc]);

  const currentSlide = slides[currentSlideIndex];

  const addSlide = () => {
    if (!ydoc) return;

    const newSlide: Slide = {
      id: Date.now().toString(),
      index: slides.length,
      title: `Slide ${slides.length + 1}`,
      content: "",
    };

    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
  };

  const updateSlideTitle = (title: string) => {
    if (!currentSlide) return;

    const updatedSlides = [...slides];
    updatedSlides[currentSlideIndex] = { ...currentSlide, title };
    setSlides(updatedSlides);
  };

  const updateSlideContent = (content: string) => {
    if (!currentSlide) return;

    const updatedSlides = [...slides];
    updatedSlides[currentSlideIndex] = { ...currentSlide, content };
    setSlides(updatedSlides);
  };

  return (
    <div className="p-6 flex gap-6">
      {/* Slide thumbnails */}
      <div className="w-48 flex flex-col gap-3 bg-muted p-4 rounded-lg">
        <h3 className="font-semibold text-foreground">Slides</h3>
        <div className="flex-1 overflow-y-auto space-y-2">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`p-3 border-2 rounded cursor-pointer transition ${
                currentSlideIndex === idx
                  ? "border-blue-500 bg-blue-50"
                  : "border-border bg-background hover:border-gray-400"
              }`}
            >
              <p className="text-xs font-semibold text-foreground">
                {slide.title}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {slide.content || "(empty)"}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={addSlide}
          className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          + Add Slide
        </button>
      </div>

      {/* Main editor */}
      <div className="flex-1 bg-background rounded-lg border border-border flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-border p-3 flex justify-between items-center bg-muted">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Slide {currentSlideIndex + 1} of {slides.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isSynced ? "bg-green-500" : "bg-yellow-500 animate-pulse"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isSynced ? "Synced" : "Syncing..."}
            </span>
          </div>
        </div>

        {/* Slide preview */}
        <div className="flex-1 overflow-auto p-8">
          {currentSlide && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-12 rounded-lg shadow-lg min-h-96">
              {/* Title */}
              <input
                type="text"
                value={currentSlide.title}
                onChange={(e) => updateSlideTitle(e.target.value)}
                className="w-full text-3xl font-bold text-foreground mb-6 border-0 bg-transparent outline-none"
                placeholder="Slide title"
              />

              {/* Content */}
              <textarea
                value={currentSlide.content}
                onChange={(e) => updateSlideContent(e.target.value)}
                className="w-full text-lg text-muted-foreground border-0 bg-transparent outline-none resize-none"
                placeholder="Add content here..."
                rows={8}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
