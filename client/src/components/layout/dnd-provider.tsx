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

      // Handle File dropped onto a Task
      if (activeType === 'file' && overType === 'task') {
        const file = active.data.current?.file;
        const task = over.data.current?.task;
        
        // Optimistic UI Toast
        toast.success(`Attached "${file.name}" to task "${task.title}"`);
        
        // TODO: Call actual API endpoint to link file to task in DB
      }
      
      // Handle Task dropped onto a Calendar Slot
      else if (activeType === 'task' && overType === 'calendar-slot') {
         const task = active.data.current?.task;
         const slotDate = over.data.current?.date;
         
         const formattedDate = new Date(slotDate).toLocaleDateString();
         toast.success(`Scheduled task "${task.title}" for ${formattedDate}`);
         
        // TODO: Open EventForm Modal or directly call API to create an event
      }
      
      // Handle File dropped onto Calendar Day
       else if (activeType === 'file' && overType === 'calendar-slot') {
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
          <div className="bg-white rounded border border-gray-200 shadow-xl px-4 py-3 flex items-center gap-3 w-64 rotate-2 opacity-90">
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
