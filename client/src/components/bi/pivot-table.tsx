'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Grid3x3 } from 'lucide-react';

interface PivotData {
  region: string;
  quarter: string;
  product: string;
  sales: number;
  units: number;
}

export default function PivotTable() {
  const [rowDimension, setRowDimension] = useState('region');
  const [colDimension, setColDimension] = useState('quarter');

  const data: PivotData[] = [
    { region: 'North', quarter: 'Q1', product: 'ProductA', sales: 45000, units: 150 },
    { region: 'North', quarter: 'Q2', product: 'ProductA', sales: 52000, units: 170 },
    { region: 'South', quarter: 'Q1', product: 'ProductA', sales: 38000, units: 120 },
    { region: 'South', quarter: 'Q2', product: 'ProductA', sales: 61000, units: 200 },
    { region: 'East', quarter: 'Q1', product: 'ProductB', sales: 42000, units: 140 },
    { region: 'East', quarter: 'Q2', product: 'ProductB', sales: 58000, units: 190 },
  ];

  const dimensions = ['region', 'quarter', 'product'];

  // Simple pivot: rows by rowDimension, columns by colDimension, sum sales
  const rows = Array.from(new Set(data.map((d) => d[rowDimension as keyof PivotData])));
  const cols = Array.from(new Set(data.map((d) => d[colDimension as keyof PivotData])));

  const getValue = (rowVal: any, colVal: any): number => {
    return data
      .filter((d) => d[rowDimension as keyof PivotData] === rowVal && d[colDimension as keyof PivotData] === colVal)
      .reduce((sum, d) => sum + d.sales, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="w-5 h-5" />
          Pivot Table
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Dimension Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">Rows</label>
              <div className="flex gap-1 flex-wrap">
                {dimensions.map((dim) => (
                  <Button
                    key={dim}
                    variant={rowDimension === dim ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRowDimension(dim)}
                    className="text-xs"
                  >
                    {dim}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">Columns</label>
              <div className="flex gap-1 flex-wrap">
                {dimensions.map((dim) => (
                  <Button
                    key={dim}
                    variant={colDimension === dim ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColDimension(dim)}
                    className="text-xs"
                  >
                    {dim}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="border px-3 py-2 text-left font-semibold text-gray-700">
                    {rowDimension}
                  </th>
                  {cols.map((col) => (
                    <th key={col} className="border px-3 py-2 text-right font-semibold text-gray-700">
                      {String(col)}
                    </th>
                  ))}
                  <th className="border px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row} className="hover:bg-gray-50 border-b">
                    <td className="border px-3 py-2 font-medium text-gray-900">{String(row)}</td>
                    {cols.map((col) => (
                      <td key={`${row}-${col}`} className="border px-3 py-2 text-right text-gray-600">
                        ${getValue(row, col).toLocaleString()}
                      </td>
                    ))}
                    <td className="border px-3 py-2 text-right font-medium text-gray-900">
                      $
                      {cols
                        .reduce((sum: number, col) => sum + getValue(row, col), 0)
                        .toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
