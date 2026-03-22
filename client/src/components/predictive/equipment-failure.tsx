import React from 'react';
import { AlertTriangle, Zap, Calendar } from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  failureProbability: number;
  nextMaintenance: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const EquipmentFailure: React.FC = () => {
  const equipment: Equipment[] = [
    {
      id: '1',
      name: 'Server Room HVAC',
      failureProbability: 87,
      nextMaintenance: '2026-03-25',
      riskLevel: 'critical',
    },
    {
      id: '2',
      name: 'Backup Generator',
      failureProbability: 64,
      nextMaintenance: '2026-04-10',
      riskLevel: 'high',
    },
    {
      id: '3',
      name: 'Network Router A',
      failureProbability: 28,
      nextMaintenance: '2026-05-15',
      riskLevel: 'low',
    },
    {
      id: '4',
      name: 'UPS System',
      failureProbability: 45,
      nextMaintenance: '2026-04-05',
      riskLevel: 'medium',
    },
  ];

  const getRiskBadgeColor = (level: string): string => {
    switch (level) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-orange-500" />
        Equipment Failure Prediction
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {equipment.map((item) => (
          <div
            key={item.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskBadgeColor(item.riskLevel)}`}>
                {item.riskLevel.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Failure Probability</p>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      item.failureProbability > 70
                        ? 'bg-red-500'
                        : item.failureProbability > 40
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${item.failureProbability}%` }}
                  />
                </div>
                <p className="text-sm font-bold text-gray-900 mt-1">{item.failureProbability}%</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Next Maintenance
                </p>
                <p className="text-sm font-medium text-gray-900">{item.nextMaintenance}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
