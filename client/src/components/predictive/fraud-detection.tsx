import React from 'react';
import { AlertTriangle, Shield, ArrowRight } from 'lucide-react';

interface FraudAlert {
  id: string;
  transactionId: string;
  riskScore: number;
  patternType: string;
  amount: number;
  timestamp: string;
}

export const FraudDetection: React.FC = () => {
  const alerts: FraudAlert[] = [
    {
      id: '1',
      transactionId: 'TXN-2026-001',
      riskScore: 94,
      patternType: 'Unusual Location',
      amount: 4500,
      timestamp: '2026-03-22 14:30',
    },
    {
      id: '2',
      transactionId: 'TXN-2026-002',
      riskScore: 87,
      patternType: 'Rapid Succession',
      amount: 2300,
      timestamp: '2026-03-22 14:25',
    },
    {
      id: '3',
      transactionId: 'TXN-2026-003',
      riskScore: 72,
      patternType: 'High Value',
      amount: 8900,
      timestamp: '2026-03-22 13:15',
    },
  ];

  const getRiskColor = (score: number): string => {
    if (score >= 85) return 'bg-red-100 border-red-300';
    if (score >= 70) return 'bg-orange-100 border-orange-300';
    return 'bg-yellow-100 border-yellow-300';
  };

  const getRiskBadgeColor = (score: number): string => {
    if (score >= 85) return 'bg-red-600 text-white';
    if (score >= 70) return 'bg-orange-500 text-white';
    return 'bg-yellow-500 text-white';
  };

  const getRiskLabel = (score: number): string => {
    if (score >= 85) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    return 'MEDIUM';
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-red-500" />
        Fraud Detection & Prevention
      </h2>

      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">Active Alerts</p>
            <p className="text-xs text-red-700">{alerts.length} potential fraud detection(s)</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 border-2 rounded-lg transition ${getRiskColor(alert.riskScore)}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{alert.patternType}</h3>
                <p className="text-xs text-muted-foreground mt-1">ID: {alert.transactionId}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold ${getRiskBadgeColor(alert.riskScore)}`}>
                {getRiskLabel(alert.riskScore)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div>
                <p className="text-muted-foreground">Risk Score</p>
                <p className="font-bold text-foreground">{alert.riskScore}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-bold text-foreground">${alert.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Time</p>
                <p className="font-bold text-foreground">{alert.timestamp.split(' ')[1]}</p>
              </div>
            </div>

            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full ${
                  alert.riskScore >= 85
                    ? 'bg-red-600'
                    : alert.riskScore >= 70
                    ? 'bg-orange-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${alert.riskScore}%` }}
              />
            </div>

            <button className="w-full py-2 px-3 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition flex items-center justify-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Investigate
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">Critical Alerts</p>
            <p className="text-lg font-bold text-red-600">{alerts.filter((a) => a.riskScore >= 85).length}</p>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">High Risk</p>
            <p className="text-lg font-bold text-orange-600">{alerts.filter((a) => a.riskScore >= 70 && a.riskScore < 85).length}</p>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">Detection Rate</p>
            <p className="text-lg font-bold text-blue-600">99.2%</p>
          </div>
        </div>
      </div>
    </div>
  );
};
