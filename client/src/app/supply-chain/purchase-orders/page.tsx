"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  supplyChainApi,
  type PurchaseOrder,
  type CreatePurchaseOrderRequest,
} from "@/lib/api/supply-chain";

// ── Local view-model (camelCase mapping from snake_case API) ────────────────

interface POView {
  id: string;
  number: string;
  supplier: string;
  status: "draft" | "pending" | "approved" | "rejected" | "received";
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  requestedBy: string;
  total: number;
}

function toPOView(po: PurchaseOrder): POView {
  return {
    id: po.id,
    number: po.number,
    supplier: po.supplier,
    status: po.status,
    items: po.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
    notes: po.notes,
    createdAt: new Date(po.created_at),
    updatedAt: new Date(po.updated_at),
    requestedBy: po.requested_by,
    total: po.total,
  };
}

// ── Status metadata ─────────────────────────────────────────────────────────

const statusConfig = {
  draft: {
    label: "Draft",
    color: "bg-muted text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    icon: FileText,
  },
  pending: {
    label: "Pending Approval",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: XCircle,
  },
  received: {
    label: "Received",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: CheckCircle,
  },
};

// ── Item row helper ─────────────────────────────────────────────────────────

interface FormItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function PurchaseOrdersPage() {
  usePageTitle("Bons de commande");
  const queryClient = useQueryClient();

  // ── Data fetching ───────────────────────────────────────
  const {
    data: pos = [],
    isLoading,
    isError,
  } = useQuery<POView[]>({
    queryKey: ["supply-chain-purchase-orders"],
    queryFn: async () => {
      const res = await supplyChainApi.listPurchaseOrders();
      return res.data.map(toPOView);
    },
  });

  // ── Mutations ───────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderRequest) =>
      supplyChainApi.createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["supply-chain-purchase-orders"],
      });
      setOpen(false);
      setForm({ supplier: "", notes: "" });
      setItems([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    },
    onError: () => toast.error("Failed to create purchase order"),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: PurchaseOrder["status"];
    }) => supplyChainApi.updatePurchaseOrderStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["supply-chain-purchase-orders"],
      });
    },
    onError: () => toast.error("Failed to update status"),
  });

  // ── Local state ─────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<POView | null>(null);
  const [form, setForm] = useState({ supplier: "", notes: "" });
  const [items, setItems] = useState<FormItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [activeTab, setActiveTab] = useState("all");

  const addItem = () =>
    setItems([
      ...items,
      { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));
  const updateItem = (
    id: string,
    field: keyof FormItem,
    val: string | number,
  ) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: val } : i)),
    );

  const total = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);

  const handleCreate = (status: "draft" | "pending") => {
    if (!form.supplier.trim() || items.every((i) => !i.description.trim())) {
      toast.error("Supplier and items required");
      return;
    }
    createMutation.mutate({
      supplier: form.supplier,
      status,
      items: items
        .filter((i) => i.description.trim())
        .map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        })),
      notes: form.notes || undefined,
    });
    toast.success(
      `PO ${status === "draft" ? "saved as draft" : "submitted for approval"}!`,
    );
  };

  const approve = (id: string) => {
    statusMutation.mutate({ id, status: "approved" });
    toast.success("PO approved!");
  };
  const reject = (id: string) => {
    statusMutation.mutate({ id, status: "rejected" });
    toast.success("PO rejected");
  };
  const markReceived = (id: string) => {
    statusMutation.mutate({ id, status: "received" });
    toast.success("PO marked as received");
  };

  const filtered =
    activeTab === "all" ? pos : pos.filter((p) => p.status === activeTab);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Purchase Orders</h1>
              <p className="text-sm text-muted-foreground">
                Create and manage POs with approval workflow
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New PO
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Supplier</Label>
                    <Input
                      value={form.supplier}
                      onChange={(e) =>
                        setForm({ ...form, supplier: e.target.value })
                      }
                      placeholder="Supplier name..."
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Items</Label>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <Input
                          className="col-span-5"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.id, "description", e.target.value)
                          }
                        />
                        <Input
                          className="col-span-2"
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", +e.target.value)
                          }
                        />
                        <Input
                          className="col-span-3"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Unit price"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, "unitPrice", +e.target.value)
                          }
                        />
                        <div className="col-span-1 text-xs text-muted-foreground text-right">
                          {(item.quantity * item.unitPrice).toFixed(0)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="col-span-1 h-7 w-7"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold">
                    Total: {total.toFixed(2)}
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Additional notes..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCreate("draft")}
                    disabled={createMutation.isPending}
                  >
                    Save Draft
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleCreate("pending")}
                    disabled={createMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Approval
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 text-destructive opacity-60" />
              <p>Failed to load purchase orders</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["supply-chain-purchase-orders"],
                  })
                }
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data loaded */}
        {!isLoading && !isError && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              {[
                "all",
                "draft",
                "pending",
                "approved",
                "rejected",
                "received",
              ].map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">
                  {t}{" "}
                  {t !== "all" && (
                    <span className="ml-1 text-xs">
                      ({pos.filter((p) => p.status === t).length})
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="space-y-3">
                {filtered.map((po) => {
                  const sc = statusConfig[po.status];
                  const Icon = sc.icon;
                  return (
                    <Card
                      key={po.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm">
                                {po.number}
                              </span>
                              <Badge className={cn("text-xs", sc.color)}>
                                <Icon className="h-3 w-3 mr-1" />
                                {sc.label}
                              </Badge>
                            </div>
                            <p className="font-medium">{po.supplier}</p>
                            <p className="text-xs text-muted-foreground">
                              {po.items.length} item
                              {po.items.length > 1 ? "s" : ""} · Requested by{" "}
                              {po.requestedBy} ·{" "}
                              {format(po.createdAt, "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              {po.total.toLocaleString()}
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewing(po)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                              {po.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approve(po.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={statusMutation.isPending}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => reject(po.id)}
                                    disabled={statusMutation.isPending}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {po.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markReceived(po.id)}
                                  disabled={statusMutation.isPending}
                                >
                                  Mark Received
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filtered.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-30" />
                      <p>No purchase orders</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* PO Detail Dialog */}
        <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {viewing?.number} — {viewing?.supplier}
              </DialogTitle>
            </DialogHeader>
            {viewing && (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{i.description}</TableCell>
                        <TableCell className="text-right">
                          {i.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {i.unitPrice}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {(i.quantity * i.unitPrice).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {viewing.total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {viewing.notes && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <span className="font-medium">Notes:</span> {viewing.notes}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
