'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Search, Clock, Star, Users, Play, Filter } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/use-page-title';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  duration: number;
  rating: number;
  reviewCount: number;
  enrolled: number;
  progress?: number;
  thumbnail: string;
  tags: string[];
}

const COURSES: Course[] = [
  { id: '1', title: 'Introduction to SignApps Platform', description: 'Get started with the SignApps platform. Learn navigation, core features, and best practices.', instructor: 'Alice Martin', level: 'Beginner', category: 'Platform', duration: 180, rating: 4.8, reviewCount: 124, enrolled: 456, progress: 60, thumbnail: 'bg-gradient-to-br from-blue-500 to-purple-600', tags: ['onboarding', 'basics'] },
  { id: '2', title: 'Advanced Document Management', description: 'Master document workflows, templates, and collaboration features in SignApps Docs.', instructor: 'Bob Smith', level: 'Intermediate', category: 'Documents', duration: 240, rating: 4.6, reviewCount: 87, enrolled: 234, progress: 100, thumbnail: 'bg-gradient-to-br from-green-500 to-teal-600', tags: ['documents', 'workflows'] },
  { id: '3', title: 'Security & Compliance Essentials', description: 'Deep dive into RBAC, audit logs, encryption, and compliance best practices.', instructor: 'Carol Johnson', level: 'Intermediate', category: 'Security', duration: 300, rating: 4.9, reviewCount: 56, enrolled: 189, thumbnail: 'bg-gradient-to-br from-red-500 to-orange-600', tags: ['security', 'compliance'] },
  { id: '4', title: 'Calendar & Scheduling Mastery', description: 'Leverage the full power of SignApps Calendar for team coordination and resource booking.', instructor: 'Dave Lee', level: 'Beginner', category: 'Productivity', duration: 120, rating: 4.5, reviewCount: 43, enrolled: 312, thumbnail: 'bg-gradient-to-br from-yellow-500 to-amber-600', tags: ['calendar', 'scheduling'] },
  { id: '5', title: 'API Integration & Automation', description: 'Build powerful integrations using the SignApps REST API and webhook system.', instructor: 'Eve Park', level: 'Advanced', category: 'Development', duration: 480, rating: 4.7, reviewCount: 31, enrolled: 78, thumbnail: 'bg-gradient-to-br from-indigo-500 to-blue-600', tags: ['api', 'automation', 'development'] },
  { id: '6', title: 'HR & People Management', description: 'Use SignApps Workforce for org charts, employee management, and HR workflows.', instructor: 'Frank White', level: 'Intermediate', category: 'HR', duration: 200, rating: 4.4, reviewCount: 67, enrolled: 143, thumbnail: 'bg-gradient-to-br from-pink-500 to-rose-600', tags: ['hr', 'workforce'] },
];

const CATEGORIES = ['All', 'Platform', 'Documents', 'Security', 'Productivity', 'Development', 'HR'];
const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const levelColors = { Beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', Intermediate: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', Advanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };

export default function CourseCatalogPage() {
  usePageTitle('Catalogue formations');
  const { data: courses = COURSES } = useQuery<Course[]>({
    queryKey: ['lms-catalog'],
    queryFn: () => fetch('/api/lms/courses').then(r => r.json()).catch(() => COURSES),
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [level, setLevel] = useState('All');

  const filtered = courses.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()) || c.tags.some(t => t.includes(search.toLowerCase()));
    const matchCat = category === 'All' || c.category === category;
    const matchLevel = level === 'All' || c.level === level;
    return matchSearch && matchCat && matchLevel;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Course Catalog</h1>
            <p className="text-sm text-muted-foreground">Browse and enroll in learning courses</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Filter className="h-4 w-4 text-muted-foreground self-center" />
            {CATEGORIES.map(c => <Button key={c} variant={category === c ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c)}>{c}</Button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => <Button key={l} variant={level === l ? 'default' : 'outline'} size="sm" onClick={() => setLevel(l)}>{l}</Button>)}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">{filtered.length} course{filtered.length !== 1 ? 's' : ''} found</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(course => (
            <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow group">
              <div className={cn('h-32 relative', course.thumbnail)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-white/70" />
                </div>
                <div className="absolute top-2 right-2">
                  <Badge className={cn('text-xs', levelColors[course.level])}>{course.level}</Badge>
                </div>
                {course.progress !== undefined && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-card/20">
                    <div className="h-full bg-card/80 transition-all" style={{ width: `${course.progress}%` }} />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Badge variant="outline" className="text-xs mb-1">{course.category}</Badge>
                  <h3 className="font-semibold text-sm leading-tight">{course.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{course.description}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{course.rating} ({course.reviewCount})</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(course.duration / 60)}h</span>
                  <span className="flex items-center gap-1 ml-auto"><Users className="h-3 w-3" />{course.enrolled}</span>
                </div>
                {course.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progress</span><span>{course.progress}%</span></div>
                    <Progress value={course.progress} className="h-1" />
                  </div>
                )}
                <Button size="sm" className="w-full" asChild>
                  <Link href={`/lms/courses/${course.id}`}>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    {course.progress === undefined ? 'Enroll' : course.progress === 100 ? 'Review' : 'Continue'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><BookOpen className="h-8 w-8 mb-2 opacity-30" /><p>No courses match your search</p></CardContent></Card>
        )}
      </div>
    </AppLayout>
  );
}
