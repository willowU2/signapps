"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Upload, RotateCcw, RotateCw, Crop, Download, Type, ImageIcon, RefreshCw } from "lucide-react"

interface EditState {
  brightness: number
  contrast: number
  saturation: number
  rotation: number
  grayscale: boolean
  overlayText: string
}

const DEFAULT_STATE: EditState = { brightness: 100, contrast: 100, saturation: 100, rotation: 0, grayscale: false, overlayText: "" }

export function ImageEditor() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [state, setState] = useState<EditState>(DEFAULT_STATE)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const applyEdits = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageRef.current) return
    const img = imageRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rad = (state.rotation * Math.PI) / 180
    const absRad = Math.abs(rad)
    const w = img.naturalWidth, h = img.naturalHeight
    const newW = Math.abs(w * Math.cos(absRad)) + Math.abs(h * Math.sin(absRad))
    const newH = Math.abs(w * Math.sin(absRad)) + Math.abs(h * Math.cos(absRad))
    canvas.width = newW
    canvas.height = newH

    ctx.save()
    ctx.translate(newW / 2, newH / 2)
    ctx.rotate(rad)
    ctx.filter = [
      `brightness(${state.brightness}%)`,
      `contrast(${state.contrast}%)`,
      `saturate(${state.saturation}%)`,
      state.grayscale ? "grayscale(1)" : "",
    ].filter(Boolean).join(" ")
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()

    if (state.overlayText) {
      ctx.font = `bold ${Math.max(20, newW * 0.05)}px sans-serif`
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.strokeStyle = "rgba(0,0,0,0.5)"
      ctx.lineWidth = 3
      ctx.strokeText(state.overlayText, 16, newH - 16)
      ctx.fillText(state.overlayText, 16, newH - 16)
    }
  }, [state])

  useEffect(() => { applyEdits() }, [applyEdits])

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setState(DEFAULT_STATE)
    const img = new Image()
    img.onload = () => { imageRef.current = img; applyEdits() }
    img.src = url
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "edited-image.png"
    a.click()
  }

  const rotate = (dir: 1 | -1) => setState(s => ({ ...s, rotation: (s.rotation + dir * 90 + 360) % 360 }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-pink-500" />
          Image Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!imageUrl ? (
          <div onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to load an image</p>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="w-full rounded-lg border max-h-64 object-contain" style={{ display: "block" }} />

            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Brightness", key: "brightness" as const, min: 0, max: 200 },
                { label: "Contrast",   key: "contrast"   as const, min: 0, max: 200 },
                { label: "Saturation", key: "saturation" as const, min: 0, max: 200 },
              ].map(({ label, key, min, max }) => (
                <div key={key} className="flex items-center gap-3">
                  <Label className="w-24 text-xs shrink-0">{label} {state[key]}%</Label>
                  <Slider min={min} max={max} step={1} value={[state[key]]}
                    onValueChange={([v]) => setState(s => ({ ...s, [key]: v }))} className="flex-1" />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => rotate(-1)}><RotateCcw className="h-3.5 w-3.5 mr-1" />-90°</Button>
              <Button size="sm" variant="outline" onClick={() => rotate(1)}><RotateCw className="h-3.5 w-3.5 mr-1" />+90°</Button>
              <Button size="sm" variant={state.grayscale ? "default" : "outline"} onClick={() => setState(s => ({ ...s, grayscale: !s.grayscale }))}>
                Grayscale
              </Button>
              <Button size="sm" variant="outline" onClick={() => setState(DEFAULT_STATE)}><RefreshCw className="h-3.5 w-3.5 mr-1" />Reset</Button>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Change</Button>
            </div>

            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input placeholder="Text overlay…" value={state.overlayText} onChange={e => setState(s => ({ ...s, overlayText: e.target.value }))} className="h-8 text-sm" />
            </div>

            <Button className="w-full" variant="outline" onClick={download}>
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
          </>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </CardContent>
    </Card>
  )
}
