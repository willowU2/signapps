'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Trophy, Clock, BookOpen, Target, Award, Users, Star } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/use-page-title';

const WEEKLY_DATA = [
  { week: 'W10', hours: 2.5, courses: 1 },
  { week: 'W11', hours: 4.0, courses: 2 },
  { week: 'W12', hours: 1.5, courses: 0 },
  { week: 'W13', hours: 6.0, courses: 3 },
];

const STUDENT_DATA = [
  { name: 'Alice M.', initials: 'AM', completed: 5, inProgress: 2, hours: 24, avgScore: 91 },
  { name: 'Bob K.', initials: 'BK', completed: 3, inProgress: 1, hours: 16, avgScore: 85 },
  { name: 'Carol P.', initials: 'CP', completed: 7, inProgress: 0, hours: 38, avgScore: 94 },
  { name: 'Dave L.', initials: 'DL', completed: 1, inProgress: 3, hours: 8, avgScore: 78 },
  { name: 'Eve S.', initials: 'ES', completed: 4, inProgress: 1, hours: 20, avgScore: 88 },
];

const COURSE_STATS = [
  { title: 'Intro to SignApps', enrolled: 456, completed: 234, avgScore: 88, rating: 4.8 },
  { title: 'Advanced Docs', enrolled: 234, completed: 189, avgScore: 85, rating: 4.6 },
  { title: 'Security Essentials', enrolled: 189, completed: 98, avgScore: 91, rating: 4.9 },
  { title: 'Calendar Mastery', enrolled: 312, completed: 156, avgScore: 82, rating: 4.5 },
];

export default function LMSProgressPage() {
  usePageTitle('Progression');
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Learning Progress Dashboard</h1>
            <p className="text-sm text-muted-foreground">Completion rates, scores, and engagement metrics</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Completions', value: '247', icon: Trophy, color: 'text-yellow-500' },
            { label: 'Active Learners', value: '89', icon: Users, color: 'text-blue-500' },
            { label: 'Avg Completion Rate', value: '73%', icon: Target, color: 'text-green-500' },
            { label: 'Avg Score', value: '87%', icon: Star, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${color}`} />
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Learning Hours per Week</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={WEEKLY_DATA}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="hours" fill="hsl(var(--primary))" radius={4} /></BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Courses Completed per Week</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={WEEKLY_DATA}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="courses" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">My Learning Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Intro to SignApps', progress: 100, score: 94 },
                    { label: 'Advanced Documents', progress: 100, score: 87 },
                    { label: 'Team Collaboration', progress: 60 },
                    { label: 'Security Essentials', progress: 0 },
                  ].map(({ label, progress, score }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate">{label}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {score ? `${score}% score` : progress === 0 ? 'Not started' : `${progress}%`}
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Achievements</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { title: 'Fast Learner', desc: 'Completed 3 courses in one week', icon: '⚡' },
                    { title: 'Perfect Score', desc: 'Scored 100% on Security quiz', icon: '🎯' },
                    { title: 'First Course', desc: 'Completed your first course', icon: '🎓' },
                    { title: 'Team Player', desc: 'Shared notes with 5 colleagues', icon: '🤝' },
                  ].map(a => (
                    <div key={a.title} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">{a.icon}</div>
                      <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.desc}</p></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-4 text-left font-medium">Student</th><th className="p-4 text-right font-medium">Completed</th><th className="p-4 text-right font-medium">In Progress</th><th className="p-4 text-right font-medium">Hours</th><th className="p-4 text-right font-medium">Avg Score</th></tr></thead>
                    <tbody>
                      {STUDENT_DATA.map(s => (
                        <tr key={s.name} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4"><div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{s.initials}</AvatarFallback></Avatar>{s.name}</div></td>
                          <td className="p-4 text-right"><Badge variant="secondary">{s.completed}</Badge></td>
                          <td className="p-4 text-right">{s.inProgress}</td>
                          <td className="p-4 text-right flex items-center justify-end gap-1"><Clock className="h-3 w-3 text-muted-foreground" />{s.hours}h</td>
                          <td className="p-4 text-right"><span className={s.avgScore >= 90 ? 'text-green-600 font-bold' : s.avgScore >= 80 ? 'text-blue-600' : 'text-orange-600'}>{s.avgScore}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="mt-4 space-y-3">
            {COURSE_STATS.map(c => {
              const rate = Math.round((c.completed / c.enrolled) * 100);
              return (
                <Card key={c.title}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <h3 className="font-medium">{c.title}</h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-yellow-600"><Star className="h-3.5 w-3.5 fill-current" />{c.rating}</span>
                        <span className="text-muted-foreground">{c.enrolled} enrolled</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Completion Rate</p>
                        <Progress value={rate} className="h-2" />
                        <p className="text-xs mt-1">{c.completed}/{c.enrolled} ({rate}%)</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                        <Progress value={c.avgScore} className="h-2" />
                        <p className="text-xs mt-1">{c.avgScore}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
