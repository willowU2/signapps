'use client';

import React from 'react';

interface FunnelStep {
  id: string;
  label: string;
  count: number;
}

interface FunnelChartProps {
  steps?: FunnelStep[];
  title?: string;
}

const FunnelChart: React.FC<FunnelChartProps> = ({
  steps: customSteps,
  title = 'Conversion Funnel',
}) => {
  // Default sample data
  const defaultSteps: FunnelStep[] = [
    { id: 'visitors', label: 'Visitors', count: 10000 },
    { id: 'signup', label: 'Sign Up', count: 7500 },
    { id: 'active', label: 'Active Users', count: 4200 },
    { id: 'premium', label: 'Premium Users', count: 1800 },
    { id: 'retained', label: '90d Retained', count: 950 },
  ];

  const steps = customSteps || defaultSteps;

  // Find the maximum count for width calculation
  const maxCount = Math.max(...steps.map((s) => s.count));

  // Calculate metrics for each step
  const stepsWithMetrics = steps.map((step, index) => {
    const conversion =
      index === 0 ? 100 : (step.count / steps[index - 1].count) * 100;
    const overallConversion = (step.count / maxCount) * 100;
    return { ...step, conversion, overallConversion };
  });

  // Color gradient: green to red
  const getGradientColor = (index: number, total: number) => {
    const hue = (1 - index / total) * 120; // Green (120) to Red (0)
    return `hsl(${hue}, 70%, 55%)`;
  };

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>

      {/* Funnel visualization */}
      <div className="space-y-6">
        {stepsWithMetrics.map((step, index) => (
          <div key={step.id} className="flex flex-col">
            {/* Label row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {step.label}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">
                  {step.count.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 w-12 text-right">
                  {step.conversion.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Bar with gradient */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${step.overallConversion}%`,
                    backgroundColor: getGradientColor(index, steps.length),
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 w-10 text-right">
                {step.overallConversion.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer metrics */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600">Total Entered</p>
            <p className="text-lg font-bold text-gray-900">
              {steps[0].count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Converted</p>
            <p className="text-lg font-bold text-gray-900">
              {steps[steps.length - 1].count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Overall Conversion</p>
            <p className="text-lg font-bold text-gray-900">
              {(
                (steps[steps.length - 1].count / steps[0].count) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunnelChart;
