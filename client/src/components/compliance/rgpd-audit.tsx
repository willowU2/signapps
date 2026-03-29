'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';

interface DataFlow {
  id: string;
  source: string;
  processor: string;
  destination: string;
  dataType: string;
  risk: 'low' | 'medium' | 'high';
}

export default function RGPDAudit() {
  const [dataFlows] = useState<DataFlow[]>([
    {
      id: '1',
      source: 'Customer Portal',
      processor: 'Auth Service',
      destination: 'PostgreSQL',
      dataType: 'Personal Data',
      risk: 'low',
    },
    {
      id: '2',
      source: 'Mobile App',
      processor: 'API Gateway',
      destination: 'Data Lake',
      dataType: 'Behavioral Data',
      risk: 'medium',
    },
    {
      id: '3',
      source: 'External Partners',
      processor: 'Integration Hub',
      destination: 'CRM',
      dataType: 'Contact Info',
      risk: 'high',
    },
    {
      id: '4',
      source: 'Analytics Service',
      processor: 'ML Pipeline',
      destination: 'Data Warehouse',
      dataType: 'Usage Metrics',
      risk: 'low',
    },
  ]);

  const complianceScore = 78;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-emerald-100 text-emerald-800';
      case 'medium':
        return 'bg-amber-100 text-amber-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            RGPD Data Flows
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{complianceScore}%</p>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </div>
            <div className="relative w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
              <div
                className="absolute inset-1 rounded-full bg-blue-500"
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((complianceScore / 100) * 2 * Math.PI - Math.PI / 2)}% ${50 + 50 * Math.sin((complianceScore / 100) * 2 * Math.PI - Math.PI / 2)}%)`,
                }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dataFlows.map((flow) => (
            <div key={flow.id} className="p-3 border border-border rounded-lg hover:bg-muted">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {flow.source} → {flow.destination}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{flow.dataType}</p>
                </div>
                <Badge className={getRiskColor(flow.risk)}>{flow.risk.toUpperCase()}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Processor: {flow.processor}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
