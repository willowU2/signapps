"use client";

// Feature 24: HR → show learning courses related to project tech

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Search, Play, CheckCircle2, Briefcase } from "lucide-react";

interface LearningCourse {
  id: string;
  title: string;
  provider: string;
  technology: string;
  duration: string;
  level: "beginner" | "intermediate" | "advanced";
  projectsUsingTech: string[];
  enrolledCount: number;
  completionRate: number;
  userProgress?: number; // 0-100 if enrolled
  link?: string;
}

const LEVEL_CONFIG = {
  beginner: { label: "Débutant", class: "bg-green-100 text-green-800" },
  intermediate: { label: "Intermédiaire", class: "bg-blue-100 text-blue-800" },
  advanced: { label: "Avancé", class: "bg-purple-100 text-purple-800" },
};

const DEMO_COURSES: LearningCourse[] = [
  {
    id: "c1",
    title: "Rust Programming Fundamentals",
    provider: "Rustlings",
    technology: "Rust",
    duration: "20h",
    level: "intermediate",
    projectsUsingTech: ["Refonte Backend Auth"],
    enrolledCount: 3,
    completionRate: 67,
    userProgress: 45,
  },
  {
    id: "c2",
    title: "TypeScript Deep Dive",
    provider: "TypeScript.tv",
    technology: "TypeScript",
    duration: "12h",
    level: "intermediate",
    projectsUsingTech: ["Refonte Backend Auth", "Dashboard Analytics"],
    enrolledCount: 5,
    completionRate: 80,
    userProgress: 100,
  },
  {
    id: "c3",
    title: "Docker for Developers",
    provider: "Docker Learn",
    technology: "Docker",
    duration: "8h",
    level: "beginner",
    projectsUsingTech: ["Refonte Backend Auth"],
    enrolledCount: 4,
    completionRate: 90,
  },
  {
    id: "c4",
    title: "Figma Advanced Prototyping",
    provider: "Figma Academy",
    technology: "Figma",
    duration: "6h",
    level: "advanced",
    projectsUsingTech: ["Dashboard Analytics"],
    enrolledCount: 2,
    completionRate: 50,
  },
  {
    id: "c5",
    title: "PostgreSQL Performance Tuning",
    provider: "Percona",
    technology: "PostgreSQL",
    duration: "15h",
    level: "advanced",
    projectsUsingTech: ["Refonte Backend Auth"],
    enrolledCount: 1,
    completionRate: 30,
  },
];

interface LearningProjectCoursesProps {
  projectFilter?: string;
}

export function LearningProjectCourses({
  projectFilter,
}: LearningProjectCoursesProps) {
  const [search, setSearch] = useState("");
  const [enrolled, setEnrolled] = useState<Set<string>>(
    new Set(
      DEMO_COURSES.filter((c) => c.userProgress !== undefined).map((c) => c.id),
    ),
  );

  const filtered = DEMO_COURSES.filter((c) => {
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.technology.toLowerCase().includes(search.toLowerCase());
    const matchProject =
      !projectFilter || c.projectsUsingTech.includes(projectFilter);
    return matchSearch && matchProject;
  });

  function enroll(id: string) {
    setEnrolled((prev) => new Set([...prev, id]));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4" />
          Formations par technologie projet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une formation..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="space-y-2">
          {filtered.map((course) => {
            const isEnrolled = enrolled.has(course.id);
            const prog = DEMO_COURSES.find(
              (c) => c.id === course.id,
            )?.userProgress;
            const isDone = prog === 100;
            return (
              <div
                key={course.id}
                className="rounded-lg border p-2.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">
                        {course.title}
                      </span>
                      <span
                        className={`text-[10px] rounded px-1 py-0.5 ${LEVEL_CONFIG[course.level].class}`}
                      >
                        {LEVEL_CONFIG[course.level].label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {course.provider} · {course.duration}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {course.technology}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {course.projectsUsingTech.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    >
                      <Briefcase className="size-2.5" />
                      {p}
                    </span>
                  ))}
                </div>

                {isEnrolled && prog !== undefined && (
                  <div className="flex items-center gap-2">
                    <Progress value={prog} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground">
                      {prog}%
                    </span>
                    {isDone && (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  variant={
                    isDone ? "secondary" : isEnrolled ? "outline" : "default"
                  }
                  className="h-6 gap-1 text-[10px] w-full"
                  onClick={() => !isEnrolled && enroll(course.id)}
                  disabled={isDone}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 className="size-3" /> Terminé
                    </>
                  ) : isEnrolled ? (
                    <>
                      <Play className="size-3" /> Continuer
                    </>
                  ) : (
                    "S'inscrire"
                  )}
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucune formation trouvée.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
