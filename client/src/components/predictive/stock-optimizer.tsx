import React from 'react';
import { Package, TrendingDown } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  currentStock: number;
  optimalReorderPoint: number;
  idealStock: number;
  savingsEstimate: number;
  status: 'overstock' | 'optimal' | 'low';
}

export const StockOptimizer: React.FC = () => {
  const products: Product[] = [
    {
      id: '1',
      name: 'Widget A',
      currentStock: 450,
      optimalReorderPoint: 100,
      idealStock: 300,
      savingsEstimate: 1250,
      status: 'overstock',
    },
    {
      id: '2',
      name: 'Widget B',
      currentStock: 280,
      optimalReorderPoint: 75,
      idealStock: 250,
      savingsEstimate: 150,
      status: 'optimal',
    },
    {
      id: '3',
      name: 'Component X',
      currentStock: 45,
      optimalReorderPoint: 100,
      idealStock: 200,
      savingsEstimate: 800,
      status: 'low',
    },
    {
      id: '4',
      name: 'Component Y',
      currentStock: 520,
      optimalReorderPoint: 80,
      idealStock: 280,
      savingsEstimate: 2400,
      status: 'overstock',
    },
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'overstock': return 'bg-blue-100 text-blue-800';
      case 'optimal': return 'bg-green-100 text-green-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'overstock': return '↓';
      case 'optimal': return '✓';
      case 'low': return '!';
      default: return '−';
    }
  };

  const totalSavings = products.reduce((sum, p) => sum + p.savingsEstimate, 0);
  const overstockedCount = products.filter((p) => p.status === 'overstock').length;
  const lowStockCount = products.filter((p) => p.status === 'low').length;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-orange-500" />
        Stock Optimizer
      </h2>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-gray-600">Overstocked Items</p>
          <p className="text-2xl font-bold text-blue-600">{overstockedCount}</p>
        </div>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-gray-600">Low Stock Items</p>
          <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-gray-600">Total Savings</p>
          <p className="text-2xl font-bold text-green-600">${(totalSavings / 1000).toFixed(1)}k</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Current</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Ideal</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Savings</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stockDifference = product.currentStock - product.idealStock;

              return (
                <tr key={product.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{product.currentStock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{product.idealStock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(product.status)}`}>
                      {getStatusIcon(product.status)} {product.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-600">${product.savingsEstimate.toLocaleString()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800 font-semibold">Optimization Recommendation</p>
          <p className="text-xs text-yellow-700 mt-1">
            Adjust inventory levels to match optimal reorder points. Potential savings: ${(totalSavings / 1000).toFixed(1)}k in carrying costs.
          </p>
        </div>
      </div>
    </div>
  );
};
