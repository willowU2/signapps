/**
 * Supply Chain API — Purchase orders and warehouse management
 *
 * Endpoints sous /supply-chain, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types — Purchase Orders
// ============================================================================

export interface POItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplier: string;
  status: "draft" | "pending" | "approved" | "rejected" | "received";
  items: POItem[];
  notes: string;
  created_at: string;
  updated_at: string;
  requested_by: string;
  total: number;
}

export interface CreatePurchaseOrderRequest {
  supplier: string;
  status: "draft" | "pending";
  items: { description: string; quantity: number; unit_price: number }[];
  notes?: string;
}

export interface UpdatePurchaseOrderStatusRequest {
  status: "draft" | "pending" | "approved" | "rejected" | "received";
}

// ============================================================================
// Types — Warehouse Zones
// ============================================================================

export interface WarehouseZone {
  id: string;
  code: string;
  name: string;
  type: "storage" | "receiving" | "shipping" | "cold" | "office" | "empty";
  capacity: number;
  used: number;
  items: string[];
  row: number;
  col: number;
  width: number;
  height: number;
}

// ============================================================================
// API
// ============================================================================

export const supplyChainApi = {
  // ── Purchase Orders ─────────────────────────────────────
  /** Liste les bons de commande */
  listPurchaseOrders: () =>
    client.get<PurchaseOrder[]>("/supply-chain/purchase-orders"),

  /** Cree un bon de commande */
  createPurchaseOrder: (data: CreatePurchaseOrderRequest) =>
    client.post<PurchaseOrder>("/supply-chain/purchase-orders", data),

  /** Met a jour le statut d'un bon de commande */
  updatePurchaseOrderStatus: (
    id: string,
    data: UpdatePurchaseOrderStatusRequest,
  ) => client.patch<PurchaseOrder>(`/supply-chain/purchase-orders/${id}`, data),

  // ── Warehouse Zones ─────────────────────────────────────
  /** Liste les zones d'entrepot */
  listWarehouseZones: () =>
    client.get<WarehouseZone[]>("/supply-chain/warehouses"),
};
