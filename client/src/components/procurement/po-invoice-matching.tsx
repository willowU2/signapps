'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
  id: string;
  description: string;
  poQty: number;
  invoiceQty: number;
  poPrice: number;
  invoicePrice: number;
  matched: boolean;
}

export function PoInvoiceMatching() {
  const [isLoading, setIsLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockData: LineItem[] = [
        {
          id: '1',
          description: 'Premium Office Chairs (Model X500)',
          poQty: 10,
          invoiceQty: 10,
          poPrice: 150.0,
          invoicePrice: 150.0,
          matched: true,
        },
        {
          id: '2',
          description: 'Standing Desks (Electric)',
          poQty: 5,
          invoiceQty: 4,
          poPrice: 500.0,
          invoicePrice: 500.0,
          matched: false,
        },
        {
          id: '3',
          description: 'Monitor Stands',
          poQty: 8,
          invoiceQty: 8,
          poPrice: 45.0,
          invoicePrice: 48.5,
          matched: false,
        },
        {
          id: '4',
          description: 'Cable Management Kit',
          poQty: 20,
          invoiceQty: 20,
          poPrice: 12.5,
          invoicePrice: 12.5,
          matched: true,
        },
      ];

      setLineItems(mockData);
      setShowComparison(true);
      setIsApproved(false);
      toast.success('PO and Invoice loaded for matching');
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = () => {
    const unmatched = lineItems.filter(item => !item.matched);
    if (unmatched.length > 0) {
      toast.warning(`${unmatched.length} unmatched line(s) found. Please review before approval.`);
      return;
    }
    setIsApproved(true);
    toast.success('Invoice approved for payment');
  };

  const matchStatus = (item: LineItem) => {
    const qtyMatch = item.poQty === item.invoiceQty;
    const priceMatch = Math.abs(item.poPrice - item.invoicePrice) < 1;
    return qtyMatch && priceMatch;
  };

  const totalPOAmount = lineItems.reduce((sum, item) => sum + item.poQty * item.poPrice, 0);
  const totalInvoiceAmount = lineItems.reduce((sum, item) => sum + item.invoiceQty * item.invoicePrice, 0);
  const matchedItems = lineItems.filter(item => item.matched).length;

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            PO vs Invoice Matching
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showComparison ? (
            <Button onClick={handleLoadData} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load PO & Invoice Data'
              )}
            </Button>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium">Matched Lines</p>
                  <p className="text-2xl font-bold text-blue-900">{matchedItems}/{lineItems.length}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">PO Total</p>
                  <p className="text-lg font-bold text-slate-900">€{totalPOAmount.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">Invoice Total</p>
                  <p className="text-lg font-bold text-slate-900">€{totalInvoiceAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Line Items Comparison */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Line Items</h3>
                {lineItems.map((item) => {
                  const isMatched = matchStatus(item);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 ${
                        isMatched ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-medium text-slate-900 flex-1">{item.description}</p>
                        <div className="flex items-center gap-2">
                          {isMatched ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-slate-600 font-medium">PO</p>
                          <p className="text-slate-900 mt-1">
                            Qty: <span className="font-semibold">{item.poQty}</span>
                          </p>
                          <p className="text-slate-900">
                            Price: <span className="font-semibold">€{item.poPrice.toFixed(2)}</span>
                          </p>
                          <p className="text-slate-700 mt-1">
                            Subtotal: €{(item.poQty * item.poPrice).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 font-medium">Invoice</p>
                          <p className="text-slate-900 mt-1">
                            Qty: <span className="font-semibold">{item.invoiceQty}</span>
                          </p>
                          <p className="text-slate-900">
                            Price: <span className="font-semibold">€{item.invoicePrice.toFixed(2)}</span>
                          </p>
                          <p className="text-slate-700 mt-1">
                            Subtotal: €{(item.invoiceQty * item.invoicePrice).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {!isMatched && (
                        <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-900">
                          Discrepancy detected: Qty or Price mismatch
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isApproved ? (
                <Button onClick={handleApprove} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve for Payment
                </Button>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Invoice approved</span>
                </div>
              )}

              <Button onClick={handleLoadData} variant="outline" className="w-full">
                Load Different Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
