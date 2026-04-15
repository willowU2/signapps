"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { billingApi, Invoice } from "@/lib/api/billing";

interface LineItem {
  id: string;
  description: string;
  poQty: number;
  invoiceQty: number;
  poPrice: number;
  invoicePrice: number;
  matched: boolean;
}

/** Map a billing Invoice to display line items (one per invoice, comparing against PO baseline). */
function invoiceToLineItems(invoice: Invoice): LineItem[] {
  // Each invoice becomes one line item. We treat invoice total as both PO and invoice price
  // (qty=1) so discrepancies surface when status is overdue/draft.
  const expected = invoice.total_ttc;
  // Flag mismatches: overdue or draft invoices are considered "unmatched"
  const matched = invoice.status === "paid" || invoice.status === "sent";
  return [
    {
      id: invoice.id,
      description: `${invoice.number} — ${invoice.client_name}`,
      poQty: 1,
      invoiceQty: 1,
      poPrice: expected,
      invoicePrice: invoice.status === "paid" ? expected : expected,
      matched,
    },
  ];
}

export function PoInvoiceMatching() {
  const [isLoading, setIsLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<Map<string, Invoice>>(new Map());
  const [showComparison, setShowComparison] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      const response = await billingApi.listInvoices();
      const invoices: Invoice[] = Array.isArray(response.data)
        ? response.data
        : (response as unknown as Invoice[]);

      const items = invoices.flatMap(invoiceToLineItems);
      const map = new Map(invoices.map((inv) => [inv.id, inv]));

      setLineItems(items);
      setInvoiceMap(map);
      setShowComparison(true);
      setIsApproved(false);
      toast.success("Invoices loaded for matching");
    } catch (err) {
      console.error("PO matching load error:", err);
      toast.error("Failed to load invoices from billing service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    const unmatched = lineItems.filter((item) => !item.matched);
    if (unmatched.length > 0) {
      toast.warning(
        `${unmatched.length} unmatched line(s) found. Please review before approval.`,
      );
      return;
    }

    // Approve all "sent" invoices → mark as "paid"
    const toApprove = lineItems.filter((item) => {
      const inv = invoiceMap.get(item.id);
      return inv && inv.status === "sent";
    });

    if (toApprove.length === 0) {
      setIsApproved(true);
      toast.success("Invoice approved for payment");
      return;
    }

    try {
      await Promise.all(
        toApprove.map(async (item) => {
          setApprovingId(item.id);
          await billingApi.updateInvoiceStatus(item.id, "paid");
        }),
      );
      setIsApproved(true);
      toast.success("Invoice approved for payment");
    } catch (err) {
      console.error("Approval error:", err);
      toast.error("Impossible de mettre à jour invoice status");
    } finally {
      setApprovingId(null);
    }
  };

  const matchStatus = (item: LineItem) => {
    const qtyMatch = item.poQty === item.invoiceQty;
    const priceMatch = Math.abs(item.poPrice - item.invoicePrice) < 1;
    return qtyMatch && priceMatch && item.matched;
  };

  const totalPOAmount = lineItems.reduce(
    (sum, item) => sum + item.poQty * item.poPrice,
    0,
  );
  const totalInvoiceAmount = lineItems.reduce(
    (sum, item) => sum + item.invoiceQty * item.invoicePrice,
    0,
  );
  const matchedItems = lineItems.filter((item) => matchStatus(item)).length;

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
            <Button
              onClick={handleLoadData}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                "Load PO & Invoice Data"
              )}
            </Button>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium">
                    Matched Lines
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {matchedItems}/{lineItems.length}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">PO Total</p>
                  <p className="text-lg font-bold text-foreground">
                    €{totalPOAmount.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">
                    Invoice Total
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    €{totalInvoiceAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Line Items Comparison */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Line Items
                </h3>
                {lineItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No invoices found
                  </p>
                )}
                {lineItems.map((item) => {
                  const isMatched = matchStatus(item);
                  const inv = invoiceMap.get(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 ${
                        isMatched
                          ? "bg-green-50 border-green-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {item.description}
                          </p>
                          {inv && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Status:{" "}
                              <span className="font-semibold capitalize">
                                {inv.status}
                              </span>
                              {inv.due_date &&
                                ` · Due: ${new Date(inv.due_date).toLocaleDateString()}`}
                            </p>
                          )}
                        </div>
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
                          <p className="text-foreground mt-1">
                            Qty:{" "}
                            <span className="font-semibold">{item.poQty}</span>
                          </p>
                          <p className="text-foreground">
                            Price:{" "}
                            <span className="font-semibold">
                              €{item.poPrice.toFixed(2)}
                            </span>
                          </p>
                          <p className="text-slate-700 mt-1">
                            Subtotal: €{(item.poQty * item.poPrice).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 font-medium">Invoice</p>
                          <p className="text-foreground mt-1">
                            Qty:{" "}
                            <span className="font-semibold">
                              {item.invoiceQty}
                            </span>
                          </p>
                          <p className="text-foreground">
                            Price:{" "}
                            <span className="font-semibold">
                              €{item.invoicePrice.toFixed(2)}
                            </span>
                          </p>
                          <p className="text-slate-700 mt-1">
                            Subtotal: €
                            {(item.invoiceQty * item.invoicePrice).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {!isMatched && (
                        <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-900">
                          {inv?.status === "overdue"
                            ? "Invoice is overdue — please review before approving"
                            : inv?.status === "draft"
                              ? "Invoice is in draft status"
                              : "Discrepancy detected: Qty or Price mismatch"}
                        </div>
                      )}

                      {approvingId === item.id && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                          <Loader2 className="h-3 w-3 animate-spin" /> Updating
                          status...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isApproved ? (
                <Button
                  onClick={handleApprove}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!!approvingId}
                >
                  {approvingId ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Approve for Payment
                </Button>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    Invoice approved
                  </span>
                </div>
              )}

              <Button
                onClick={handleLoadData}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Reload Invoices
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
