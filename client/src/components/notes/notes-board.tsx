'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StickyNote, type StickyNoteData } from './sticky-note';

const colors: Array<'yellow' | 'green' | 'blue' | 'pink'> = ['yellow', 'green', 'blue', 'pink'];

export function NotesBoard() {
  const [notes, setNotes] = useState<StickyNoteData[]>([
    {
      id: '1',
      text: 'Welcome to Sticky Notes!\nClick to edit.',
      color: 'yellow',
    },
  ]);

  const handleAddNote = () => {
    const newNote: StickyNoteData = {
      id: Date.now().toString(),
      text: '',
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setNotes([...notes, newNote]);
  };

  const handleUpdateNote = (id: string, text: string) => {
    setNotes(notes.map((note) => (note.id === id ? { ...note, text } : note)));
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sticky Notes</h1>
          <p className="mt-1 text-sm text-gray-600">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={handleAddNote}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Add Note
        </Button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
          />
        ))}
      </div>

      {/* Empty State */}
      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg text-gray-500">No notes yet. Create one to get started!</p>
        </div>
      )}
    </div>
  );
}
