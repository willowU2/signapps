"use client";

import { useState } from "react";
import { Send, Trash2, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

type OrderStatus = "Commande" | "Validation" | "Livraison" | "Reception";

interface OrderSystemProps {
  cartItems?: CartItem[];
  onSubmit?: (items: CartItem[]) => void;
}

const STATUS_STEPS: OrderStatus[] = [
  "Commande",
  "Validation",
  "Livraison",
  "Reception",
];

export function OrderSystem({ cartItems = [], onSubmit }: OrderSystemProps) {
  const [items, setItems] = useState<CartItem[]>(cartItems);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>("Commande");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity > 0) {
      setItems(
        items.map((item) => (item.id === id ? { ...item, quantity } : item)),
      );
    }
  };

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const handleSubmitOrder = () => {
    if (items.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    if (onSubmit) {
      onSubmit(items);
    }
    setIsSubmitted(true);
    setCurrentStatus("Commande");
    toast.success("Commande soumise avec succès");
  };

  const advanceStatus = () => {
    const currentIndex = STATUS_STEPS.indexOf(currentStatus);
    if (currentIndex < STATUS_STEPS.length - 1) {
      setCurrentStatus(STATUS_STEPS[currentIndex + 1]);
      toast.success(`Order moved to ${STATUS_STEPS[currentIndex + 1]}`);
    } else {
      toast.info("Commande terminée");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6 bg-muted">
        <h2 className="font-semibold text-lg mb-4">Order Workflow</h2>
        <div className="flex justify-between items-center mb-4">
          {STATUS_STEPS.map((status, index) => {
            const isActive = currentStatus === status;
            const isCompleted = STATUS_STEPS.indexOf(currentStatus) > index;

            return (
              <div key={status} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : isActive ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`ml-2 font-medium text-sm ${
                    isActive
                      ? "text-blue-600"
                      : isCompleted
                        ? "text-green-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {status}
                </span>
                {index < STATUS_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      isCompleted ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">Cart Items</h3>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {items.length} item(s)
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Le panier est vide. Add items from the product catalog.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="w-20">Price</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-24">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>${item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-16 px-2 py-1 border rounded text-center text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      ${(item.price * item.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => removeItem(item.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 text-right space-y-3">
              <div className="text-lg font-bold">
                Total: ${total.toFixed(2)}
              </div>
              <Button
                onClick={handleSubmitOrder}
                className="w-full"
                disabled={isSubmitted}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitted ? "Order Submitted" : "Submit Order"}
              </Button>
            </div>
          </>
        )}
      </div>

      {isSubmitted && (
        <div className="border rounded-lg p-6 bg-blue-50">
          <Button
            onClick={advanceStatus}
            className="w-full"
            disabled={
              STATUS_STEPS.indexOf(currentStatus) === STATUS_STEPS.length - 1
            }
          >
            Move to Next Step
          </Button>
        </div>
      )}
    </div>
  );
}
