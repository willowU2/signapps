'use client';

import { useState } from 'react';
import { Volume2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  name: string;
  acousticsScore: number;
  noiseLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export function RoomAcoustics() {
  const [rooms] = useState<Room[]>([
    {
      id: '1',
      name: 'Conference Room A',
      acousticsScore: 5,
      noiseLevel: 'low',
      recommendation: 'Excellent for calls',
    },
    {
      id: '2',
      name: 'Open Office Area',
      acousticsScore: 2,
      noiseLevel: 'high',
      recommendation: 'Use noise cancellation',
    },
    {
      id: '3',
      name: 'Quiet Work Room',
      acousticsScore: 4,
      noiseLevel: 'low',
      recommendation: 'Ideal for focused work',
    },
  ]);

  const getNoiseLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200';
      case 'high':
        return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const renderScore = (score: number) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 w-2 rounded-full',
              i < score ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Room Acoustics</h2>

      <div className="space-y-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="p-4 bg-muted/50 border border-input rounded-md space-y-2"
          >
            {/* Room Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">{room.name}</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    getNoiseLevelColor(room.noiseLevel)
                  )}
                >
                  {room.noiseLevel.charAt(0).toUpperCase() + room.noiseLevel.slice(1)}
                </span>
              </div>
            </div>

            {/* Acoustics Score */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Acoustics Score</p>
              <div>{renderScore(room.acousticsScore)}</div>
            </div>

            {/* Recommendation */}
            <div className="flex items-start gap-2 p-2 bg-primary/5 rounded border border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">{room.recommendation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
