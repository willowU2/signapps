'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, ArrowRight, Database, Globe, MessageSquare, Mail, Calendar, FileText, Shield, HardDrive, Container, Cpu, Video, Users } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

interface ServiceNode {
  id: string;
  label: string;
  port: number;
  icon: React.ReactNode;
  deps: string[];
  category: 'core' | 'productivity' | 'infra' | 'communication';
}

const SERVICES: ServiceNode[] = [
  { id: 'identity', label: 'Identity', port: 3001, icon: <Shield className="h-4 w-4" />, deps: [], category: 'core' },
  { id: 'storage', label: 'Storage', port: 3004, icon: <HardDrive className="h-4 w-4" />, deps: ['identity'], category: 'core' },
  { id: 'gateway', label: 'Gateway', port: 3000, icon: <Globe className="h-4 w-4" />, deps: ['identity'], category: 'core' },
  { id: 'mail', label: 'Mail', port: 3012, icon: <Mail className="h-4 w-4" />, deps: ['identity', 'storage', 'contacts'], category: 'communication' },
  { id: 'calendar', label: 'Calendar', port: 3011, icon: <Calendar className="h-4 w-4" />, deps: ['identity'], category: 'productivity' },
  { id: 'contacts', label: 'Contacts', port: 3021, icon: <Users className="h-4 w-4" />, deps: ['identity'], category: 'productivity' },
  { id: 'docs', label: 'Docs', port: 3010, icon: <FileText className="h-4 w-4" />, deps: ['identity', 'storage', 'collab'], category: 'productivity' },
  { id: 'collab', label: 'Collab', port: 3013, icon: <MessageSquare className="h-4 w-4" />, deps: ['identity'], category: 'communication' },
  { id: 'scheduler', label: 'Scheduler', port: 3007, icon: <Cpu className="h-4 w-4" />, deps: ['identity'], category: 'core' },
  { id: 'containers', label: 'Containers', port: 3002, icon: <Container className="h-4 w-4" />, deps: ['identity', 'storage'], category: 'infra' },
  { id: 'ai', label: 'AI', port: 3005, icon: <Cpu className="h-4 w-4" />, deps: ['identity', 'storage'], category: 'core' },
  { id: 'metrics', label: 'Metrics', port: 3008, icon: <Database className="h-4 w-4" />, deps: ['identity'], category: 'infra' },
  { id: 'meet', label: 'Meet', port: 3014, icon: <Video className="h-4 w-4" />, deps: ['identity', 'collab'], category: 'communication' },
  { id: 'chat', label: 'Chat', port: 3020, icon: <MessageSquare className="h-4 w-4" />, deps: ['identity', 'collab'], category: 'communication' },
];

const CATEGORY_COLORS = {
  core: 'border-blue-500/30 bg-blue-500/5',
  productivity: 'border-green-500/30 bg-green-500/5',
  infra: 'border-orange-500/30 bg-orange-500/5',
  communication: 'border-purple-500/30 bg-purple-500/5',
};

const CATEGORY_LABELS = {
  core: { label: 'Core', color: 'bg-blue-500/10 text-blue-600' },
  productivity: { label: 'Productivité', color: 'bg-green-500/10 text-green-600' },
  infra: { label: 'Infrastructure', color: 'bg-orange-500/10 text-orange-600' },
  communication: { label: 'Communication', color: 'bg-purple-500/10 text-purple-600' },
};

export default function ServiceGraphPage() {
  usePageTitle('Services');
  const categories = ['core', 'productivity', 'communication', 'infra'] as const;

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          <Network className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Architecture Services</h1>
            <p className="text-sm text-muted-foreground">Graphe de dépendances des microservices SignApps</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 flex-wrap">
          {categories.map((cat) => (
            <Badge key={cat} className={CATEGORY_LABELS[cat].color}>{CATEGORY_LABELS[cat].label}</Badge>
          ))}
        </div>

        {/* Grid by category */}
        {categories.map((cat) => {
          const services = SERVICES.filter(s => s.category === cat);
          if (services.length === 0) return null;

          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {CATEGORY_LABELS[cat].label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((svc) => (
                  <Card key={svc.id} className={`${CATEGORY_COLORS[cat]} transition-shadow hover:shadow-md`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        {svc.icon}
                        <span className="font-semibold">{svc.label}</span>
                        <span className="text-xs font-mono text-muted-foreground ml-auto">:{svc.port}</span>
                      </div>
                      {svc.deps.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {svc.deps.map((dep) => (
                            <Badge key={dep} variant="outline" className="text-[10px] h-5">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Dependency matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matrice de dépendances</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Service</th>
                  {SERVICES.map(s => (
                    <th key={s.id} className="px-2 py-1 text-center font-medium writing-mode-vertical" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SERVICES.map(svc => (
                  <tr key={svc.id} className="border-t">
                    <td className="px-2 py-1 font-medium">{svc.label}</td>
                    {SERVICES.map(target => (
                      <td key={target.id} className="px-2 py-1 text-center">
                        {svc.deps.includes(target.id) ? (
                          <div className="h-3 w-3 rounded-full bg-primary mx-auto" />
                        ) : svc.id === target.id ? (
                          <div className="h-3 w-3 rounded-full bg-muted mx-auto" />
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
