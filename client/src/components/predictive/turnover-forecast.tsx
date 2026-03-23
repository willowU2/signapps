import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

interface AtRiskEmployee {
  id: string;
  name: string;
  department: string;
  riskScore: number;
  daysUntilLeave: number;
}

interface DepartmentRisk {
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  retentionScore: number;
}

export const TurnoverForecast: React.FC = () => {
  const departments: DepartmentRisk[] = [
    { name: 'Engineering', riskLevel: 'high', retentionScore: 62 },
    { name: 'Sales', riskLevel: 'medium', retentionScore: 74 },
    { name: 'HR', riskLevel: 'low', retentionScore: 88 },
    { name: 'Finance', riskLevel: 'medium', retentionScore: 79 },
  ];

  const atRiskEmployees: AtRiskEmployee[] = [
    { id: '1', name: 'Alice Johnson', department: 'Engineering', riskScore: 92, daysUntilLeave: 14 },
    { id: '2', name: 'Bob Smith', department: 'Engineering', riskScore: 87, daysUntilLeave: 28 },
    { id: '3', name: 'Carol Davis', department: 'Sales', riskScore: 76, daysUntilLeave: 45 },
  ];

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-red-500" />
        Turnover Forecast
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {departments.map((dept) => (
          <div key={dept.name} className="p-4 border rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700">{dept.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(dept.riskLevel)}`}>
                {dept.riskLevel.toUpperCase()}
              </span>
              <span className="text-lg font-bold text-gray-900">{dept.retentionScore}%</span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${dept.retentionScore}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          At-Risk Employees
        </h3>
        <div className="space-y-2">
          {atRiskEmployees.map((emp) => (
            <div key={emp.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{emp.name}</p>
                  <p className="text-xs text-gray-600">{emp.department}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-600">{emp.riskScore}% risk</span>
                  <p className="text-xs text-gray-600">{emp.daysUntilLeave}d alert window</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
