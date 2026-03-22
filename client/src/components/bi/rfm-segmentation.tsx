'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface RFMSegment {
  name: string;
  color: string;
  customers: number;
  avgSpend: number;
  description: string;
}

export default function RFMSegmentation() {
  const segments: RFMSegment[] = [
    {
      name: 'Champions',
      color: 'bg-emerald-500',
      customers: 245,
      avgSpend: 8500,
      description: 'High R, F, M',
    },
    {
      name: 'Loyal Customers',
      color: 'bg-blue-500',
      customers: 512,
      avgSpend: 5200,
      description: 'High F, M',
    },
    {
      name: 'At Risk',
      color: 'bg-amber-500',
      customers: 318,
      avgSpend: 3100,
      description: 'Low R, high F, M',
    },
    {
      name: 'Lost Customers',
      color: 'bg-red-500',
      customers: 164,
      avgSpend: 1200,
      description: 'Very low R, F, M',
    },
    {
      name: 'Potential Loyalists',
      color: 'bg-indigo-500',
      customers: 389,
      avgSpend: 4100,
      description: 'Recent, good spend',
    },
    {
      name: 'New Customers',
      color: 'bg-pink-500',
      customers: 156,
      avgSpend: 2400,
      description: 'High R, low F, M',
    },
  ];

  const total = segments.reduce((sum, s) => sum + s.customers, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          RFM Customer Segmentation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Grid */}
          <div className="grid grid-cols-2 gap-3">
            {segments.map((segment, idx) => {
              const percentage = ((segment.customers / total) * 100).toFixed(1);
              return (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-start gap-2">
                    <div className={`w-3 h-3 rounded-full ${segment.color} flex-shrink-0 mt-1`}></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-gray-900">{segment.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{segment.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {segment.customers}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          ${(segment.avgSpend / 1000).toFixed(1)}k
                        </Badge>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${segment.color}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{percentage}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="pt-3 border-t">
            <p className="text-xs text-gray-600">
              <strong>{total.toLocaleString()}</strong> total customers across <strong>6</strong> segments
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
