"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

interface SiteKPI {
  siteName: string;
  revenue: number;
  employees: number;
  activeUsers: number;
  efficiency: number;
}

export function GroupDashboard() {
  const [sites, setSites] = useState<SiteKPI[]>([]);
  const [consolidated, setConsolidated] = useState({
    totalRevenue: 0,
    totalEmployees: 0,
    totalActiveUsers: 0,
    avgEfficiency: 0,
  });

  useEffect(() => {
    const siteData: SiteKPI[] = [
      { siteName: "New York HQ", revenue: 2500000, employees: 450, activeUsers: 420, efficiency: 94 },
      { siteName: "San Francisco Office", revenue: 1800000, employees: 280, activeUsers: 265, efficiency: 91 },
      { siteName: "Chicago Branch", revenue: 950000, employees: 120, activeUsers: 108, efficiency: 88 },
      { siteName: "Boston Tech Center", revenue: 750000, employees: 95, activeUsers: 89, efficiency: 92 },
    ];
    setSites(siteData);

    const totalRev = siteData.reduce((sum, s) => sum + s.revenue, 0);
    const totalEmp = siteData.reduce((sum, s) => sum + s.employees, 0);
    const totalActive = siteData.reduce((sum, s) => sum + s.activeUsers, 0);
    const avgEff = (siteData.reduce((sum, s) => sum + s.efficiency, 0) / siteData.length).toFixed(1);

    setConsolidated({
      totalRevenue: totalRev,
      totalEmployees: totalEmp,
      totalActiveUsers: totalActive,
      avgEfficiency: parseFloat(avgEff),
    });
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-blue-50">
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(consolidated.totalRevenue)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-gray-600 mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-green-700">{consolidated.totalEmployees}</p>
        </div>
        <div className="border rounded-lg p-4 bg-purple-50">
          <p className="text-sm text-gray-600 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-purple-700">{consolidated.totalActiveUsers}</p>
        </div>
        <div className="border rounded-lg p-4 bg-orange-50">
          <p className="text-sm text-gray-600 mb-1">Avg Efficiency</p>
          <p className="text-2xl font-bold text-orange-700">{consolidated.avgEfficiency}%</p>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">KPI Comparison Chart</h3>
        </div>
        <div className="bg-gray-100 rounded h-64 flex items-center justify-center">
          <p className="text-gray-500">Chart visualization would render here</p>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Site Performance</h3>
        <div className="space-y-3">
          {sites.map((site, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{site.siteName}</h4>
                <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> {site.efficiency}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Revenue</p>
                  <p className="font-medium">{formatCurrency(site.revenue)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Employees</p>
                  <p className="font-medium">{site.employees}</p>
                </div>
                <div>
                  <p className="text-gray-600">Active</p>
                  <p className="font-medium">{site.activeUsers}/{site.employees}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
