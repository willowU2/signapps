'use client';

/**
 * Meal Vouchers Component
 *
 * Displays monthly allocation, current balance, and transaction history.
 * Shows allocation as a progress bar and lists recent meals purchased.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, TrendingDown, Calendar } from 'lucide-react';

export interface MealVoucher {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  category: 'restaurant' | 'café' | 'bakery';
}

export interface MealVouchersProps {
  monthlyAllocation: number;
  currentBalance: number;
  transactions: MealVoucher[];
  currency?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  café: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  bakery: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

function MealTransactionCard({ transaction }: { transaction: MealVoucher }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-white">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{transaction.merchant}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            {new Date(transaction.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">-€{transaction.amount.toFixed(2)}</p>
        <Badge
          variant="secondary"
          className={`mt-1 text-xs ${CATEGORY_COLORS[transaction.category] || 'bg-gray-100'}`}
        >
          {transaction.category}
        </Badge>
      </div>
    </div>
  );
}

export function MealVouchers({
  monthlyAllocation,
  currentBalance,
  transactions,
  currency = '€',
}: MealVouchersProps) {
  const usedAmount = monthlyAllocation - currentBalance;
  const usagePercentage = (usedAmount / monthlyAllocation) * 100;

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Tickets Restaurants</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Allocation Mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currency}{monthlyAllocation.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde Restant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{currency}{currentBalance.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisation du Mois</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-600 h-full transition-all"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usedAmount.toFixed(2)}{currency} utilisés</span>
              <span>{usagePercentage.toFixed(0)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historique des Transactions</CardTitle>
            <Badge variant="outline">{transactions.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">Aucune transaction ce mois-ci</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sortedTransactions.map((transaction) => (
                <MealTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
