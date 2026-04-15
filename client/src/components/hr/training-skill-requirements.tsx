"use client";

// Feature 9: HR training → link to project skill requirements

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Briefcase,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface SkillRequirement {
  skill: string;
  requiredLevel: number; // 1-5
  projectId: string;
  projectName: string;
}

interface TrainingCourse {
  id: string;
  title: string;
  skillTrained: string;
  duration: string;
  format: "video" | "workshop" | "certification";
  link?: string;
  projectsRequiring: string[];
}

const SKILL_REQUIREMENTS: SkillRequirement[] = [
  {
    skill: "Rust",
    requiredLevel: 4,
    projectId: "p1",
    projectName: "Refonte Backend Auth",
  },
  {
    skill: "Docker",
    requiredLevel: 3,
    projectId: "p1",
    projectName: "Refonte Backend Auth",
  },
  {
    skill: "Figma",
    requiredLevel: 4,
    projectId: "p2",
    projectName: "Dashboard Analytics",
  },
];

const TRAINING_COURSES: TrainingCourse[] = [
  {
    id: "c1",
    title: "Rust pour les développeurs",
    skillTrained: "Rust",
    duration: "20h",
    format: "video",
    projectsRequiring: ["p1"],
  },
  {
    id: "c2",
    title: "Docker & Kubernetes",
    skillTrained: "Docker",
    duration: "12h",
    format: "workshop",
    projectsRequiring: ["p1"],
  },
  {
    id: "c3",
    title: "Figma avancé",
    skillTrained: "Figma",
    duration: "8h",
    format: "video",
    projectsRequiring: ["p2"],
  },
];

const FORMAT_LABEL = {
  video: "Vidéo",
  workshop: "Atelier",
  certification: "Certification",
};

interface TrainingSkillRequirementsProps {
  employeeSkills?: Record<string, number>;
}

export function TrainingSkillRequirements({
  employeeSkills = { Rust: 2, Docker: 3, Figma: 2 },
}: TrainingSkillRequirementsProps) {
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());

  const coursesWithGap = TRAINING_COURSES.map((course) => {
    const req = SKILL_REQUIREMENTS.find((r) => r.skill === course.skillTrained);
    const current = employeeSkills[course.skillTrained] ?? 0;
    const required = req?.requiredLevel ?? 0;
    const gap = Math.max(0, required - current);
    return {
      ...course,
      currentLevel: current,
      requiredLevel: required,
      gap,
      projectName: req?.projectName ?? "",
    };
  }).filter((c) => c.gap > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4" />
          Formations liées aux projets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {coursesWithGap.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="size-4" /> Toutes les compétences requises
            sont atteintes.
          </div>
        )}
        {coursesWithGap.map((course) => (
          <div key={course.id} className="rounded-lg border p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{course.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Briefcase className="size-3" />
                  <span>{course.projectName}</span>
                  <ArrowRight className="size-3" />
                  <span>Compétence: {course.skillTrained}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {FORMAT_LABEL[course.format]} · {course.duration}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Niveau actuel: {course.currentLevel}/5</span>
                <span>Requis: {course.requiredLevel}/5</span>
              </div>
              <Progress
                value={(course.currentLevel / course.requiredLevel) * 100}
                className="h-1.5"
              />
            </div>
            <Button
              size="sm"
              variant={enrolled.has(course.id) ? "secondary" : "default"}
              className="h-7 text-xs w-full"
              onClick={() =>
                setEnrolled((prev) => new Set([...prev, course.id]))
              }
              disabled={enrolled.has(course.id)}
            >
              {enrolled.has(course.id) ? "Inscrit" : "S'inscrire"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
