"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Play, Pause, BookOpen, Plus, Trash2, Upload } from "lucide-react"

interface Chapter {
  id: string
  title: string
  time: number // seconds
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function VideoPlayerWithChapters() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [chapterForm, setChapterForm] = useState({ title: "", time: "" })

  const activeChapter = [...chapters].reverse().find(c => c.time <= currentTime)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const update = () => setCurrentTime(vid.currentTime)
    const onLoaded = () => setDuration(vid.duration)
    const onEnded = () => setPlaying(false)
    vid.addEventListener("timeupdate", update)
    vid.addEventListener("loadedmetadata", onLoaded)
    vid.addEventListener("ended", onEnded)
    return () => { vid.removeEventListener("timeupdate", update); vid.removeEventListener("loadedmetadata", onLoaded); vid.removeEventListener("ended", onEnded) }
  }, [videoUrl])

  const handleFile = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
    setChapters([])
    setCurrentTime(0)
  }

  const togglePlay = () => {
    const vid = videoRef.current
    if (!vid) return
    if (playing) { vid.pause(); setPlaying(false) } else { vid.play(); setPlaying(true) }
  }

  const seekTo = (time: number) => {
    const vid = videoRef.current
    if (!vid) return
    vid.currentTime = time
  }

  const addChapter = () => {
    if (!chapterForm.title.trim()) return
    const time = parseFloat(chapterForm.time) || currentTime
    setChapters(c => [...c, { id: Date.now().toString(), title: chapterForm.title, time }].sort((a, b) => a.time - b.time))
    setChapterForm({ title: "", time: "" })
    setDialogOpen(false)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-purple-500" />
          Video Player with Chapters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!videoUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to load a video file</p>
            <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV…</p>
          </div>
        ) : (
          <div className="space-y-2">
            
            <video ref={videoRef} src={videoUrl} className="w-full rounded-lg bg-black max-h-64" onClick={togglePlay} />

            {/* Progress bar with chapter markers */}
            <div className="relative">
              <div className="relative h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  seekTo(pct * duration)
                }}>
                <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {/* Chapter markers */}
              {duration > 0 && chapters.map(c => (
                <div key={c.id} className="absolute top-0 w-0.5 h-2 bg-yellow-400"
                  style={{ left: `${(c.time / duration) * 100}%` }} title={c.title} />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              {activeChapter && <span className="text-primary font-medium">{activeChapter.title}</span>}
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={togglePlay}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Chapter at {formatTime(currentTime)}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {/* Chapter list */}
        {chapters.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Chapters ({chapters.length})</p>
            {chapters.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-md hover:bg-muted/50 px-2 py-1.5 cursor-pointer group"
                onClick={() => seekTo(c.time)}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-10">{formatTime(c.time)}</span>
                  <span className={`text-sm ${activeChapter?.id === c.id ? "text-primary font-medium" : ""}`}>{c.title}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={e => { e.stopPropagation(); setChapters(chs => chs.filter(x => x.id !== c.id)) }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Add Chapter</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Chapter title *</Label>
              <Input placeholder="e.g. Introduction" value={chapterForm.title} onChange={e => setChapterForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Time (seconds)</Label>
              <Input type="number" min="0" placeholder={currentTime.toFixed(1)} value={chapterForm.time} onChange={e => setChapterForm(f => ({ ...f, time: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Leave empty to use current position ({formatTime(currentTime)})</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={addChapter} disabled={!chapterForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
