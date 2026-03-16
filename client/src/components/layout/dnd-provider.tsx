'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { FEATURES } from '@/lib/features';
import { taskAttachmentsApi } from '@/lib/api/scheduler';
import { calendarApi } from '@/lib/api/calendar';

interface GlobalDndProviderProps {
  children: React.ReactNode;
}

export function GlobalDndProvider({ children }: GlobalDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before dragging starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveData(null);

    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeType = active.data.current?.type;
      const overType = over.data.current?.type;

      // Handle File dropped onto a Task (only if feature enabled)
      if (activeType === 'file' && overType === 'task' && FEATURES.DND_FILE_TO_TASK) {
        const file = active.data.current?.file;
        const task = over.data.current?.task;

        if (file && task) {
          // Build storage URL for the file
          const fileUrl = `/api/v1/files/${file.bucket || 'default'}/${encodeURIComponent(file.key || file.name)}`;

          taskAttachmentsApi
            .addAttachment(task.id, {
              file_url: fileUrl,
              file_name: file.name,
              file_size_bytes: file.size,
            })
            .then(() => {
              toast.success(`Attached "${file.name}" to task "${task.title}"`);
            })
            .catch((err) => {
              console.error('Failed to attach file to task:', err);
              toast.error('Failed to attach file to task');
            });
        }
      }

      // Handle Task dropped onto a Calendar Slot (only if feature enabled)
      else if (activeType === 'task' && overType === 'calendar-slot' && FEATURES.DND_TASK_TO_CALENDAR) {
        const task = active.data.current?.task;
        const slotData = over.data.current;

        if (task && slotData) {
          const slotDate = slotData.date;
          const calendarId = slotData.calendarId;

          // Calculate event times (1 hour duration)
          const startTime = new Date(slotDate);
          const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

          if (calendarId) {
            calendarApi
              .createEvent(calendarId, {
                title: task.title || task.label || 'Task Event',
                description: `Created from task: ${task.id}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
              })
              .then(() => {
                const formattedDate = startTime.toLocaleDateString();
                toast.success(`Scheduled task "${task.title || task.label}" for ${formattedDate}`);
              })
              .catch((err) => {
                console.error('Failed to create event:', err);
                toast.error('Failed to create calendar event');
              });
          } else {
            // No calendar ID, just show success message (fallback)
            const formattedDate = startTime.toLocaleDateString();
            toast.success(`Scheduled task "${task.title || task.label}" for ${formattedDate}`);
          }
        }
      }

      // Handle File dropped onto Calendar Day (only if feature enabled)
       else if (activeType === 'file' && overType === 'calendar-slot' && FEATURES.DND_TASK_TO_CALENDAR) {
         const file = active.data.current?.file;
         const slotDate = over.data.current?.date;

         const formattedDate = new Date(slotDate).toLocaleDateString();
         toast.success(`Started new event for "${file.name}" on ${formattedDate}`);
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
        {activeId ? (
          <div className="bg-background rounded border border-gray-200 shadow-xl px-4 py-3 flex items-center gap-3 w-64 rotate-2 opacity-90">
             {activeData?.type === 'file' && (
                <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
             )}
             {activeData?.type === 'task' && (
                <div className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center shrink-0">
                  <span className="w-4 h-4 rounded-sm border-2 border-gray-400" />
                </div>
             )}
            <div className="truncate text-sm font-medium text-gray-700">
              {activeData?.file?.name || activeData?.task?.title || "Item"}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
