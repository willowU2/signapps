'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

interface ICTRisk {
  id: string;
  component: string;
  rto: number; // minutes
  rpo: number; // minutes
  lastTest: string;
  status: 'pass' | 'fail' | 'pending';
}

export default function DORAResilience() {
  const [risks] = useState<ICTRisk[]>([
    {
      id: '1',
      component: 'Authentication Service',
      rto: 15,
      rpo: 5,
      lastTest: '2024-03-15',
      status: 'pass',
    },
    {
      id: '2',
      component: 'Database Primary',
      rto: 30,
      rpo: 10,
      lastTest: '2024-03-10',
      status: 'pass',
    },
    {
      id: '3',
      component: 'API Gateway',
      rto: 5,
      rpo: 1,
      lastTest: '2024-03-08',
      status: 'fail',
    },
    {
      id: '4',
      component: 'File Storage',
      rto: 60,
      rpo: 30,
      lastTest: '2024-03-12',
      status: 'pending',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-emerald-100 text-emerald-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          DORA ICT Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold text-gray-600 uppercase">
                <th className="text-left py-2 px-2">Component</th>
                <th className="text-right py-2 px-2">RTO</th>
                <th className="text-right py-2 px-2">RPO</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2 font-medium text-gray-900">{risk.component}</td>
                  <td className="py-3 px-2 text-right text-gray-600">{risk.rto}m</td>
                  <td className="py-3 px-2 text-right text-gray-600">{risk.rpo}m</td>
                  <td className="py-3 px-2">
                    <Badge className={getStatusColor(risk.status)}>
                      {risk.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Last comprehensive test: <strong>2024-03-15</strong>
        </p>
      </CardContent>
    </Card>
  );
}
