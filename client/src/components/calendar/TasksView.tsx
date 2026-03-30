'use client';

import { CustomKanbanBoard } from '../tasks/CustomKanbanBoard';

export default function TasksView() {
  return (
    <div className="h-full">
      <CustomKanbanBoard />
    </div>
  );
}
