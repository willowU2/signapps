'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MindMapEditor } from '@/components/collaboration/mind-map-editor';
import { KanbanSwimlanes } from '@/components/collaboration/kanban-swimlanes';
import { DecisionLog } from '@/components/collaboration/decision-log';
import { MeetingNotesTemplate } from '@/components/collaboration/meeting-notes-template';
import { GitBranch, Layers, BookOpen, FileText } from 'lucide-react';

export default function CollaborationPage() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Collaboration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mind maps, Kanban swimlanes, decision log, and meeting notes templates
          </p>
        </div>

        <Tabs defaultValue="mindmap">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="mindmap" className="gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" />Mind Map
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />Kanban
            </TabsTrigger>
            <TabsTrigger value="decisions" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />Decisions
            </TabsTrigger>
            <TabsTrigger value="meeting" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />Meeting Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mindmap" className="mt-4"><MindMapEditor /></TabsContent>
          <TabsContent value="kanban" className="mt-4"><KanbanSwimlanes /></TabsContent>
          <TabsContent value="decisions" className="mt-4"><DecisionLog /></TabsContent>
          <TabsContent value="meeting" className="mt-4"><MeetingNotesTemplate /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
