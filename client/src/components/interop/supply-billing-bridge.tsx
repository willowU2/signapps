"use client";

// Idea 4: Supply chain PO → create billing invoice
// Idea 19: Billing payment → update accounting journal
// Idea 20: Accounting → generate billing invoices

import { useState } from "react";
import {
  Receipt,
  BookOpen,
  FilePlus,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const billingClient = () => getClient(ServiceName.BILLING);
const identityClient = () => getClient(ServiceName.IDENTITY);

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplier_name: string;
  total_amount: number;
  currency: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
}

/** Idea 4 – Create billing invoice from PO */
export function PoToInvoice({ po }: { po: PurchaseOrder }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const createInvoice = async () => {
    setLoading(true);
    try {
      await billingClient().post("/invoices", {
        reference: `INV-${po.reference}`,
        supplier: po.supplier_name,
        amount: po.total_amount,
        currency: po.currency,
        source: "purchase_order",
        source_id: po.id,
        line_items: po.items,
        status: "draft",
      });
      setDone(true);
      toast.success(`Facture créée depuis la commande ${po.reference}`);
    } catch {
      toast.error(
        "Impossible de créer la facture — service billing indisponible",
      );
    } finally {
      setLoading(false);
    }
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Receipt className="w-3 h-3" />
        Facture créée
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={createInvoice}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Receipt className="w-3.5 h-3.5" />
      )}
      Créer facture
    </Button>
  );
}

/** Idea 19 – Update accounting journal after billing payment */
export async function syncPaymentToAccounting(
  paymentId: string,
  amount: number,
  currency: string,
  description: string,
) {
  try {
    await identityClient().post("/accounting/journal-entries", {
      type: "payment_received",
      payment_id: paymentId,
      amount,
      currency,
      description,
      date: new Date().toISOString(),
    });
    toast.success("Journal comptable mis à jour");
  } catch {
    const queue = JSON.parse(
      localStorage.getItem("interop-accounting-queue") || "[]",
    );
    queue.push({
      paymentId,
      amount,
      currency,
      description,
      queued_at: new Date().toISOString(),
    });
    localStorage.setItem("interop-accounting-queue", JSON.stringify(queue));
    toast.info("Entrée comptable en attente de synchronisation");
  }
}

/** Idea 20 – Generate billing invoice from accounting data */
export function AccountingToInvoice({
  accountingEntryId,
  clientName,
  amount,
  currency,
}: {
  accountingEntryId: string;
  clientName: string;
  amount: number;
  currency: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      await billingClient().post("/invoices/from-accounting", {
        accounting_entry_id: accountingEntryId,
        client_name: clientName,
        amount,
        currency,
        generated_at: new Date().toISOString(),
      });
      setDone(true);
      toast.success("Facture générée depuis la comptabilité");
    } catch {
      toast.error("Génération échouée — service billing indisponible");
    } finally {
      setLoading(false);
    }
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Facture générée
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={generate}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FilePlus className="w-3.5 h-3.5" />
      )}
      Générer facture
    </Button>
  );
}

/** Idea 19 – Payment sync button */
export function PaymentAccountingSync({
  paymentId,
  amount,
  currency,
  description,
}: {
  paymentId: string;
  amount: number;
  currency: string;
  description: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const sync = async () => {
    setLoading(true);
    await syncPaymentToAccounting(paymentId, amount, currency, description);
    setDone(true);
    setLoading(false);
  };

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <BookOpen className="w-3 h-3" />
        Comptabilité mise à jour
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={sync}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <BookOpen className="w-3.5 h-3.5" />
      )}
      Sync comptabilité
    </Button>
  );
}
