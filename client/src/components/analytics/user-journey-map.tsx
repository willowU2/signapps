'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Map, Users } from 'lucide-react';

interface JourneyStep {
  page: string;
  visits: number;
  dropoff: number;
}

interface JourneyPath {
  id: string;
  label: string;
  users: number;
  steps: JourneyStep[];
}

const PATHS: JourneyPath[] = [
  {
    id: '1', label: 'Onboarding Path', users: 1240,
    steps: [
      { page: '/login', visits: 1240, dropoff: 2 },
      { page: '/dashboard', visits: 1215, dropoff: 8 },
      { page: '/settings/profile', visits: 1118, dropoff: 15 },
      { page: '/drive', visits: 950, dropoff: 20 },
      { page: '/docs', visits: 760, dropoff: 12 },
    ],
  },
  {
    id: '2', label: 'Admin Path', users: 180,
    steps: [
      { page: '/admin', visits: 180, dropoff: 5 },
      { page: '/admin/users', visits: 171, dropoff: 10 },
      { page: '/admin/settings', visits: 154, dropoff: 8 },
      { page: '/admin/audit', visits: 142, dropoff: 20 },
      { page: '/admin/security', visits: 114, dropoff: 0 },
    ],
  },
];

export function UserJourneyMap() {
  const [selected, setSelected] = useState('1');
  const path = PATHS.find(p => p.id === selected)!;
  const maxVisits = path.steps[0].visits;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Map className="h-5 w-5" />
        <h2 className="text-xl font-semibold">User Journey Map</h2>
        <div className="flex gap-2 ml-4">
          {PATHS.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${selected === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> {path.label}
            <Badge variant="secondary">{path.users.toLocaleString()} users</Badge>
          </CardTitle>
          <CardDescription>Most common navigation sequence for this user segment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-0 overflow-x-auto pb-4">
            {path.steps.map((step, i) => {
              const pct = (step.visits / maxVisits) * 100;
              const isLast = i === path.steps.length - 1;
              return (
                <div key={step.page} className="flex items-center gap-0 shrink-0">
                  <div className="flex flex-col items-center gap-2 w-36">
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="border rounded-lg p-3 w-full text-center bg-card hover:bg-accent/50 transition-colors">
                      <p className="text-xs font-mono text-muted-foreground truncate" title={step.page}>{step.page}</p>
                      <p className="text-lg font-bold mt-1">{step.visits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">visits</p>
                      {!isLast && step.dropoff > 0 && (
                        <Badge variant="destructive" className="text-xs mt-1">-{step.dropoff}%</Badge>
                      )}
                    </div>
                  </div>
                  {!isLast && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Entry Users</p>
              <p className="text-2xl font-bold">{path.steps[0].visits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed Journey</p>
              <p className="text-2xl font-bold">{path.steps[path.steps.length - 1].visits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overall Retention</p>
              <p className="text-2xl font-bold">
                {((path.steps[path.steps.length - 1].visits / path.steps[0].visits) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserJourneyMap;
