'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Plus, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CustomEmoji {
  id: string;
  name: string;
  data: string; // base64 image
}

interface EmojiPickerCustomProps {
  onSelect: (emoji: string | CustomEmoji) => void;
  customEmojis?: CustomEmoji[];
  onCustomEmojiAdd?: (emoji: CustomEmoji) => void;
}

const STANDARD_EMOJIS = [
  // Smileys & Emotions
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '😇', '🙂', '🙃', '😉', '😊', '😌', '😍', '🥰',
  '😘', '😗', '😚', '😙', '😜', '🤪', '😛', '😜',
  // Hand Gestures
  '👍', '👎', '👏', '🙌', '👐', '🤝', '✋', '✌️',
  '🤟', '🤘', '👊', '✊', '👋', '🖐️', '🖖', '👌',
  // Popular
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🎉', '🎊',
  '🎈', '🎁', '⭐', '✨', '🔥', '💯', '🚀', '👻',
];

export function EmojiPickerCustom({
  onSelect,
  customEmojis = [],
  onCustomEmojiAdd,
}: EmojiPickerCustomProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadName, setUploadName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    }
  };

  const handleUploadEmoji = () => {
    if (!selectedFile || !uploadName.trim()) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const customEmoji: CustomEmoji = {
        id: `custom-${Date.now()}`,
        name: uploadName.trim(),
        data: e.target?.result as string,
      };
      onCustomEmojiAdd?.(customEmoji);
      setUploadName('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSelectEmoji = (emoji: string | CustomEmoji) => {
    onSelect(emoji);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Filter standard emojis by search
  const filteredStandard = STANDARD_EMOJIS.filter((emoji) => {
    if (!searchTerm) return true;
    // Simple emoji search by character or description
    return emoji.includes(searchTerm);
  });

  // Filter custom emojis by name
  const filteredCustom = customEmojis.filter((emoji) =>
    emoji.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Add emoji reaction"
        >
          😊
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-semibold">Emoji Reactions</h3>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Emoji Grid */}
          <div className="max-h-64 overflow-y-auto space-y-3">
            {/* Standard Emojis */}
            {filteredStandard.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Standard</p>
                <div className="grid grid-cols-8 gap-1">
                  {filteredStandard.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectEmoji(emoji)}
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg',
                        'hover:scale-110 cursor-pointer'
                      )}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Emojis */}
            {filteredCustom.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Custom</p>
                <div className="grid grid-cols-8 gap-1">
                  {filteredCustom.map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => handleSelectEmoji(emoji)}
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors',
                        'hover:scale-110 cursor-pointer'
                      )}
                      title={emoji.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={emoji.data}
                        alt={emoji.name}
                        className="h-6 w-6 object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredStandard.length === 0 && filteredCustom.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No emojis found</p>
            )}
          </div>

          {/* Upload Section */}
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Add Custom Emoji</p>
            <div className="flex gap-1.5 items-end">
              <div className="flex-1 space-y-1">
                <Input
                  type="text"
                  placeholder="Emoji name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="h-7 text-xs"
                  disabled={!selectedFile}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {selectedFile ? selectedFile.name.slice(0, 10) : 'Upload'}
                </Button>
              </div>
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleUploadEmoji}
                disabled={!selectedFile || !uploadName.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
