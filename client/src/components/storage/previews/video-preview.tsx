'use client';

import { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface VideoPreviewProps {
  src: string;
  fileName: string;
}

/**
 * VideoPreview - Lecteur vidéo pour MP4, WebM, MOV, etc.
 */
export function VideoPreview({ src, fileName }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleTimeChange = (newTime: number[]) => {
    const time = newTime[0];
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="bg-black rounded-lg overflow-hidden"
    >
      {/* Video Player */}
      <div className="relative w-full bg-black aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Play button overlay */}
        {!isPlaying && !isLoading && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute h-16 w-16 rounded-full hover:bg-background/20"
            onClick={handlePlayPause}
          >
            <Play className="h-8 w-8 text-white fill-white" />
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 space-y-3">
        {/* Timeline */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 0}
            step={0.1}
            onValueChange={handleTimeChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between gap-4">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-300 hover:text-white"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </Button>

            {/* Volume control */}
            <div className="flex items-center gap-2 group">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-300 hover:text-white"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <div className="hidden group-hover:block w-20">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>

            <span className="text-xs text-gray-400">{Math.round(volume * 100)}%</span>
          </div>

          {/* Right controls */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-300 hover:text-white ml-auto"
            onClick={handleFullscreen}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400">
        <p>{fileName}</p>
      </div>
    </div>
  );
}
