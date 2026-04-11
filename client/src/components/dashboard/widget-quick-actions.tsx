'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Network, Upload, Bot, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const actions = [
  {
    title: 'New Container',
    description: 'Deploy a new docker service',
    icon: Plus,
    href: '/containers',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'group-hover:border-blue-500/30',
    gradient: 'from-blue-500/10 to-transparent',
  },
  {
    title: 'Add Route',
    description: 'Configure network routing',
    icon: Network,
    href: '/routes',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'group-hover:border-emerald-500/30',
    gradient: 'from-emerald-500/10 to-transparent',
  },
  {
    title: 'Upload Files',
    description: 'Store new objects in bucket',
    icon: Upload,
    href: '/storage',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'group-hover:border-orange-500/30',
    gradient: 'from-orange-500/10 to-transparent',
  },
  {
    title: 'AI Assistant',
    description: 'Chat with your AI partner',
    icon: Bot,
    href: '/ai',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'group-hover:border-purple-500/30',
    gradient: 'from-purple-500/10 to-transparent',
  },
];

export function WidgetQuickActions() {
  return (
    <Card className="h-full flex flex-col overflow-hidden border-border/50 bg-gradient-to-br from-background to-muted/20 relative shadow-sm">
      <div className="absolute inset-0 bg-grid-white/5 opacity-[0.02] pointer-events-none" />
      <CardHeader className="pb-4 relative z-10 shrink-0">
        <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          Quick Actions
        </CardTitle>
        <CardDescription className="text-xs">
          Raccourcis vers vos outils majeurs
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 overflow-y-auto min-h-0 pb-6 [scrollbar-width:thin]">
        {actions.map((action, i) => (
          <Link 
            href={action.href} 
            key={i} 
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
          >
            <div className={`relative h-full flex flex-col justify-between space-y-3 rounded-xl border border-border/40 bg-background/50 p-4 transition-all duration-500 hover:shadow-md ${action.borderColor} overflow-hidden`}>
              {/* Background gradient fade on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none z-0`} />
              
              <div className="relative z-10 flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${action.bgColor} ${action.color} group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 ease-out shadow-sm`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 border border-border/50 shadow-sm">
                  <ArrowRight className="h-3 w-3 text-foreground" />
                </div>
              </div>
              
              <div className="relative z-10 space-y-0.5">
                <h3 className="font-semibold text-sm tracking-tight text-foreground transition-colors">{action.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{action.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
