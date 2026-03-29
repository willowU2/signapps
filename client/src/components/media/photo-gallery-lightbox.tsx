"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, ChevronLeft, ChevronRight, Upload, Grid3X3, ZoomIn } from "lucide-react"

interface GalleryImage {
  id: string
  url: string
  name: string
  size: number
}

export function PhotoGalleryLightbox() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = images.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const addImages = (files: FileList | null) => {
    if (!files) return
    const newImgs: GalleryImage[] = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(f => ({ id: `${f.name}-${Date.now()}`, url: URL.createObjectURL(f), name: f.name, size: f.size }))
    setImages(prev => [...prev, ...newImgs])
  }

  const openLightbox = (idx: number) => setLightboxIdx(idx)
  const closeLightbox = () => setLightboxIdx(null)

  const prev = useCallback(() => {
    setLightboxIdx(i => i !== null ? (i - 1 + filtered.length) % filtered.length : null)
  }, [filtered.length])

  const next = useCallback(() => {
    setLightboxIdx(i => i !== null ? (i + 1) % filtered.length : null)
  }, [filtered.length])

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
      if (e.key === "Escape") closeLightbox()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [lightboxIdx, prev, next])

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setImages(imgs => {
      const img = imgs.find(i => i.id === id)
      if (img) URL.revokeObjectURL(img.url)
      return imgs.filter(i => i.id !== id)
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-blue-500" />
            Photo Gallery
          </CardTitle>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="h-3.5 w-3.5 mr-1" />Upload</span>
            </Button>
          </label>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <label className="cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
              <div className="border-2 border-dashed rounded-xl p-10 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Upload images to get started</p>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              {images.length > 4 && (
                <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-sm" />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {filtered.map((img, idx) => (
                  <div key={img.id} className="relative group aspect-square overflow-hidden rounded-lg border cursor-pointer bg-muted"
                    onClick={() => openLightbox(idx)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <Button size="icon" variant="ghost"
                      className="absolute top-1 right-1 h-6 w-6 bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => remove(img.id, e)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{filtered.length} photo{filtered.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxIdx !== null && filtered[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={closeLightbox}>
            <X className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={e => { e.stopPropagation(); prev() }}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={e => { e.stopPropagation(); next() }}>
            <ChevronRight className="h-6 w-6" />
          </Button>
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={filtered[lightboxIdx].url} alt={filtered[lightboxIdx].name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <div className="text-white/80 text-sm text-center">
              <span>{filtered[lightboxIdx].name}</span>
              <span className="ml-3 text-white/50">{lightboxIdx + 1} / {filtered.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
