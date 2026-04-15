"use client";

import { useState, useRef, type DragEvent, type ReactNode } from "react";

interface DropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: string;
  children?: ReactNode;
  className?: string;
}

export function DropZone({
  onDrop,
  accept,
  children,
  className = "",
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    counter.current++;
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    counter.current--;
    if (counter.current === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    counter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (accept) {
      const exts = accept.split(",").map((a) => a.trim().toLowerCase());
      const filtered = files.filter((f) =>
        exts.some(
          (ext) =>
            f.name.toLowerCase().endsWith(ext) ||
            f.type.includes(ext.replace(".", "")),
        ),
      );
      onDrop(filtered);
    } else {
      onDrop(files);
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5 text-primary"
          : "border-muted-foreground/25 text-muted-foreground"
      } ${className}`}
    >
      {children || (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {dragging ? "Deposez ici" : "Glissez des fichiers ici"}
          </p>
          <p className="text-xs">ou cliquez pour selectionner</p>
        </div>
      )}
    </div>
  );
}
