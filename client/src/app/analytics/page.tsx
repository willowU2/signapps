'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useQuery } from '@tanstack/react-query';
import { schedulerMetricsApi as metricsApi } from '@/lib/api/metrics';
import { Skeleton } from '@/components/ui/skeleton';
import { CardGridSkeleton } from '@/components/ui/skeleton-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Calendar, Target, Clock, AlertTriangle, BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { data: workload, isLoading: workloadLoading, isError: workloadError } = useQuery({
    queryKey: ['metrics', 'workload'],
    queryFn: () => metricsApi.getWorkload(),
    retry: 1,
  });

  const { data: resources, isLoading: resourcesLoading, isError: resourcesError } = useQuery({
    queryKey: ['metrics', 'resources'],
    queryFn: () => metricsApi.getResources(),
    retry: 1,
  });

  const isLoading = (workloadLoading && !workloadError) || (resourcesLoading && !resourcesError);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Analytics</h1>
          <p className="text-muted-foreground mb-8">Loading your metrics...</p>
          <CardGridSkeleton count={4} />
          <Skeleton className="h-64 w-full rounded-2xl mt-4" />
        </div>
      </AppLayout>
    );
  }

  // Show empty state when API is unavailable
  if (workloadError && resourcesError) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Supervisez votre charge de travail et l&apos;utilisation des ressources.
            </p>
          </div>
          <Card className="border border-border/50 bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{"Donn\u00e9es non disponibles"}</h3>
              <p className="text-sm text-muted-foreground">
                {"Le service d'analytics n'est pas disponible pour le moment."}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Prepare Data for Charts
  const workloadData = [
    { name: 'En Attente', value: workload?.pending || 0, color: '#94a3b8' },
    { name: 'En Cours', value: workload?.in_progress || 0, color: '#3b82f6' },
    { name: 'Terminé', value: workload?.completed || 0, color: '#22c55e' },
    { name: 'Bloqué', value: workload?.blocked || 0, color: '#ef4444' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Supervisez votre charge de travail et l'utilisation des ressources.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/50 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tâches Totales</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workload?.total_tasks || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Actives sur la plateforme</p>
            </CardContent>
          </Card>
          
          <Card className="border border-border/50 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tâches Terminées</CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workload?.completed || 0}</div>
              <div className="w-full bg-secondary h-2 mt-2 rounded-full overflow-hidden">
                <div 
                  className="bg-green-500 h-full" 
                  style={{ width: `${workload?.total_tasks ? ((workload.completed / workload.total_tasks) * 100) : 0}%` }} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Réservations</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resources?.total_bookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Pour {resources?.hours_booked || 0} heures cumulées</p>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Points de blocage</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{workload?.blocked || 0}</div>
              <p className="text-xs text-muted-foreground mt-1 text-destructive/80">Nécessitent une action</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Workload Status Bar Chart */}
          <Card className="border border-border/50 shadow-sm col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Distribution de la Charge (Bar)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {workloadData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Workload Status Pie Chart */}
          <Card className="border border-border/50 shadow-sm col-span-1">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Répartition des Statuts (Pie)</CardTitle>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  />
                  <Pie
                    data={workloadData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {workloadData.map((entry, index) => (
                      <Cell key={`cell-pie-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
