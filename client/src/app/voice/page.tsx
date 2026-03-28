'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MeetingMinutesGenerator } from '@/components/voice/meeting-minutes-generator';
import { VoiceCommandsGlobal } from '@/components/voice/voice-commands-global';
import { AudioToTask } from '@/components/voice/audio-to-task';
import { PodcastPlayer } from '@/components/voice/podcast-player';
import { VoiceNotes } from '@/components/voice/voice-notes';
import { DictationMode } from '@/components/voice/dictation-mode';
import { FileText, Mic, Zap, Rss, FileAudio, Edit3 } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

export default function VoicePage() {
  usePageTitle('Voix');
  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Voice & Audio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meeting minutes, voice commands, audio tasks, podcast player, voice notes, and dictation
          </p>
        </div>

        <Tabs defaultValue="minutes">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="minutes" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />Minutes
            </TabsTrigger>
            <TabsTrigger value="commands" className="gap-1 text-xs">
              <Mic className="h-3.5 w-3.5" />Commands
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 text-xs">
              <Zap className="h-3.5 w-3.5" />Audio Tasks
            </TabsTrigger>
            <TabsTrigger value="podcast" className="gap-1 text-xs">
              <Rss className="h-3.5 w-3.5" />Podcast
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 text-xs">
              <FileAudio className="h-3.5 w-3.5" />Voice Notes
            </TabsTrigger>
            <TabsTrigger value="dictation" className="gap-1 text-xs">
              <Edit3 className="h-3.5 w-3.5" />Dictation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="minutes" className="mt-4"><MeetingMinutesGenerator /></TabsContent>
          <TabsContent value="commands" className="mt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <h2 className="text-sm font-semibold mb-2">Global Voice Commands</h2>
                <p className="text-xs text-muted-foreground mb-3">Enable voice commands to navigate the app hands-free.</p>
                <VoiceCommandsGlobal />
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm font-semibold mb-2">Available Commands</h3>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  {[
                    '"créer document" / "create doc"',
                    '"envoyer mail" / "send email"',
                    '"planifier réunion" / "schedule meeting"',
                    '"nouvelle tâche" / "create task"',
                    '"tableau de bord" / "go to dashboard"',
                    '"paramètres" / "settings"',
                    '"retour" / "go back"',
                  ].map(cmd => (
                    <li key={cmd} className="flex items-center gap-2">
                      <Mic className="h-3 w-3 shrink-0 text-primary" />
                      <code>{cmd}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tasks" className="mt-4"><AudioToTask /></TabsContent>
          <TabsContent value="podcast" className="mt-4"><PodcastPlayer /></TabsContent>
          <TabsContent value="notes" className="mt-4"><VoiceNotes /></TabsContent>
          <TabsContent value="dictation" className="mt-4"><DictationMode /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
