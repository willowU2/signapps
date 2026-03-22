'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Play, Clock, CheckCircle2, Loader2 } from 'lucide-react'

interface Module {
  id: string
  title: string
  duration: number // minutes
  completed: boolean
}

interface Course {
  id: string
  title: string
  description: string
  progress: number // 0-100
  status: 'not-started' | 'in-progress' | 'completed'
  modules: Module[]
  instructor: string
}

export function CourseViewer() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)

  useEffect(() => {
    // Mock data - replace with API call
    const mockCourses: Course[] = [
      {
        id: '1',
        title: 'Introduction to SignApps',
        description: 'Get started with SignApps Platform fundamentals',
        progress: 65,
        status: 'in-progress',
        instructor: 'John Smith',
        modules: [
          { id: '1-1', title: 'Getting Started', duration: 15, completed: true },
          { id: '1-2', title: 'Dashboard Overview', duration: 20, completed: true },
          { id: '1-3', title: 'User Management', duration: 25, completed: false },
          { id: '1-4', title: 'Security Best Practices', duration: 30, completed: false },
        ],
      },
      {
        id: '2',
        title: 'Advanced Document Management',
        description: 'Master document workflows and collaboration',
        progress: 30,
        status: 'in-progress',
        instructor: 'Sarah Johnson',
        modules: [
          { id: '2-1', title: 'Document Basics', duration: 20, completed: true },
          { id: '2-2', title: 'Workflow Creation', duration: 40, completed: false },
          { id: '2-3', title: 'Approvals & Signatures', duration: 35, completed: false },
        ],
      },
      {
        id: '3',
        title: 'Compliance & Data Security',
        description: 'Ensure your organization meets regulatory requirements',
        progress: 100,
        status: 'completed',
        instructor: 'Michael Chen',
        modules: [
          { id: '3-1', title: 'GDPR Essentials', duration: 30, completed: true },
          { id: '3-2', title: 'Data Retention Policies', duration: 25, completed: true },
          { id: '3-3', title: 'Audit Trails', duration: 20, completed: true },
        ],
      },
    ]

    setCourses(mockCourses)
    setLoading(false)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateTotalDuration = (modules: Module[]) => {
    return modules.reduce((sum, m) => sum + m.duration, 0)
  }

  const calculateCompletedModules = (modules: Module[]) => {
    return modules.filter((m) => m.completed).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
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
                  <Badge className={`${getStatusColor(course.status)} capitalize`}>
                    {course.status === 'in-progress' ? 'In Progress' : course.status}
                  </Badge>
                </div>
                <CardDescription>{course.description}</CardDescription>
                <p className="text-xs text-muted-foreground mt-2">Instructor: {course.instructor}</p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {calculateCompletedModules(course.modules)} of {course.modules.length} modules completed
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
                  <div key={module.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50">
                    {module.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Play className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${module.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {module.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{module.duration}m</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                {course.status === 'completed' ? (
                  <Button className="flex-1" variant="outline">
                    Review Course
                  </Button>
                ) : (
                  <>
                    <Button className="flex-1">
                      {course.status === 'not-started' ? 'Start Course' : 'Resume Course'}
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
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
              >
                {expandedCourse === course.id ? 'Hide Modules' : 'Show Modules'}
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
  )
}
