'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Episode {
  id: string;
  title: string;
  host: string;
  duration: string;
  description: string;
}

export function InternalPodcast() {
  const [episodes, setEpisodes] = useState<Episode[]>([
    {
      id: '1',
      title: 'Rust Performance Optimization',
      host: 'Dr. Elena Rodriguez',
      duration: '32:45',
      description: 'Deep dive into async patterns in Rust',
    },
    {
      id: '2',
      title: 'Next.js 16 Best Practices',
      host: 'James Mitchell',
      duration: '28:20',
      description: 'Building scalable React applications',
    },
    {
      id: '3',
      title: 'Database Design for SaaS',
      host: 'Priya Patel',
      duration: '41:15',
      description: 'Scaling databases at startup speed',
    },
  ]);
  const [subscribed, setSubscribed] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayClick = (episodeId: string) => {
    setPlayingId(playingId === episodeId ? null : episodeId);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Internal Podcast</h2>
          <p className="text-sm text-muted-foreground">
            {episodes.length} episodes available
          </p>
        </div>
        <Button
          onClick={() => setSubscribed(!subscribed)}
          variant={subscribed ? 'default' : 'outline'}
          size="sm"
          aria-label={subscribed ? 'Unsubscribe from podcast' : 'Subscribe to podcast'}
        >
          {subscribed ? (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Subscribed
            </>
          ) : (
            <>
              <BellOff className="h-4 w-4 mr-2" />
              Subscribe
            </>
          )}
        </Button>
      </div>

      {/* Episode List */}
      <div className="space-y-3">
        {episodes.map((episode) => (
          <div
            key={episode.id}
            className="p-4 bg-muted/50 border border-input rounded-lg hover:bg-muted/70 transition-colors space-y-2"
          >
            {/* Episode Title and Host */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{episode.title}</h3>
                <p className="text-xs text-muted-foreground">Hosted by {episode.host}</p>
                <p className="text-xs text-muted-foreground mt-1">{episode.description}</p>
              </div>
              <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                {episode.duration}
              </span>
            </div>

            {/* Play Button */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => handlePlayClick(episode.id)}
                size="sm"
                variant="outline"
                className={cn(
                  playingId === episode.id && 'bg-primary/10 border-primary'
                )}
                aria-label={`Play episode: ${episode.title}`}
              >
                <Play className="h-4 w-4 mr-1" />
                {playingId === episode.id ? 'Playing...' : 'Play'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {episodes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No episodes available yet.</p>
        </div>
      )}
    </div>
  );
}
