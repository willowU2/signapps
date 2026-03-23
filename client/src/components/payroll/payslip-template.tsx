"use client";

import { useState } from "react";
import { Printer, FileText, Download } from "lucide-react";

interface PayslipData {
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  period: string;
  grossSalary: number;
  deductions: {
    incomeTax: number;
    socialSecurity: number;
    healthInsurance: number;
    other: number;
  };
}

const DEFAULT_PAYSLIP: PayslipData = {
  employeeId: "EMP-2026-001",
  employeeName: "Marie Dubois",
  position: "Senior Developer",
  department: "Engineering",
  period: "March 2026",
  grossSalary: 4500,
  deductions: {
    incomeTax: 720,
    socialSecurity: 450,
    healthInsurance: 120,
    other: 80,
  },
};

export function PayslipTemplate() {
  const [payslip] = useState<PayslipData>(DEFAULT_PAYSLIP);

  const totalDeductions =
    payslip.deductions.incomeTax +
    payslip.deductions.socialSecurity +
    payslip.deductions.healthInsurance +
    payslip.deductions.other;

  const netPay = payslip.grossSalary - totalDeductions;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    console.log("Downloading PDF for", payslip.employeeName);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payslip Preview</h2>
          <p className="text-gray-600">Monthly salary statement</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="border-2 border-gray-300 rounded-lg p-8 bg-white shadow-lg">
        <div className="space-y-6 print:space-y-4">
          <div className="text-center border-b-2 border-gray-300 pb-4">
            <h1 className="text-3xl font-bold text-gray-900">PAYSLIP</h1>
            <p className="text-gray-600">{payslip.period}</p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase text-gray-600 font-semibold">
                  Employee ID
                </p>
                <p className="text-lg font-mono text-gray-900">
                  {payslip.employeeId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-600 font-semibold">
                  Name
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {payslip.employeeName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-600 font-semibold">
                  Position
                </p>
                <p className="text-gray-900">{payslip.position}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase text-gray-600 font-semibold">
                  Department
                </p>
                <p className="text-gray-900">{payslip.department}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-600 font-semibold">
                  Pay Period
                </p>
                <p className="text-gray-900">{payslip.period}</p>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-b-2 border-gray-300 py-4">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-gray-900">GROSS SALARY</p>
              <p className="text-2xl font-bold text-green-700">
                €{payslip.grossSalary.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-900 mb-3">Deductions</p>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <tr>
                  <td className="text-gray-700 py-2">Income Tax</td>
                  <td className="text-right text-gray-900 font-medium">
                    €{payslip.deductions.incomeTax.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-700 py-2">Social Security</td>
                  <td className="text-right text-gray-900 font-medium">
                    €{payslip.deductions.socialSecurity.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-700 py-2">Health Insurance</td>
                  <td className="text-right text-gray-900 font-medium">
                    €{payslip.deductions.healthInsurance.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-700 py-2">Other Deductions</td>
                  <td className="text-right text-gray-900 font-medium">
                    €{payslip.deductions.other.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-gray-300 pt-4">
            <div className="flex justify-between items-center">
              <p className="font-bold text-lg text-gray-900">TOTAL DEDUCTIONS</p>
              <p className="font-semibold text-lg text-gray-900">
                €{totalDeductions.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded p-4">
            <div className="flex justify-between items-center">
              <p className="font-bold text-xl text-gray-900">NET PAY</p>
              <p className="text-3xl font-bold text-blue-700">
                €{netPay.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
