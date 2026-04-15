"use client";

import { useEffect, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteFinancial {
  siteName: string;
  revenue: number;
  expenses: number;
  variance: number;
}

interface ConsolidatedPL {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

export function FinancialConsolidation() {
  const [sites, setSites] = useState<SiteFinancial[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedPL>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
  });

  useEffect(() => {
    const siteData: SiteFinancial[] = [
      {
        siteName: "New York HQ",
        revenue: 2500000,
        expenses: 1500000,
        variance: 0,
      },
      {
        siteName: "San Francisco Office",
        revenue: 1800000,
        expenses: 1200000,
        variance: 0,
      },
      {
        siteName: "Chicago Branch",
        revenue: 950000,
        expenses: 680000,
        variance: 0,
      },
      {
        siteName: "Boston Tech Center",
        revenue: 750000,
        expenses: 520000,
        variance: 0,
      },
    ];

    const totalRev = siteData.reduce((sum, s) => sum + s.revenue, 0);
    const totalExp = siteData.reduce((sum, s) => sum + s.expenses, 0);
    const netProfit = totalRev - totalExp;
    const profitMargin = ((netProfit / totalRev) * 100).toFixed(2);

    siteData.forEach((site) => {
      site.variance = ((site.revenue - site.expenses) / site.revenue) * 100;
    });

    setSites(siteData);
    setConsolidated({
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit,
      profitMargin: parseFloat(profitMargin),
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
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-700">
            {formatCurrency(consolidated.totalRevenue)}
          </p>
        </div>
        <div className="border rounded-lg p-4 bg-red-50">
          <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700">
            {formatCurrency(consolidated.totalExpenses)}
          </p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(consolidated.netProfit)}
          </p>
        </div>
        <div className="border rounded-lg p-4 bg-purple-50">
          <p className="text-sm text-muted-foreground mb-1">Profit Margin</p>
          <p className="text-2xl font-bold text-purple-700">
            {consolidated.profitMargin}%
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Revenue & Expense by Site</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Site Name</th>
                <th className="text-right p-3 font-semibold">Revenue</th>
                <th className="text-right p-3 font-semibold">Expenses</th>
                <th className="text-right p-3 font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site, index) => (
                <tr key={index} className="border-b hover:bg-muted">
                  <td className="p-3 font-medium">{site.siteName}</td>
                  <td className="text-right p-3 text-green-700 font-semibold">
                    {formatCurrency(site.revenue)}
                  </td>
                  <td className="text-right p-3 text-red-700 font-semibold">
                    {formatCurrency(site.expenses)}
                  </td>
                  <td className="text-right p-3">
                    <div className="flex items-center justify-end gap-1">
                      {site.variance > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span
                        className={
                          site.variance > 0 ? "text-green-700" : "text-red-700"
                        }
                      >
                        {site.variance.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-muted">
        <h3 className="font-semibold mb-3">Consolidated P&L Statement</h3>
        <div className="space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span>Total Revenue:</span>
            <span className="font-semibold text-green-700">
              {formatCurrency(consolidated.totalRevenue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total Expenses:</span>
            <span className="font-semibold text-red-700">
              {formatCurrency(consolidated.totalExpenses)}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Net Profit:</span>
            <span className="text-green-700">
              {formatCurrency(consolidated.netProfit)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Profit Margin:</span>
            <span>{consolidated.profitMargin}%</span>
          </div>
        </div>
      </div>

      <Button className="w-full gap-2">
        <Download className="w-4 h-4" />
        Export P&L Report
      </Button>
    </div>
  );
}
