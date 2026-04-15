"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SmartDictation() {
  const [text, setText] = useState("");
  const [isRecording, isRecordingState] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDictateClick = () => {
    isRecordingState(!isRecording);
    if (!isRecording) {
      // Simulate recording
      setTimeout(() => {
        const newText =
          "This is a voice dictated text. Add more content as needed.";
        setText((prev) => (prev ? prev + " " + newText : newText));
        isRecordingState(false);
      }, 2500);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Smart Dictation</h2>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start dictating or type here..."
        className={cn(
          "w-full h-48 p-4 border border-input rounded-md bg-background text-foreground",
          "resize-none focus:outline-none focus:ring-2 focus:ring-primary",
          "placeholder:text-muted-foreground",
        )}
        aria-label="Dictation textarea"
      />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Dictate Button */}
        <Button
          onClick={handleDictateClick}
          variant={isRecording ? "destructive" : "default"}
          className={cn(
            "transition-all duration-300",
            isRecording && "animate-pulse",
          )}
          aria-label={isRecording ? "Stop recording" : "Start dictation"}
        >
          <Mic className="h-4 w-4 mr-2" />
          {isRecording ? "Recording..." : "Dictate"}
        </Button>

        {/* Copy Button */}
        <Button
          onClick={handleCopyText}
          variant="outline"
          disabled={!text}
          aria-label="Copy text"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-100" />
            <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-200" />
          </div>
          <span>Recording your voice...</span>
        </div>
      )}

      {/* Character Count */}
      <div className="text-xs text-muted-foreground text-right">
        {text.length} characters
      </div>
    </div>
  );
}
