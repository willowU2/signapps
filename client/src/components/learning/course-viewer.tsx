"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Play, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { workforceApi } from "@/lib/api/workforce";

interface Module {
  id: string;
  title: string;
  duration: number; // minutes
  completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  status: "not-started" | "in-progress" | "completed";
  modules: Module[];
  instructor: string;
}

const STORAGE_KEY = "learning_courses";

const SEED_COURSES: Course[] = [
  {
    id: "1",
    title: "Introduction to SignApps",
    description: "Get started with SignApps Platform fundamentals",
    progress: 0,
    status: "not-started",
    instructor: "John Smith",
    modules: [
      { id: "1-1", title: "Getting Started", duration: 15, completed: false },
      {
        id: "1-2",
        title: "Dashboard Overview",
        duration: 20,
        completed: false,
      },
      { id: "1-3", title: "User Management", duration: 25, completed: false },
      {
        id: "1-4",
        title: "Security Best Practices",
        duration: 30,
        completed: false,
      },
    ],
  },
  {
    id: "2",
    title: "Advanced Document Management",
    description: "Master document workflows and collaboration",
    progress: 0,
    status: "not-started",
    instructor: "Sarah Johnson",
    modules: [
      { id: "2-1", title: "Document Basics", duration: 20, completed: false },
      { id: "2-2", title: "Workflow Creation", duration: 40, completed: false },
      {
        id: "2-3",
        title: "Approvals & Signatures",
        duration: 35,
        completed: false,
      },
    ],
  },
  {
    id: "3",
    title: "Compliance & Data Security",
    description: "Ensure your organization meets regulatory requirements",
    progress: 0,
    status: "not-started",
    instructor: "Michael Chen",
    modules: [
      { id: "3-1", title: "GDPR Essentials", duration: 30, completed: false },
      {
        id: "3-2",
        title: "Data Retention Policies",
        duration: 25,
        completed: false,
      },
      { id: "3-3", title: "Audit Trails", duration: 20, completed: false },
    ],
  },
];

function loadCoursesFromStorage(): Course[] {
  if (typeof window === "undefined") return SEED_COURSES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Course[]) : SEED_COURSES;
  } catch {
    return SEED_COURSES;
  }
}

function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // storage unavailable
  }
}

function mapCourseFromApi(c: any): Course {
  return {
    id: c.id ?? crypto.randomUUID(),
    title: c.title ?? c.name ?? "",
    description: c.description ?? "",
    progress: c.progress ?? 0,
    status: (["not-started", "in-progress", "completed"].includes(c.status)
      ? c.status
      : "not-started") as Course["status"],
    instructor: c.instructor ?? c.instructor_name ?? "",
    modules: Array.isArray(c.modules)
      ? c.modules.map((m: any) => ({
          id: m.id ?? crypto.randomUUID(),
          title: m.title ?? "",
          duration: m.duration_minutes ?? m.duration ?? 0,
          completed: m.completed ?? false,
        }))
      : [],
  };
}

function recalcCourse(course: Course): Course {
  const total = course.modules.length;
  const done = course.modules.filter((m) => m.completed).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const status: Course["status"] =
    done === 0 ? "not-started" : done === total ? "completed" : "in-progress";
  return { ...course, progress, status };
}

export function CourseViewer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await workforceApi.get<any[]>("/learning/courses");
        const loaded = (res.data ?? []).map(mapCourseFromApi);
        if (loaded.length > 0) {
          saveCourses(loaded);
          setCourses(loaded);
        } else {
          setCourses(loadCoursesFromStorage());
        }
      } catch {
        setCourses(loadCoursesFromStorage());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const startModule = (courseId: string, moduleId: string) => {
    setCourses((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== courseId) return c;
        const updatedModules = c.modules.map((m) =>
          m.id === moduleId ? { ...m, completed: true } : m,
        );
        return recalcCourse({ ...c, modules: updatedModules });
      });
      saveCourses(updated);
      const course = updated.find((c) => c.id === courseId);
      if (course) {
        workforceApi
          .put(`/learning/courses/${courseId}/progress`, {
            progress: course.progress,
            status: course.status,
            completed_module_id: moduleId,
          })
          .catch(() => {});
      }
      return updated;
    });
    toast.success("Module completed");
  };

  const resetCourse = (courseId: string) => {
    setCourses((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== courseId) return c;
        const resetModules = c.modules.map((m) => ({ ...m, completed: false }));
        return recalcCourse({ ...c, modules: resetModules });
      });
      saveCourses(updated);
      return updated;
    });
    toast.success("Course progress reset");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-muted text-gray-800";
    }
  };

  const calculateTotalDuration = (modules: Module[]) =>
    modules.reduce((sum, m) => sum + m.duration, 0);

  const calculateCompletedModules = (modules: Module[]) =>
    modules.filter((m) => m.completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <Card key={course.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <Badge
                    className={`${getStatusColor(course.status)} capitalize`}
                  >
                    {course.status === "in-progress"
                      ? "In Progress"
                      : course.status}
                  </Badge>
                </div>
                <CardDescription>{course.description}</CardDescription>
                <p className="text-xs text-muted-foreground mt-2">
                  Instructor: {course.instructor}
                </p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {calculateCompletedModules(course.modules)} of{" "}
                  {course.modules.length} modules completed
                </span>
                <span className="font-semibold">{course.progress}%</span>
              </div>
              <Progress value={course.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {calculateTotalDuration(course.modules)} minutes total
              </p>
            </div>
          </CardHeader>

          {/* Modules List */}
          {expandedCourse === course.id && (
            <CardContent className="space-y-2">
              <div className="space-y-2">
                {course.modules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50"
                  >
                    {module.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Play className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${module.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {module.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{module.duration}m</span>
                    </div>
                    {!module.completed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => startModule(course.id, module.id)}
                      >
                        Start
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                {course.status === "completed" ? (
                  <>
                    <Button className="flex-1" variant="outline">
                      Review Course
                    </Button>
                    <Button
                      className="flex-1"
                      variant="ghost"
                      onClick={() => resetCourse(course.id)}
                    >
                      Reset Progress
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        // Start first uncompleted module
                        const next = course.modules.find((m) => !m.completed);
                        if (next) startModule(course.id, next.id);
                      }}
                    >
                      {course.status === "not-started"
                        ? "Start Course"
                        : "Resume Course"}
                    </Button>
                    <Button variant="outline" className="flex-1">
                      View Curriculum
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          )}

          {/* Expand/Collapse Button */}
          {!expandedCourse || expandedCourse !== course.id ? (
            <CardContent className="pt-0">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  setExpandedCourse(
                    expandedCourse === course.id ? null : course.id,
                  )
                }
              >
                {expandedCourse === course.id ? "Hide Modules" : "Show Modules"}
              </Button>
            </CardContent>
          ) : (
            <div className="px-6 pb-4">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setExpandedCourse(null)}
              >
                Hide Modules
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
