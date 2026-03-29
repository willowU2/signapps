"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";

export function ChargesSimulator() {
  const [grossSalary, setGrossSalary] = useState<number>(3000);
  const [employerRate, setEmployerRate] = useState<number>(42);
  const [employeeRate, setEmployeeRate] = useState<number>(23);

  const employerCharges = grossSalary * (employerRate / 100);
  const employeeCharges = grossSalary * (employeeRate / 100);
  const netPay = grossSalary - employeeCharges;
  const totalCost = grossSalary + employerCharges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payroll Charges Simulator</h2>
          <p className="text-muted-foreground">Calculate gross, net, and charge breakdowns</p>
        </div>
        <DollarSign className="w-8 h-8 text-blue-600" />
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-6">
        {/* Gross Salary Input */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-foreground">
            Gross Salary (€)
          </label>
          <input
            type="number"
            value={grossSalary}
            onChange={(e) => setGrossSalary(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            step="100"
          />
        </div>

        {/* Employee Rate Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-foreground">
              Employee Charge Rate
            </label>
            <span className="text-lg font-bold text-red-600">{employeeRate}%</span>
          </div>
          <input
            type="range"
            value={employeeRate}
            onChange={(e) => setEmployeeRate(Number(e.target.value))}
            className="w-full"
            min="0"
            max="50"
            step="0.5"
          />
        </div>

        {/* Employer Rate Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-foreground">
              Employer Charge Rate
            </label>
            <span className="text-lg font-bold text-orange-600">{employerRate}%</span>
          </div>
          <input
            type="range"
            value={employerRate}
            onChange={(e) => setEmployerRate(Number(e.target.value))}
            className="w-full"
            min="0"
            max="60"
            step="0.5"
          />
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Gross Salary</p>
          <p className="text-2xl font-bold text-blue-900">
            €{grossSalary.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Net Pay</p>
          <p className="text-2xl font-bold text-green-900">
            €{netPay.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Employee Charges</p>
          <p className="text-2xl font-bold text-red-900">
            €{employeeCharges.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border bg-orange-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Employer Charges</p>
          <p className="text-2xl font-bold text-orange-900">
            €{employerCharges.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="col-span-2 rounded-lg border bg-purple-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total Cost (Gross + Employer)</p>
          <p className="text-2xl font-bold text-purple-900">
            €{totalCost.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Component</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">Amount (€)</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">% of Gross</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-muted">
              <td className="px-4 py-3 font-medium text-foreground">Gross Salary</td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">
                €{grossSalary.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">100.0%</td>
            </tr>
            <tr className="hover:bg-muted">
              <td className="px-4 py-3 font-medium text-foreground">Employee Charges</td>
              <td className="px-4 py-3 text-right text-red-600 font-semibold">
                -€{employeeCharges.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-red-600">{employeeRate}%</td>
            </tr>
            <tr className="hover:bg-muted bg-muted">
              <td className="px-4 py-3 font-medium text-foreground">Net Pay</td>
              <td className="px-4 py-3 text-right font-bold text-green-600">
                €{netPay.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3 text-right font-bold text-green-600">
                {((netPay / grossSalary) * 100).toFixed(1)}%
              </td>
            </tr>
            <tr className="hover:bg-muted">
              <td className="px-4 py-3 font-medium text-foreground">Employer Charges</td>
              <td className="px-4 py-3 text-right text-orange-600 font-semibold">
                €{employerCharges.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-orange-600">+{employerRate}%</td>
            </tr>
            <tr className="bg-purple-50">
              <td className="px-4 py-3 font-bold text-foreground">Total Cost</td>
              <td className="px-4 py-3 text-right font-bold text-purple-600">
                €{totalCost.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3 text-right font-bold text-purple-600">
                {((totalCost / grossSalary) * 100).toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
