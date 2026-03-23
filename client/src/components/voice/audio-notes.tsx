'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Play, Trash2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioNote {
  id: string;
  title: string;
  duration: string;
  date: string;
  recording: boolean;
}

export function AudioNotes() {
  const [notes, setNotes] = useState<AudioNote[]>([
    {
      id: '1',
      title: 'Project kickoff notes',
      duration: '5:23',
      date: '2026-03-22',
      recording: false,
    },
    {
      id: '2',
      title: 'Client feedback summary',
      duration: '3:47',
      date: '2026-03-21',
      recording: false,
    },
    {
      id: '3',
      title: 'Architecture discussion',
      duration: '8:15',
      date: '2026-03-20',
      recording: false,
    },
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handleRecordClick = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        const newNote: AudioNote = {
          id: Date.now().toString(),
          title: 'New audio note',
          duration: '0:45',
          date: new Date().toISOString().split('T')[0],
          recording: false,
        };
        setNotes((prev) => [newNote, ...prev]);
        setIsRecording(false);
      }, 2000);
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const handlePlayClick = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      {/* Header */}
      <h2 className="text-lg font-semibold text-foreground">Audio Notes</h2>

      {/* Record Button */}
      <Button
        onClick={handleRecordClick}
        variant={isRecording ? 'destructive' : 'default'}
        className={cn('w-full transition-all', isRecording && 'animate-pulse')}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <Mic className="h-4 w-4 mr-2" />
        {isRecording ? 'Recording...' : 'Record New Note'}
      </Button>

      {/* Notes List */}
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="p-4 bg-muted/50 border border-input rounded-md hover:bg-muted/70 transition-colors space-y-2"
          >
            {/* Note Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground text-sm">{note.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {note.duration} • {note.date}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => handlePlayClick(note.id)}
                size="sm"
                variant="outline"
                className={cn(
                  playingId === note.id && 'bg-primary/10 border-primary'
                )}
                aria-label={`Play note: ${note.title}`}
              >
                <Play className="h-4 w-4 mr-1" />
                {playingId === note.id ? 'Playing' : 'Play'}
              </Button>

              <Button
                onClick={() => {}}
                size="sm"
                variant="outline"
                aria-label="Attach to task"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                onClick={() => handleDeleteNote(note.id)}
                size="sm"
                variant="ghost"
                className="hover:bg-destructive/10 hover:text-destructive ml-auto"
                aria-label={`Delete note: ${note.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {notes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No audio notes yet. Start recording!</p>
        </div>
      )}
    </div>
  );
}
