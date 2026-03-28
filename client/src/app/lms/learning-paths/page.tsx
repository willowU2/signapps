'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Map, BookOpen, Clock, ChevronRight, CheckCircle2, Lock, Play, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface PathCourse {
  id: string;
  title: string;
  duration: number;
  status: 'completed' | 'in-progress' | 'locked' | 'available';
  score?: number;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  level: string;
  estimatedTime: number;
  enrolledCount: number;
  courses: PathCourse[];
  badgeColor: string;
}

const PATHS: LearningPath[] = [
  {
    id: '1', title: 'SignApps Essentials', description: 'Master the core SignApps platform modules from onboarding to power user.', level: 'Beginner', estimatedTime: 8, enrolledCount: 234, badgeColor: 'bg-green-500',
    courses: [
      { id: 'c1', title: 'Getting Started', duration: 30, status: 'completed', score: 94 },
      { id: 'c2', title: 'Document Management', duration: 45, status: 'completed', score: 89 },
      { id: 'c3', title: 'Team Collaboration', duration: 60, status: 'in-progress' },
      { id: 'c4', title: 'Calendar & Scheduling', duration: 45, status: 'locked' },
      { id: 'c5', title: 'Essentials Assessment', duration: 20, status: 'locked' },
    ],
  },
  {
    id: '2', title: 'Security & Compliance', description: 'Deep dive into security practices, RBAC, audit trails, and compliance.', level: 'Intermediate', estimatedTime: 12, enrolledCount: 89, badgeColor: 'bg-red-500',
    courses: [
      { id: 'c1', title: 'Security Fundamentals', duration: 60, status: 'available' },
      { id: 'c2', title: 'Role-Based Access Control', duration: 75, status: 'locked' },
      { id: 'c3', title: 'Audit & Compliance', duration: 90, status: 'locked' },
      { id: 'c4', title: 'Incident Response', duration: 60, status: 'locked' },
    ],
  },
  {
    id: '3', title: 'Administration Mastery', description: 'Full platform administration: users, permissions, integrations, and monitoring.', level: 'Advanced', estimatedTime: 20, enrolledCount: 42, badgeColor: 'bg-purple-500',
    courses: [
      { id: 'c1', title: 'User & Org Management', duration: 90, status: 'available' },
      { id: 'c2', title: 'System Configuration', duration: 120, status: 'locked' },
      { id: 'c3', title: 'Integrations & APIs', duration: 150, status: 'locked' },
      { id: 'c4', title: 'Performance & Monitoring', duration: 90, status: 'locked' },
      { id: 'c5', title: 'Advanced Assessment', duration: 30, status: 'locked' },
    ],
  },
];

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Done' },
  'in-progress': { icon: Play, color: 'text-blue-500', label: 'In Progress' },
  available: { icon: Play, color: 'text-primary', label: 'Start' },
  locked: { icon: Lock, color: 'text-muted-foreground', label: 'Locked' },
};

export default function LearningPathsPage() {
  usePageTitle('Parcours');
  const [expanded, setExpanded] = useState<string | null>('1');

  const getProgress = (path: LearningPath) => {
    const done = path.courses.filter(c => c.status === 'completed').length;
    return Math.round((done / path.courses.length) * 100);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Map className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Learning Paths</h1>
            <p className="text-sm text-muted-foreground">Structured sequences of courses to master specific skills</p>
          </div>
        </div>

        <div className="space-y-4">
          {PATHS.map(path => {
            const progress = getProgress(path);
            const isOpen = expanded === path.id;
            const done = path.courses.filter(c => c.status === 'completed').length;

            return (
              <Card key={path.id} className={cn('transition-shadow', isOpen && 'shadow-md')}>
                <CardHeader className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : path.id)}>
                  <div className="flex items-start gap-4">
                    <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', path.badgeColor)}>
                      <Map className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{path.title}</CardTitle>
                        <Badge variant="outline" className="text-xs">{path.level}</Badge>
                        {progress === 100 && <Badge className="text-xs bg-green-500"><Trophy className="h-3 w-3 mr-1" />Complete</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{path.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{path.estimatedTime}h</span>
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{path.courses.length} courses</span>
                        <span>{path.enrolledCount} enrolled</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground shrink-0">{done}/{path.courses.length}</span>
                      </div>
                    </div>
                    <ChevronRight className={cn('h-5 w-5 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-90')} />
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-4 space-y-2">
                      {path.courses.map((course, idx) => {
                        const sc = statusConfig[course.status];
                        const Icon = sc.icon;
                        return (
                          <div key={course.id} className={cn('flex items-center gap-3 p-3 rounded-lg border', course.status === 'locked' ? 'opacity-50 bg-muted/20' : 'bg-card hover:bg-muted/30 cursor-pointer')}>
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 text-xs font-bold">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{course.title}</p>
                              <p className="text-xs text-muted-foreground">{course.duration} min{course.score ? ` · Score: ${course.score}%` : ''}</p>
                            </div>
                            {course.status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            ) : course.status !== 'locked' ? (
                              <Button size="sm" variant={course.status === 'in-progress' ? 'default' : 'outline'} asChild>
                                <Link href={`/lms/courses/${course.id}`}>
                                  {course.status === 'in-progress' ? 'Continue' : 'Start'}<ArrowRight className="h-3.5 w-3.5 ml-1" />
                                </Link>
                              </Button>
                            ) : (
                              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
