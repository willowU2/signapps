'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResourceGauge } from '@/components/dashboard/resource-gauge';
import { Cpu, MemoryStick, Database, Server } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useServiceHealth, ServiceHealth } from '@/hooks/use-service-health';

export function WidgetSystemHealth() {
  const { data: dashboardData } = useDashboardData();
  const { data: services = [] } = useServiceHealth();

  const onlineCount = services.filter((s) => s.status === 'online').length;
  const totalCount = services.length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          System Health
        </CardTitle>
        <Badge variant="outline" className="gap-1">
          <div className={`h-2 w-2 rounded-full ${onlineCount === totalCount ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          {onlineCount}/{totalCount} Online
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cpu className="h-4 w-4" />
              CPU Usage
            </div>
            <ResourceGauge label="" value={dashboardData?.cpu || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.cpu || 0}%</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MemoryStick className="h-4 w-4" />
              Memory
            </div>
            <ResourceGauge label="" value={dashboardData?.memory || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.memory || 0}%</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              Disk
            </div>
            <ResourceGauge label="" value={dashboardData?.disk || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.disk || 0}%</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Services Status</h4>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {services.map((service: ServiceHealth) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <span className="text-sm">{service.name}</span>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${service.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">:{service.port}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
