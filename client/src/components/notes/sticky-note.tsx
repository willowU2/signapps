'use client';

import { useState, useRef } from 'react';
import { Trash2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface StickyNoteData {
  id: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink';
}

interface StickyNoteProps {
  note: StickyNoteData;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

const colorClasses = {
  yellow: 'bg-yellow-100 border-yellow-300',
  green: 'bg-green-100 border-green-300',
  blue: 'bg-blue-100 border-blue-300',
  pink: 'bg-pink-100 border-pink-300',
};

export function StickyNote({ note, onUpdate, onDelete }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(note.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = () => {
    onUpdate(note.id, tempText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempText(note.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className={`${colorClasses[note.color]} relative w-full rounded-lg border-2 p-4 shadow-md transition-shadow hover:shadow-lg`}>
      {/* Drag Handle */}
      <div className="absolute top-2 right-12 cursor-grab active:cursor-grabbing">
        <GripHorizontal className="h-4 w-4 text-gray-400" />
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-200"
        onClick={() => onDelete(note.id)}
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>

      {/* Content */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={tempText}
            onChange={(e) => setTempText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[120px] w-full resize-none rounded border-0 bg-white/50 p-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-gray-400"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs bg-gray-700 hover:bg-gray-800"
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="min-h-[120px] cursor-text whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800"
        >
          {tempText || <span className="text-gray-400 italic">Click to add text...</span>}
        </div>
      )}
    </div>
  );
}
