"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface LineItem {
  label: string;
  amount: number;
}

interface BalanceSheetData {
  assets: LineItem[];
  liabilities: LineItem[];
}

interface IncomeStatementData {
  revenue: LineItem[];
  expenses: LineItem[];
}

interface FinancialStatementsProps {
  balanceSheet?: BalanceSheetData;
  incomeStatement?: IncomeStatementData;
  onExportPDF?: () => void;
}

export function FinancialStatements({
  balanceSheet = {
    assets: [],
    liabilities: [],
  },
  incomeStatement = {
    revenue: [],
    expenses: [],
  },
  onExportPDF,
}: FinancialStatementsProps) {
  const totalAssets = balanceSheet.assets.reduce((s, l) => s + l.amount, 0);
  const totalLiabilities = balanceSheet.liabilities.reduce(
    (s, l) => s + l.amount,
    0,
  );
  const totalRevenue = incomeStatement.revenue.reduce(
    (s, l) => s + l.amount,
    0,
  );
  const totalExpenses = incomeStatement.expenses.reduce(
    (s, l) => s + l.amount,
    0,
  );
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">États Financiers</h2>
        <Button
          onClick={onExportPDF}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exporter PDF
        </Button>
      </div>

      {/* Balance Sheet */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Bilan Comptable</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Actif */}
          <div>
            <h4 className="mb-3 font-semibold text-blue-700">Actif</h4>
            <Table className="text-sm">
              <TableBody>
                {balanceSheet.assets.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      {item.amount.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total Actif</TableCell>
                  <TableCell className="text-right">
                    {totalAssets.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Passif */}
          <div>
            <h4 className="mb-3 font-semibold text-green-700">Passif</h4>
            <Table className="text-sm">
              <TableBody>
                {balanceSheet.liabilities.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      {item.amount.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total Passif</TableCell>
                  <TableCell className="text-right">
                    {totalLiabilities.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Income Statement */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Compte de Résultat</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Revenue */}
          <div>
            <h4 className="mb-3 font-semibold text-emerald-700">Produits</h4>
            <Table className="text-sm">
              <TableBody>
                {incomeStatement.revenue.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      {item.amount.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total Produits</TableCell>
                  <TableCell className="text-right">
                    {totalRevenue.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Expenses */}
          <div>
            <h4 className="mb-3 font-semibold text-orange-700">Charges</h4>
            <Table className="text-sm">
              <TableBody>
                {incomeStatement.expenses.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">
                      {item.amount.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total Charges</TableCell>
                  <TableCell className="text-right">
                    {totalExpenses.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Net Income */}
        <div className="mt-6 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">Résultat Net</span>
            <span
              className={`text-2xl font-bold ${
                netIncome >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {netIncome.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
