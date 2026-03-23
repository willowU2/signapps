"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Task {
  id: string;
  name: string;
  start: number;
  duration: number;
  dependencies?: string[];
}

interface Project {
  id: string;
  name: string;
  tasks: Task[];
}

export default function MultiProjectGantt() {
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);

  const projects: Project[] = [
    {
      id: "p1",
      name: "Platform Relaunch",
      tasks: [
        { id: "t1", name: "Design", start: 0, duration: 10 },
        { id: "t2", name: "Development", start: 10, duration: 20, dependencies: ["t1"] },
        { id: "t3", name: "Testing", start: 30, duration: 10, dependencies: ["t2"] },
      ],
    },
    {
      id: "p2",
      name: "Mobile App",
      tasks: [
        { id: "t4", name: "Requirements", start: 2, duration: 8 },
        { id: "t5", name: "Development", start: 10, duration: 25, dependencies: ["t4"] },
        { id: "t6", name: "QA", start: 35, duration: 8, dependencies: ["t5"] },
      ],
    },
  ];

  const toggleProject = (projectId: string) => {
    setExpandedProjects(
      expandedProjects.includes(projectId)
        ? expandedProjects.filter((p) => p !== projectId)
        : [...expandedProjects, projectId]
    );
  };

  const dayWidth = 4;
  const totalDays = 50;

  const renderGanttBar = (task: Task) => {
    const hasDeps = task.dependencies && task.dependencies.length > 0;
    return (
      <div key={task.id} className="flex items-center h-8 mb-2">
        <span className="w-32 text-sm font-medium truncate">{task.name}</span>
        <div className="relative flex-1 h-full bg-gray-100 rounded">
          <div
            className={`absolute h-full rounded transition-all ${hasDeps ? "bg-orange-500" : "bg-blue-500"}`}
            style={{
              left: `${task.start * dayWidth}px`,
              width: `${task.duration * dayWidth}px`,
            }}
          >
            <span className="text-xs text-white px-2 py-1">{task.name}</span>
          </div>
          {hasDeps && (
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600" style={{ left: `${task.start * dayWidth}px` }} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Multi-Project Gantt</h2>

      <div className="min-w-max">
        {projects.map((project) => (
          <div key={project.id} className="mb-6">
            <button
              onClick={() => toggleProject(project.id)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded w-full font-bold text-left"
            >
              {expandedProjects.includes(project.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {project.name}
            </button>

            {expandedProjects.includes(project.id) && (
              <div className="pl-6 border-l-2 border-gray-300">
                {project.tasks.map(renderGanttBar)}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-1 mt-8 text-xs text-gray-600 mb-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ width: `${dayWidth * 5}px` }} className="text-center">
              Day {i * 5}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span>Independent Task</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded" />
          <span>Has Dependencies</span>
        </div>
      </div>
    </div>
  );
}
