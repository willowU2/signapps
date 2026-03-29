'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface ForecastPoint {
  month: string;
  actual: number;
  forecast: number;
  upper: number;
  lower: number;
}

export default function AIForecast() {
  const data: ForecastPoint[] = [
    { month: 'Jan', actual: 45000, forecast: 46000, upper: 52000, lower: 40000 },
    { month: 'Feb', actual: 52000, forecast: 51000, upper: 57000, lower: 45000 },
    { month: 'Mar', actual: 48000, forecast: 54000, upper: 61000, lower: 47000 },
    { month: 'Apr', forecast: 58000, actual: 0, upper: 66000, lower: 50000 },
    { month: 'May', forecast: 62000, actual: 0, upper: 71000, lower: 53000 },
  ];

  const maxValue = Math.max(...data.map((d) => Math.max(d.upper, d.actual)));
  const minValue = 0;
  const range = maxValue - minValue;

  const getY = (value: number) => {
    return 250 - ((value - minValue) / range) * 200;
  };

  const getX = (index: number) => {
    return 60 + (index / (data.length - 1)) * 420;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          AI Sales Forecast (3-Month)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <div className="bg-muted p-4 rounded-lg">
            <svg className="w-full" height="300" viewBox="0 0 540 300" preserveAspectRatio="xMidYMid meet">
              {/* Grid */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`h-${i}`}
                  x1="50"
                  y1={50 + i * 50}
                  x2="520"
                  y2={50 + i * 50}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}

              {/* Confidence band */}
              <path
                d={`M ${getX(0)} ${getY(data[0].lower)} L ${data.map((d, i) => `${getX(i)} ${getY(d.lower)}`).join(' L ')} L ${data.map((d, i) => `${getX(data.length - 1 - i)} ${getY(d.upper)}`).join(' L ')} Z`}
                fill="#dbeafe"
                opacity="0.6"
              />

              {/* Actual line */}
              <polyline
                points={data
                  .filter((d) => d.actual > 0)
                  .map((d, i, arr) => `${getX(data.indexOf(d))} ${getY(d.actual)}`)
                  .join(' ')}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="3"
              />

              {/* Forecast line */}
              <polyline
                points={data.map((d, i) => `${getX(i)} ${getY(d.forecast)}`).join(' ')}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeDasharray="5,5"
              />

              {/* Points */}
              {data.map((d, i) =>
                d.actual > 0 ? (
                  <circle key={`actual-${i}`} cx={getX(i)} cy={getY(d.actual)} r="4" fill="#0ea5e9" />
                ) : null
              )}
              {data.map((d, i) => (
                <circle key={`forecast-${i}`} cx={getX(i)} cy={getY(d.forecast)} r="3" fill="#f97316" />
              ))}

              {/* X-axis labels */}
              {data.map((d, i) => (
                <text key={`label-${i}`} x={getX(i)} y="280" textAnchor="middle" fontSize="12" fill="#666">
                  {d.month}
                </text>
              ))}

              {/* Y-axis labels */}
              {[0, 20000, 40000, 60000].map((val, i) => (
                <text key={`y-${i}`} x="35" y={getY(val) + 4} textAnchor="end" fontSize="11" fill="#999">
                  ${(val / 1000).toFixed(0)}k
                </text>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500"></div>
              <span>Forecast</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span>Confidence 95%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
