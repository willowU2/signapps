'use client';

import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

type ReportFormat = 'PDF' | 'Excel' | 'CSV';

interface ReportConfig {
  id: string;
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  format: ReportFormat;
  recipients: string[];
  enabled: boolean;
}

interface ScheduledReportsProps {
  reports?: ReportConfig[];
  onReportsChange?: (reports: ReportConfig[]) => void;
}

const FormatBadge: React.FC<{ format: ReportFormat }> = ({ format }) => {
  const colors: Record<ReportFormat, string> = {
    PDF: 'bg-red-100 text-red-800',
    Excel: 'bg-green-100 text-green-800',
    CSV: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${colors[format]}`}>
      {format}
    </span>
  );
};

const ScheduledReports: React.FC<ScheduledReportsProps> = ({
  reports: customReports,
  onReportsChange,
}) => {
  // Default sample data
  const defaultReports: ReportConfig[] = [
    {
      id: 'daily-exec',
      name: 'Daily Executive Summary',
      schedule: 'daily',
      format: 'PDF',
      recipients: ['ceo@company.com', 'cfo@company.com'],
      enabled: true,
    },
    {
      id: 'weekly-sales',
      name: 'Weekly Sales Report',
      schedule: 'weekly',
      format: 'Excel',
      recipients: ['sales@company.com', 'manager@company.com', 'director@company.com'],
      enabled: true,
    },
    {
      id: 'monthly-full',
      name: 'Monthly Full Analytics',
      schedule: 'monthly',
      format: 'PDF',
      recipients: ['analytics@company.com'],
      enabled: false,
    },
    {
      id: 'weekly-csv',
      name: 'Weekly Data Export',
      schedule: 'weekly',
      format: 'CSV',
      recipients: ['data-team@company.com'],
      enabled: true,
    },
  ];

  const [reports, setReports] = useState<ReportConfig[]>(customReports || defaultReports);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ReportConfig>>({
    name: '',
    schedule: 'daily',
    format: 'PDF',
    recipients: [],
    enabled: true,
  });

  const handleToggle = (id: string) => {
    const updated = reports.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setReports(updated);
    onReportsChange?.(updated);
  };

  const handleDelete = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    onReportsChange?.(updated);
  };

  const handleAddReport = () => {
    if (!formData.name || !formData.schedule || !formData.format) return;

    const newReport: ReportConfig = {
      id: `report-${Date.now()}`,
      name: formData.name,
      schedule: formData.schedule as ReportConfig['schedule'],
      format: formData.format as ReportFormat,
      recipients: formData.recipients || [],
      enabled: formData.enabled || true,
    };

    const updated = [...reports, newReport];
    setReports(updated);
    onReportsChange?.(updated);
    setFormData({
      name: '',
      schedule: 'daily',
      format: 'PDF',
      recipients: [],
      enabled: true,
    });
    setShowForm(false);
  };

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Scheduled Reports</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Report
        </button>
      </div>

      {/* Report form (collapsible) */}
      {showForm && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Report</h3>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekly Performance Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Schedule and Format grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule
                </label>
                <select
                  value={formData.schedule || 'daily'}
                  onChange={(e) =>
                    setFormData({ ...formData, schedule: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Format
                </label>
                <select
                  value={formData.format || 'PDF'}
                  onChange={(e) =>
                    setFormData({ ...formData, format: e.target.value as ReportFormat })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PDF">PDF</option>
                  <option value="Excel">Excel</option>
                  <option value="CSV">CSV</option>
                </select>
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipients (comma-separated emails)
              </label>
              <textarea
                value={formData.recipients?.join(', ') || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recipients: e.target.value.split(',').map((r) => r.trim()),
                  })
                }
                placeholder="user@example.com, another@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Enabled toggle and actions */}
            <div className="flex items-center justify-between pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled || false}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Enable immediately</span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReport}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
                >
                  Create Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No scheduled reports yet</p>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {/* Content */}
              <div className="flex-1 flex items-center gap-6">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(report.id)}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    report.enabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                  title={report.enabled ? 'Enabled' : 'Disabled'}
                />

                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-600 capitalize">
                      {report.schedule}
                    </span>
                    <FormatBadge format={report.format} />
                    <span className="text-xs text-gray-600">
                      {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(report.id)}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                title="Delete report"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      {reports.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600">Total Reports</p>
            <p className="text-lg font-bold text-gray-900">{reports.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Enabled</p>
            <p className="text-lg font-bold text-gray-900">
              {reports.filter((r) => r.enabled).length}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Recipients</p>
            <p className="text-lg font-bold text-gray-900">
              {reports.reduce((sum, r) => sum + r.recipients.length, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;
