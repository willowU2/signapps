"use client";

import { useState } from "react";
import { ShoppingCart, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

interface ProductCatalogProps {
  onAddToCart?: (product: Product, quantity: number) => void;
}

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Office Chair",
    price: 249.99,
    stock: 15,
    imageUrl: undefined,
  },
  {
    id: "2",
    name: "Standing Desk",
    price: 599.99,
    stock: 8,
    imageUrl: undefined,
  },
  {
    id: "3",
    name: "Monitor Stand",
    price: 49.99,
    stock: 0,
    imageUrl: undefined,
  },
  {
    id: "4",
    name: "Keyboard",
    price: 149.99,
    stock: 22,
    imageUrl: undefined,
  },
  {
    id: "5",
    name: "Mouse",
    price: 79.99,
    stock: 35,
    imageUrl: undefined,
  },
  {
    id: "6",
    name: "Webcam",
    price: 129.99,
    stock: 12,
    imageUrl: undefined,
  },
];

export function ProductCatalog({ onAddToCart }: ProductCatalogProps) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});

  const handleAddToCart = (product: Product) => {
    const quantity = selectedQuantities[product.id] || 1;
    if (product.stock > 0) {
      if (onAddToCart) {
        onAddToCart(product, quantity);
      }
      toast.success(`${product.name} added to cart`);
      setSelectedQuantities({ ...selectedQuantities, [product.id]: 1 });
    } else {
      toast.error("Rupture de stock");
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity > 0) {
      setSelectedQuantities({ ...selectedQuantities, [productId]: quantity });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SAMPLE_PRODUCTS.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="bg-muted h-48 flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-400" />
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-2xl font-bold text-blue-600">
                  ${product.price.toFixed(2)}
                </p>
              </div>

              <div className="text-sm">
                <span
                  className={`font-medium ${
                    product.stock > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {product.stock > 0
                    ? `${product.stock} in stock`
                    : "Rupture de stock"}
                </span>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={selectedQuantities[product.id] || 1}
                  onChange={(e) =>
                    updateQuantity(product.id, parseInt(e.target.value) || 1)
                  }
                  disabled={product.stock === 0}
                  className="w-16 px-2 py-1 border rounded text-center text-sm"
                />
                <Button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.stock === 0}
                  className="flex-1"
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
