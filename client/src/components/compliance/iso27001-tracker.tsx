'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck } from 'lucide-react';

interface Control {
  id: string;
  code: string;
  name: string;
  maturity: number; // 0-5
  implemented: boolean;
}

export default function ISO27001Tracker() {
  const [controls, setControls] = useState<Control[]>([
    { id: '1', code: 'A.5.1', name: 'Access Control Policy', maturity: 4, implemented: true },
    { id: '2', code: 'A.5.2', name: 'User Registration', maturity: 3, implemented: true },
    { id: '3', code: 'A.5.3', name: 'Privileged Access', maturity: 5, implemented: true },
    { id: '4', code: 'A.6.1', name: 'Information Security Policy', maturity: 2, implemented: false },
    { id: '5', code: 'A.6.2', name: 'Security Awareness', maturity: 3, implemented: true },
    { id: '6', code: 'A.7.1', name: 'Incident Response', maturity: 4, implemented: true },
  ]);

  const toggleImplemented = (id: string) => {
    setControls(
      controls.map((control) =>
        control.id === id ? { ...control, implemented: !control.implemented } : control
      )
    );
  };

  const getMaturityColor = (maturity: number) => {
    const colors = ['bg-gray-100', 'bg-red-100', 'bg-amber-100', 'bg-blue-100', 'bg-lime-100', 'bg-emerald-100'];
    return colors[maturity] || colors[0];
  };

  const avgMaturity = (controls.reduce((sum, c) => sum + c.maturity, 0) / controls.length).toFixed(1);
  const implementedCount = controls.filter((c) => c.implemented).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            ISO 27001 Annex A
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{avgMaturity}</p>
            <p className="text-xs text-gray-500">Avg Maturity</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {controls.map((control) => (
            <div key={control.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
              <Checkbox
                checked={control.implemented}
                onCheckedChange={() => toggleImplemented(control.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{control.code}</p>
                <p className="text-xs text-gray-600">{control.name}</p>
              </div>
              <Badge className={`${getMaturityColor(control.maturity)} text-xs whitespace-nowrap`}>
                L{control.maturity}
              </Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t text-xs text-gray-600">
          <p>
            {implementedCount}/{controls.length} controls implemented
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
