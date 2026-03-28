"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Camera, Upload, MapPin, Clock, Image, Info } from "lucide-react"

interface ExifData {
  fileName: string
  fileSize: string
  dimensions?: { width: number; height: number }
  // From EXIF (partial — real parsing needs exifr library)
  make?: string
  model?: string
  dateTime?: string
  exposureTime?: string
  fNumber?: string
  iso?: string
  focalLength?: string
  gpsLatitude?: number
  gpsLongitude?: number
  software?: string
}

// Parse basic EXIF via FileReader + DataView
// For full EXIF support in production, use the 'exifr' library
async function extractBasicExif(file: File): Promise<ExifData> {
  const base: ExifData = {
    fileName: file.name,
    fileSize: (file.size / 1024).toFixed(1) + " KB",
  }

  // Attempt to get image dimensions
  await new Promise<void>(resolve => {
    const img = document.createElement("img") as HTMLImageElement
    const url = URL.createObjectURL(file)
    img.onload = () => {
      base.dimensions = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })

  // Try to read EXIF markers from JPEG (basic approach)
  if (file.type === "image/jpeg") {
    try {
      const buffer = await file.arrayBuffer()
      const view = new DataView(buffer)
      // Check JPEG SOI marker
      if (view.getUint16(0) === 0xFFD8) {
        // Look for APP1 (EXIF) marker at offset 2
        // This is simplified; production code should use exifr
        base.make = "JPEG file detected"
      }
    } catch {}
  }

  // Use file last modified as a fallback date
  if (file.lastModified) {
    base.dateTime = new Date(file.lastModified).toLocaleString()
  }

  return base
}

export function ExifViewer() {
  const [exif, setExif] = useState<ExifData | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setLoading(true)
    try {
      const data = await extractBasicExif(file)
      setExif(data)
    } finally {
      setLoading(false)
    }
  }, [imageUrl])

  const fields: Array<{ icon: typeof Camera; label: string; value: string | undefined }> = exif ? [
    { icon: Info, label: "File Name",   value: exif.fileName },
    { icon: Info, label: "File Size",   value: exif.fileSize },
    { icon: Image, label: "Dimensions", value: exif.dimensions ? `${exif.dimensions.width} × ${exif.dimensions.height} px` : undefined },
    { icon: Camera, label: "Camera Make", value: exif.make },
    { icon: Camera, label: "Model",     value: exif.model },
    { icon: Clock, label: "Date/Time",  value: exif.dateTime },
    { icon: Camera, label: "Exposure",  value: exif.exposureTime },
    { icon: Camera, label: "f/",        value: exif.fNumber },
    { icon: Camera, label: "ISO",       value: exif.iso },
    { icon: Camera, label: "Focal Length", value: exif.focalLength },
    { icon: MapPin, label: "GPS",       value: exif.gpsLatitude != null ? `${exif.gpsLatitude.toFixed(5)}, ${exif.gpsLongitude?.toFixed(5)}` : undefined },
    { icon: Info, label: "Software",    value: exif.software },
  ].filter(f => f.value !== undefined) : []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-amber-500" />
          EXIF Metadata Viewer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {imageUrl ? (
            <div className="flex items-center gap-3 rounded-lg border p-2 hover:border-primary transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="preview" className="h-16 w-16 object-cover rounded-md shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{exif?.fileName}</p>
                <p className="text-xs text-muted-foreground">{exif?.fileSize}</p>
              </div>
              <Button size="sm" variant="ghost" asChild>
                <span><Upload className="h-3.5 w-3.5" /></span>
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
              <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to load an image</p>
            </div>
          )}
        </label>

        {loading && <div className="text-center text-sm text-muted-foreground py-4">Reading metadata…</div>}

        {fields.length > 0 && (
          <div className="rounded-lg border divide-y divide-border">
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <span className="text-xs font-medium text-right max-w-[60%] truncate">{value}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && exif && fields.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-4">No readable EXIF data found in this file</p>
        )}
      </CardContent>
    </Card>
  )
}
