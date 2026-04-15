// Feature 20: Project → auto-assign tasks based on HR skills

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface TaskToAssign {
  id: string;
  title: string;
  requiredSkills: string[];
  estimatedHours: number;
  priority: "low" | "medium" | "high";
}

export interface EmployeeAvailability {
  id: string;
  name: string;
  skills: Record<string, number>; // skill -> proficiency (1-5)
  currentAllocation: number; // %
  maxAllocation: number; // %
}

export interface TaskAssignment {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeName: string;
  matchScore: number; // 0-100
  matchedSkills: string[];
  availableCapacity: number; // %
}

const DEMO_EMPLOYEES: EmployeeAvailability[] = [
  {
    id: "1",
    name: "Alice Martin",
    skills: { React: 5, TypeScript: 5, Rust: 4 },
    currentAllocation: 80,
    maxAllocation: 100,
  },
  {
    id: "2",
    name: "Bob Dupont",
    skills: { Docker: 5, Kubernetes: 4, "CI/CD": 4 },
    currentAllocation: 50,
    maxAllocation: 100,
  },
  {
    id: "5",
    name: "Emma Leroy",
    skills: { Figma: 5, "Design System": 4, "A/B Testing": 3 },
    currentAllocation: 30,
    maxAllocation: 80,
  },
  {
    id: "8",
    name: "Marc Dubois",
    skills: { Rust: 4, PostgreSQL: 5, TypeScript: 3 },
    currentAllocation: 60,
    maxAllocation: 100,
  },
];

function scoreMatch(
  task: TaskToAssign,
  employee: EmployeeAvailability,
): { score: number; matchedSkills: string[] } {
  const capacity = employee.maxAllocation - employee.currentAllocation;
  if (capacity <= 0) return { score: 0, matchedSkills: [] };

  const matchedSkills: string[] = [];
  let skillScore = 0;

  for (const skill of task.requiredSkills) {
    const level = employee.skills[skill] ?? 0;
    if (level > 0) {
      matchedSkills.push(skill);
      skillScore += level / 5;
    }
  }

  const skillCoverage =
    task.requiredSkills.length > 0
      ? matchedSkills.length / task.requiredSkills.length
      : 1;
  const skillQuality =
    task.requiredSkills.length > 0
      ? skillScore / task.requiredSkills.length
      : 0;
  const availabilityScore = Math.min(1, capacity / 20); // 20% min capacity preferred

  const score = Math.round(
    (skillCoverage * 0.5 + skillQuality * 0.3 + availabilityScore * 0.2) * 100,
  );
  return { score, matchedSkills };
}

export function useAutoAssignTasks(
  employees: EmployeeAvailability[] = DEMO_EMPLOYEES,
) {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [assigning, setAssigning] = useState(false);

  const suggestAssignment = useCallback(
    (task: TaskToAssign): TaskAssignment | null => {
      const scored = employees
        .map((emp) => {
          const { score, matchedSkills } = scoreMatch(task, emp);
          return { emp, score, matchedSkills };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) return null;
      const best = scored[0];
      return {
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: best.emp.id,
        assigneeName: best.emp.name,
        matchScore: best.score,
        matchedSkills: best.matchedSkills,
        availableCapacity: best.emp.maxAllocation - best.emp.currentAllocation,
      };
    },
    [employees],
  );

  const autoAssignAll = useCallback(
    async (tasks: TaskToAssign[]) => {
      setAssigning(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newAssignments: TaskAssignment[] = [];
      for (const task of tasks) {
        const assignment = suggestAssignment(task);
        if (assignment) newAssignments.push(assignment);
      }

      setAssignments(newAssignments);
      setAssigning(false);

      const assigned = newAssignments.length;
      const unassigned = tasks.length - assigned;
      toast.success(`${assigned} tâche(s) auto-assignées`, {
        description:
          unassigned > 0
            ? `${unassigned} tâche(s) sans correspondance de compétences.`
            : "Toutes les tâches ont été assignées.",
      });

      return newAssignments;
    },
    [suggestAssignment],
  );

  const clearAssignments = useCallback(() => setAssignments([]), []);

  return {
    assignments,
    assigning,
    suggestAssignment,
    autoAssignAll,
    clearAssignments,
  };
}
