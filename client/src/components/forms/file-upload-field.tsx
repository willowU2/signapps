"use client"
import { useRef, useState } from "react"
import { Upload, File, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  fieldId: string
  required?: boolean
  onChange: (fieldId: string, value: File | null) => void
}

export function FileUploadField({ fieldId, required, onChange }: Props) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File) => {
    setFile(f)
    onChange(fieldId, f)
  }

  const clear = () => {
    setFile(null)
    onChange(fieldId, null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) accept(f)
      }}
      onClick={() => !file && inputRef.current?.click()}
      className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5 cursor-copy"
          : file
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border hover:border-primary/50 cursor-pointer"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) accept(f)
        }}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <File className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium truncate max-w-56">{file.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            ({(file.size / 1024).toFixed(0)} Ko)
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={e => { e.stopPropagation(); clear() }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Glissez un fichier ici ou <span className="text-primary underline">parcourez</span>
          </p>
          <p className="text-xs text-muted-foreground">Tous types de fichiers acceptés</p>
        </div>
      )}
    </div>
  )
}
