"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Photo {
  id: string;
  title: string;
  date: string;
  color: string;
}

interface MediaGalleryProps {
  albumTitle: string;
  photos?: Photo[];
  photoCount?: number;
  date?: string;
  onUpload?: () => void;
}

export function MediaGallery({
  albumTitle,
  photos = [
    { id: "1", title: "Photo 1", date: "2026-03-20", color: "bg-blue-400" },
    { id: "2", title: "Photo 2", date: "2026-03-20", color: "bg-purple-400" },
    { id: "3", title: "Photo 3", date: "2026-03-20", color: "bg-pink-400" },
    { id: "4", title: "Photo 4", date: "2026-03-20", color: "bg-green-400" },
    { id: "5", title: "Photo 5", date: "2026-03-20", color: "bg-yellow-400" },
    { id: "6", title: "Photo 6", date: "2026-03-20", color: "bg-red-400" },
  ],
  photoCount = 6,
  date = "2026-03-20",
  onUpload,
}: MediaGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const goToPrevious = () => {
    setCurrentPhotoIndex(
      (prev) => (prev - 1 + photos.length) % photos.length
    );
  };

  const goToNext = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{albumTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {photoCount} photos · {date}
          </p>
        </div>
        <Button
          onClick={onUpload}
          className="flex items-center gap-2"
          variant="outline"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            onClick={() => openLightbox(index)}
            className={`aspect-square cursor-pointer rounded-lg ${photo.color} transition-transform hover:scale-105`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                openLightbox(index);
              }
            }}
          />
        ))}
      </div>

      {/* Lightbox Overlay */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-card p-2 text-foreground hover:bg-gray-200"
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Photo Display */}
          <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center">
            <div
              className={`aspect-square w-full max-w-2xl rounded-lg ${photos[currentPhotoIndex].color}`}
            />
          </div>

          {/* Previous Arrow */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 transform rounded-full bg-card p-2 text-foreground hover:bg-gray-200"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Next Arrow */}
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 transform rounded-full bg-card p-2 text-foreground hover:bg-gray-200"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Photo Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black bg-opacity-50 px-4 py-2 text-white">
            {currentPhotoIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
