import React from 'react';
import { AlertTriangle, Server } from 'lucide-react';

interface ServerMetrics {
  id: string;
  name: string;
  currentLoad: number;
  predictedLoad: number;
  scaleThreshold: number;
  region: string;
}

export const ServerLoad: React.FC = () => {
  const servers: ServerMetrics[] = [
    {
      id: '1',
      name: 'API Server 1',
      currentLoad: 72,
      predictedLoad: 94,
      scaleThreshold: 85,
      region: 'US-East',
    },
    {
      id: '2',
      name: 'API Server 2',
      currentLoad: 45,
      predictedLoad: 58,
      scaleThreshold: 85,
      region: 'US-West',
    },
    {
      id: '3',
      name: 'Database Server',
      currentLoad: 68,
      predictedLoad: 76,
      scaleThreshold: 80,
      region: 'US-Central',
    },
    {
      id: '4',
      name: 'Cache Server',
      currentLoad: 52,
      predictedLoad: 63,
      scaleThreshold: 80,
      region: 'US-Central',
    },
  ];

  const needsScaling = servers.filter((s) => s.predictedLoad >= s.scaleThreshold);

  const getLoadColor = (load: number, threshold: number): string => {
    if (load >= threshold) return 'bg-red-500';
    if (load >= threshold * 0.75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Server className="w-5 h-5 text-purple-500" />
        Server Load Prediction
      </h2>

      {needsScaling.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-900">Scale-Up Alert</p>
            <p className="text-xs text-orange-700">{needsScaling.length} server(s) may need scaling</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {servers.map((server) => {
          const needsAction = server.predictedLoad >= server.scaleThreshold;

          return (
            <div
              key={server.id}
              className={`p-4 border rounded-lg ${needsAction ? 'border-orange-200 bg-orange-50' : 'border-border'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{server.name}</h3>
                  <p className="text-xs text-muted-foreground">{server.region}</p>
                </div>
                {needsAction && (
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
                    SCALE ALERT
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Current Load</p>
                    <p className="text-sm font-bold text-foreground">{server.currentLoad}%</p>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getLoadColor(server.currentLoad, server.scaleThreshold)}`}
                      style={{ width: `${server.currentLoad}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Predicted Load</p>
                    <p className="text-sm font-bold text-foreground">{server.predictedLoad}%</p>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getLoadColor(server.predictedLoad, server.scaleThreshold)}`}
                      style={{ width: `${server.predictedLoad}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scale Threshold: {server.scaleThreshold}%</span>
                  <span className={`font-semibold ${needsAction ? 'text-orange-600' : 'text-green-600'}`}>
                    {needsAction ? 'Critical' : 'Healthy'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
