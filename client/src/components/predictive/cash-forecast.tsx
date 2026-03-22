import React from 'react';
import { AlertTriangle, BarChart3 } from 'lucide-react';

interface CashForecastData {
  day: number;
  projected: number;
}

export const CashForecast: React.FC = () => {
  const forecastData: CashForecastData[] = [
    { day: 0, projected: 125000 },
    { day: 30, projected: 118000 },
    { day: 60, projected: 132000 },
    { day: 90, projected: 145000 },
  ];

  const currentBalance = 125000;
  const projectedBalance = 145000;
  const isNegative = projectedBalance < 0;
  const minBalance = Math.min(...forecastData.map((d) => d.projected));

  const maxValue = Math.max(...forecastData.map((d) => d.projected));
  const chartHeight = 120;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        90-Day Cash Flow Forecast
      </h2>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900">${(currentBalance / 1000).toFixed(1)}k</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Projected Balance (90d)</p>
            <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
              ${(projectedBalance / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
      </div>

      {isNegative && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">Cash Flow Alert</p>
            <p className="text-xs text-red-700">Projected balance may turn negative</p>
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Forecast Chart</p>
        <div className="flex items-end justify-between h-32 gap-2 px-2">
          {forecastData.map((data, idx) => {
            const barHeight = (data.projected / maxValue) * chartHeight;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="relative w-full flex items-end justify-center h-32">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${barHeight}px` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Day {data.day}</p>
                <p className="text-xs font-semibold text-gray-900">${(data.projected / 1000).toFixed(0)}k</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          Minimum projected balance: <span className="font-bold text-gray-900">${(minBalance / 1000).toFixed(1)}k</span>
        </p>
      </div>
    </div>
  );
};
