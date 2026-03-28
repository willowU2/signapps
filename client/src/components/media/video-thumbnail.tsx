"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Upload, Film, Download, Camera, Loader2 } from "lucide-react"

interface ThumbnailResult {
  url: string
  timestamp: number
  width: number
  height: number
}

export function VideoThumbnailGenerator() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [thumbnail, setThumbnail] = useState<ThumbnailResult | null>(null)
  const [position, setPosition] = useState(25)
  const [extracting, setExtracting] = useState(false)
  const [videoName, setVideoName] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    setThumbnail(null)
    setPosition(25)
  }

  const extractThumbnail = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !duration) return

    setExtracting(true)
    const targetTime = (position / 100) * duration
    video.currentTime = targetTime

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const url = canvas.toDataURL("image/jpeg", 0.92)
        setThumbnail({ url, timestamp: targetTime, width: canvas.width, height: canvas.height })
      }
      setExtracting(false)
    }
    video.addEventListener("seeked", onSeeked)
  }, [position, duration])

  const downloadThumbnail = () => {
    if (!thumbnail) return
    const a = document.createElement("a")
    a.href = thumbnail.url
    const base = videoName.replace(/\.[^.]+$/, "")
    a.download = `${base}_thumb_${Math.round(thumbnail.timestamp)}s.jpg`
    a.click()
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Film className="h-4 w-4 text-rose-500" />
          Video Thumbnail Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!videoUrl ? (
          <div onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <Film className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to load a video</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hidden video + canvas for extraction */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} src={videoUrl} className="hidden"
              onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
              preload="metadata" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Preview */}
            {thumbnail ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail.url} alt="thumbnail" className="w-full rounded-lg border object-cover max-h-48" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{thumbnail.width} × {thumbnail.height}px</span>
                  <span>@ {formatTime(thumbnail.timestamp)}</span>
                </div>
              </div>
            ) : (
              <div className="h-32 bg-muted/50 rounded-lg border flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            )}

            {/* Position slider */}
            {duration > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Position: {position}%</span>
                  <span>{formatTime((position / 100) * duration)} / {formatTime(duration)}</span>
                </div>
                <Slider min={0} max={100} step={1} value={[position]} onValueChange={([v]) => setPosition(v)} />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={extractThumbnail} disabled={extracting || !duration} className="flex-1">
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</> : <><Camera className="h-4 w-4 mr-2" />Extract Frame</>}
              </Button>
              {thumbnail && (
                <Button variant="outline" onClick={downloadThumbnail}>
                  <Download className="h-4 w-4 mr-2" />Save
                </Button>
              )}
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </CardContent>
    </Card>
  )
}
