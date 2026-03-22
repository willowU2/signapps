'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AmbientSound {
  id: string;
  name: string;
  description: string;
}

export function AmbientSounds() {
  const [sounds] = useState<AmbientSound[]>([
    { id: '1', name: 'Rain', description: 'Gentle rain sounds' },
    { id: '2', name: 'Forest', description: 'Natural forest ambience' },
    { id: '3', name: 'Cafe', description: 'Coffee shop background' },
    { id: '4', name: 'White Noise', description: 'Brown noise for focus' },
  ]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  const handlePlayClick = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  const handleVolumeChange = (id: string, value: number) => {
    setVolumes((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Ambient Sounds</h2>
      </div>

      {/* Sounds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sounds.map((sound) => (
          <div
            key={sound.id}
            className={cn(
              'p-4 border border-input rounded-lg transition-all',
              playingId === sound.id
                ? 'bg-primary/10 border-primary'
                : 'bg-muted/50 hover:bg-muted/70'
            )}
          >
            {/* Sound Title */}
            <h3 className="font-semibold text-foreground text-sm mb-1">
              {sound.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {sound.description}
            </p>

            {/* Play Button */}
            <div className="flex items-center gap-2 mb-3">
              <Button
                onClick={() => handlePlayClick(sound.id)}
                size="sm"
                variant="outline"
                className={cn(
                  'flex-shrink-0',
                  playingId === sound.id && 'bg-primary text-primary-foreground border-primary'
                )}
                aria-label={
                  playingId === sound.id
                    ? `Pause ${sound.name}`
                    : `Play ${sound.name}`
                }
              >
                {playingId === sound.id ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {playingId === sound.id ? 'Playing' : 'Ready'}
              </span>
            </div>

            {/* Volume Slider */}
            {playingId === sound.id && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Volume: {Math.round((volumes[sound.id] || 50))}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumes[sound.id] || 50}
                  onChange={(e) =>
                    handleVolumeChange(sound.id, parseInt(e.target.value))
                  }
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  aria-label={`Volume for ${sound.name}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-md">
        Use ambient sounds to improve focus and productivity
      </div>
    </div>
  );
}
