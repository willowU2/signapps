import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Task } from '@/lib/scheduling/types/scheduling';
import { CollaborativeEditor } from '@/components/ai/collaborative-editor';
import { EntityLinks } from '@/components/crosslinks/EntityLinks';
import { ActivityFeed } from '@/components/crosslinks/ActivityFeed';

interface TaskSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSheet({ task, open, onOpenChange }: TaskSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[600px] sm:w-[600px] p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l shadow-2xl">
        <SheetHeader className="p-6 border-b bg-background">
          <SheetTitle className="text-xl font-semibold tracking-tight text-[#202124]">
            {task.title}
          </SheetTitle>
          <div className="flex gap-2 mt-2">
             <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700">
               {task.priority || 'MEDIUM'}
             </span>
             <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
               {task.status}
             </span>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto w-full">
            {/* The tiptap Collaborative Editor bound to this task's document ID */}
            {/* We prefix the document id with 'task-' so the Yjs room is distinct */}
            <div className="min-h-[400px]">
                <CollaborativeEditor
                  docId={`task-${task.id}`}
                  placeholder="Ajouter une description détaillée avec TipTap..."
                  onSynced={() => { /* synced */ }}
                />
            </div>

            {/* Crosslinks & Activity */}
            <div className="border-t p-4 space-y-4">
              <EntityLinks entityType="task" entityId={task.id} />
              <ActivityFeed entityType="task" entityId={task.id} limit={5} />
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
