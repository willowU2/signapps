'use client';

import { CapabilityDashboard } from '@/components/ai/capability-dashboard';
import { GpuMonitor } from '@/components/ai/gpu-monitor';
import { QualityAdvisor } from '@/components/ai/quality-advisor';
import { ConversationHistory } from '@/components/ai/conversation-history';

export default function AiDashboardPage() {
  return (
    <div className="container max-w-7xl py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Dashboard</h1>
        <p className="text-muted-foreground">
          Moniteur de capacites, GPU et historique de conversations
        </p>
      </div>

      {/* GPU Monitor — live status on top */}
      <GpuMonitor />

      {/* Capability grid */}
      <CapabilityDashboard />

      {/* Two-column bottom: Quality Advisor + Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QualityAdvisor />
        <ConversationHistory />
      </div>
    </div>
  );
}
