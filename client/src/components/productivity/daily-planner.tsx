'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'done' | 'blocked';
}

interface TimeBlock {
  id: string;
  time: string;
  task: string;
  duration: number;
}

export default function DailyPlanner() {
  const [topTasks, setTopTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Finalize Q2 budget proposal',
      time: '9:00 - 10:30',
      priority: 'high',
      status: 'pending',
    },
    {
      id: '2',
      title: 'Review team performance reviews',
      time: '10:30 - 11:30',
      priority: 'high',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Client presentation prep',
      time: '1:00 - 3:00',
      priority: 'medium',
      status: 'pending',
    },
  ]);

  const [timeBlocks] = useState<TimeBlock[]>([
    { id: '1', time: '9:00', task: 'Planning & Deep Work', duration: 90 },
    { id: '2', time: '10:30', task: 'Meetings & Sync', duration: 60 },
    { id: '3', time: '11:30', task: 'Break & Lunch', duration: 90 },
    { id: '4', time: '1:00', task: 'Presentation Prep', duration: 120 },
    { id: '5', time: '3:00', task: 'Admin & Email', duration: 120 },
  ]);

  const toggleTaskStatus = (id: string, newStatus: Task['status']) => {
    setTopTasks(
      topTasks.map((task) => (task.id === id ? { ...task, status: newStatus } : task))
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-amber-600 bg-amber-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle className="w-5 h-5 text-emerald-600" />;
    if (status === 'blocked') return <AlertCircle className="w-5 h-5 text-red-600" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Today's Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top 3 Tasks */}
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-3">Top 3 Tasks</h3>
          <div className="space-y-2">
            {topTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-lg border transition ${
                  task.status === 'done'
                    ? 'bg-emerald-50 border-emerald-200'
                    : task.status === 'blocked'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-card border-border hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{task.time}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex gap-2 mt-3 ml-8">
                  <Button
                    size="xs"
                    variant={task.status === 'done' ? 'default' : 'outline'}
                    onClick={() => toggleTaskStatus(task.id, 'done')}
                    className="text-xs"
                  >
                    ✓ Done
                  </Button>
                  <Button
                    size="xs"
                    variant={task.status === 'blocked' ? 'destructive' : 'outline'}
                    onClick={() => toggleTaskStatus(task.id, 'blocked')}
                    className="text-xs"
                  >
                    ⚠ Blocked
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Blocks */}
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-3">Time Blocks</h3>
          <div className="space-y-2">
            {timeBlocks.map((block) => (
              <div key={block.id} className="flex items-center gap-3 p-2 bg-muted rounded border border-border">
                <div className="text-xs font-semibold text-muted-foreground w-12">{block.time}</div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{block.task}</p>
                </div>
                <div className="text-xs text-muted-foreground">{block.duration}m</div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t text-xs text-muted-foreground">
          <p>
            Progress: {topTasks.filter((t) => t.status === 'done').length}/{topTasks.length} tasks completed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
