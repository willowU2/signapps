import React from 'react';
import { TrendingUp, Target } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  company: string;
  aiScore: number;
  conversionProbability: number;
  priority: 'hot' | 'warm' | 'cold';
}

export const LeadScoring: React.FC = () => {
  const leads: Lead[] = [
    {
      id: '1',
      name: 'John Enterprises',
      company: 'Tech Corp Ltd',
      aiScore: 95,
      conversionProbability: 94,
      priority: 'hot',
    },
    {
      id: '2',
      name: 'Sarah Manufacturing',
      company: 'Industrial Inc',
      aiScore: 78,
      conversionProbability: 76,
      priority: 'warm',
    },
    {
      id: '3',
      name: 'Mike Services',
      company: 'Service Solutions',
      aiScore: 62,
      conversionProbability: 58,
      priority: 'warm',
    },
    {
      id: '4',
      name: 'Lisa Retail',
      company: 'RetailCo',
      aiScore: 41,
      conversionProbability: 35,
      priority: 'cold',
    },
  ];

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-orange-100 text-orange-800';
      case 'cold': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-green-500" />
        Lead Scoring & Conversion
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">AI Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Conversion %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Priority</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                    <p className="text-xs text-gray-600">{lead.company}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${lead.aiScore}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(lead.aiScore)}`}>
                      {lead.aiScore}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{lead.conversionProbability}%</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(lead.priority)}`}>
                    {lead.priority.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600">Total Leads</p>
          <p className="text-lg font-bold text-gray-900">{leads.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Avg Score</p>
          <p className="text-lg font-bold text-gray-900">
            {(leads.reduce((sum, l) => sum + l.aiScore, 0) / leads.length).toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Hot Leads</p>
          <p className="text-lg font-bold text-red-600">{leads.filter((l) => l.priority === 'hot').length}</p>
        </div>
      </div>
    </div>
  );
};
