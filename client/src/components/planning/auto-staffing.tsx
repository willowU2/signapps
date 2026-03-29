"use client";

import { useState } from "react";
import { Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  requiredSkills: string[];
  teamSize: number;
  skillMatchPercent: number;
}

export default function AutoStaffing() {
  const [projects, setProjects] = useState<Project[]>([
    { id: "1", name: "Mobile App Redesign", requiredSkills: ["React", "UI/UX"], teamSize: 4, skillMatchPercent: 85 },
    { id: "2", name: "Backend Migration", requiredSkills: ["Rust", "PostgreSQL"], teamSize: 3, skillMatchPercent: 92 },
    { id: "3", name: "Data Analytics Dashboard", requiredSkills: ["Python", "Data Viz"], teamSize: 2, skillMatchPercent: 78 },
  ]);

  const [assigned, setAssigned] = useState<string[]>([]);

  const autoAssign = (projectId: string) => {
    setAssigned([...assigned, projectId]);
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold mb-4">Auto-Staffing</h2>

      <div className="space-y-3">
        {projects.map((project) => (
          <div key={project.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-lg">{project.name}</p>
                <p className="text-xs text-muted-foreground">Team size: {project.teamSize}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{project.skillMatchPercent}%</p>
                <p className="text-xs text-muted-foreground">Match</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {project.requiredSkills.map((skill) => (
                <span key={skill} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {skill}
                </span>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => autoAssign(project.id)}
              disabled={assigned.includes(project.id)}
              className="w-full gap-2"
            >
              {assigned.includes(project.id) ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Team Assigned
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Auto-Assign Team
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-green-50 rounded-lg text-sm border border-green-200">
        <p className="font-medium text-green-900">
          {assigned.length} of {projects.length} projects staffed
        </p>
      </div>
    </div>
  );
}
