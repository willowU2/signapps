"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Star } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  sector: string;
  rating: number;
  email: string;
  phone: string;
  country: string;
  website?: string;
}

const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: "1",
    name: "TechSupply Inc",
    sector: "Electronics & Components",
    rating: 4.7,
    email: "contact@techsupply.com",
    phone: "+1-555-0101",
    country: "United States",
    website: "www.techsupply.com",
  },
  {
    id: "2",
    name: "Global Components Ltd",
    sector: "Industrial Parts",
    rating: 4.2,
    email: "sales@globalcomponents.co.uk",
    phone: "+44-20-7946-0958",
    country: "United Kingdom",
    website: "www.globalcomponents.co.uk",
  },
  {
    id: "3",
    name: "Premium Parts Co",
    sector: "High-End Manufacturing",
    rating: 4.9,
    email: "orders@premiumparts.de",
    phone: "+49-30-123456",
    country: "Germany",
    website: "www.premiumparts.de",
  },
  {
    id: "4",
    name: "Budget Suppliers Ltd",
    sector: "Cost-Effective Solutions",
    rating: 3.8,
    email: "info@budgetsuppliers.com",
    phone: "+886-2-2345-6789",
    country: "Taiwan",
    website: "www.budgetsuppliers.com",
  },
];

export default function SupplierCatalog() {
  const [suppliers] = useState<Supplier[]>(DEFAULT_SUPPLIERS);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
        {suppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="rounded-lg border hover:shadow-lg transition-shadow"
          >
            <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <h3 className="text-lg font-bold">{supplier.name}</h3>
              <p className="text-sm text-muted-foreground">{supplier.sector}</p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Rating
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {supplier.rating}/5.0
                  </span>
                </div>
                {renderStars(supplier.rating)}
              </div>

              <div className="border-t pt-3 space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-muted-foreground">
                    {supplier.country}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <a
                    href={`mailto:${supplier.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {supplier.email}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <a
                    href={`tel:${supplier.phone}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {supplier.phone}
                  </a>
                </div>

                {supplier.website && (
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Web:
                    </span>
                    <a
                      href={`https://${supplier.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <button className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
