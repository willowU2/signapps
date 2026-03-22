"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  avatar?: string;
}

const MOCK_PARTICIPANTS: Participant[] = [
  { id: "1", name: "Alice Dupont", isMuted: false, isSpeaking: true },
  { id: "2", name: "Bob Martin", isMuted: true, isSpeaking: false },
  { id: "3", name: "Carol Singh", isMuted: false, isSpeaking: false },
];

export function AudioConference() {
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(
    MOCK_PARTICIPANTS
  );
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const handleToggleMute = (participantId: string) => {
    setParticipants(
      participants.map((p) =>
        p.id === participantId ? { ...p, isMuted: !p.isMuted } : p
      )
    );
  };

  const handleJoin = () => {
    setIsJoined(true);
  };

  const handleLeave = () => {
    setIsJoined(false);
    setParticipants(MOCK_PARTICIPANTS);
  };

  const activeSpeaker = participants.find((p) => p.isSpeaking);

  return (
    <div className="w-full max-w-2xl space-y-4 p-4 border border-border/50 rounded-lg bg-card">
      {/* Active Speaker Display */}
      {isJoined && activeSpeaker && (
        <div className="bg-muted rounded-lg p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="relative">
              <UserCircle className="h-16 w-16 text-muted-foreground" />
              {/* Speaking Indicator Animation */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full border-2 border-primary",
                  activeSpeaker.isSpeaking && "animate-pulse"
                )}
              />
            </div>
          </div>
          <div>
            <h3 className="font-semibold">{activeSpeaker.name}</h3>
            <p className="text-xs text-muted-foreground">En train de parler...</p>
          </div>
        </div>
      )}

      {!isJoined && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Conférence audio inactif</p>
        </div>
      )}

      {/* Participants List */}
      {isJoined && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Participants ({participants.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-md transition-colors",
                  participant.isSpeaking ? "bg-primary/10" : "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                    {participant.isSpeaking && (
                      <div className="absolute inset-0 rounded-full border border-primary animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {participant.name}
                    </p>
                    {participant.isSpeaking && (
                      <p className="text-xs text-primary">🎙 Parle</p>
                    )}
                  </div>
                </div>

                {/* Mute Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleToggleMute(participant.id)}
                >
                  {participant.isMuted ? (
                    <MicOff className="h-4 w-4 text-destructive" />
                  ) : (
                    <Mic className="h-4 w-4 text-green-600" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMicMuted(!isMicMuted)}
          disabled={!isJoined}
          className={cn(isMicMuted && "bg-destructive/10 text-destructive")}
        >
          {isMicMuted ? (
            <MicOff className="h-4 w-4 mr-2" />
          ) : (
            <Mic className="h-4 w-4 mr-2" />
          )}
          Micro
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
          disabled={!isJoined}
          className={cn(
            isSpeakerMuted && "bg-destructive/10 text-destructive"
          )}
        >
          {isSpeakerMuted ? (
            <VolumeX className="h-4 w-4 mr-2" />
          ) : (
            <Volume2 className="h-4 w-4 mr-2" />
          )}
          Son
        </Button>

        {!isJoined ? (
          <Button
            onClick={handleJoin}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            <Phone className="h-4 w-4" />
            Rejoindre
          </Button>
        ) : (
          <Button
            onClick={handleLeave}
            className="flex-1 gap-2 bg-destructive hover:bg-destructive/90"
          >
            <PhoneOff className="h-4 w-4" />
            Quitter
          </Button>
        )}
      </div>
    </div>
  );
}
