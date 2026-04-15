"use client";

import { useEffect, useState } from "react";
import { Monitor, Upload, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Screen {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline";
  currentContent: string;
}

interface PlaylistItem {
  id: string;
  name: string;
  duration: number;
  order: number;
}

export function DigitalSignage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);

  useEffect(() => {
    setScreens([
      {
        id: "s1",
        name: "Lobby Screen",
        location: "Main Entrance",
        status: "online",
        currentContent: "Welcome Video.mp4",
      },
      {
        id: "s2",
        name: "Conference Room A",
        location: "Floor 2",
        status: "online",
        currentContent: "Meeting Agenda.pptx",
      },
      {
        id: "s3",
        name: "Cafeteria Display",
        location: "Cafeteria",
        status: "offline",
        currentContent: "Menu Board.mp4",
      },
    ]);
    setPlaylist([
      { id: "p1", name: "Welcome Video.mp4", duration: 30, order: 1 },
      { id: "p2", name: "Company Intro.mp4", duration: 45, order: 2 },
      { id: "p3", name: "Event Promo.mp4", duration: 20, order: 3 },
    ]);
    setSelectedScreen("s1");
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {screens.map((screen) => (
          <div
            key={screen.id}
            onClick={() => setSelectedScreen(screen.id)}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedScreen === screen.id
                ? "border-blue-500 bg-blue-50"
                : "border-border"
            }`}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Monitor
                className={`w-5 h-5 ${screen.status === "online" ? "text-green-600" : "text-gray-400"}`}
              />
              <span className="font-semibold">{screen.name}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {screen.location}
            </p>
            <p className="text-xs font-medium mb-2">
              <span
                className={
                  screen.status === "online" ? "text-green-600" : "text-red-600"
                }
              >
                {screen.status === "online" ? "● Online" : "● Offline"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Current: {screen.currentContent}
            </p>
          </div>
        ))}
      </div>

      {selectedScreen && (
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="font-semibold mb-3">Current Content Preview</h3>
          <div className="bg-gray-900 rounded w-full h-64 flex items-center justify-center">
            <p className="text-gray-400">
              {screens.find((s) => s.id === selectedScreen)?.currentContent ||
                "No content"}
            </p>
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Playlist Schedule</h3>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Media
          </Button>
        </div>
        <div className="space-y-2">
          {playlist.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center p-3 bg-muted rounded"
            >
              <div>
                <p className="font-medium">
                  #{item.order} {item.name}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {item.duration}s
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="flex items-center space-x-2 mb-3">
          <Upload className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">Upload Media</h3>
        </div>
        <div className="border-2 border-dashed border-blue-300 rounded p-8 text-center">
          <p className="text-muted-foreground mb-2">
            Drag and drop media files or click to browse
          </p>
          <Button variant="outline">Select File</Button>
        </div>
      </div>
    </div>
  );
}
