'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle2, Truck, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineStep {
  status: 'ordered' | 'shipped' | 'in-transit' | 'delivered';
  timestamp: string;
  location?: string;
  details?: string;
}

interface TraceabilityCard {
  id: string;
  productName: string;
  sku: string;
  manufacturer: string;
  currentStatus: TimelineStep['status'];
  timeline: TimelineStep[];
}

interface SupplyChainProps {
  products?: TraceabilityCard[];
}

export function SupplyChain({ products = [] }: SupplyChainProps) {
  const getStepIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'ordered':
        return <Package className="w-5 h-5" />;
      case 'shipped':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'in-transit':
        return <Truck className="w-5 h-5" />;
      case 'delivered':
        return <MapPin className="w-5 h-5" />;
    }
  };

  const getStepColor = (status: TimelineStep['status']) => {
    switch (status) {
      case 'ordered':
        return 'text-blue-600 bg-blue-50';
      case 'shipped':
        return 'text-green-600 bg-green-50';
      case 'in-transit':
        return 'text-yellow-600 bg-yellow-50';
      case 'delivered':
        return 'text-purple-600 bg-purple-50';
    }
  };

  const getStatusLabel = (status: TimelineStep['status']) => {
    return status
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Supply Chain Traceability</h2>
        <p className="text-sm text-slate-500 mt-1">Track product journey from production to delivery</p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No products to track</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{product.productName}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      SKU: {product.sku} • Mfr: {product.manufacturer}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {getStatusLabel(product.currentStatus)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Timeline Steps */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {['ordered', 'shipped', 'in-transit', 'delivered'].map((step) => {
                        const isActive =
                          ['ordered', 'shipped', 'in-transit', 'delivered'].indexOf(
                            step as TimelineStep['status']
                          ) <=
                          ['ordered', 'shipped', 'in-transit', 'delivered'].indexOf(
                            product.currentStatus
                          );

                        return (
                          <div key={step} className="flex flex-col items-center flex-1">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-2 transition',
                                isActive
                                  ? getStepColor(step as TimelineStep['status'])
                                  : 'bg-slate-200 text-slate-600'
                              )}
                            >
                              {step === 'ordered' && '1'}
                              {step === 'shipped' && '2'}
                              {step === 'in-transit' && '3'}
                              {step === 'delivered' && '4'}
                            </div>
                            <p className="text-xs font-medium text-center">
                              {getStatusLabel(step as TimelineStep['status'])}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline connector */}
                    <div className="flex gap-1 mb-3">
                      {[0, 1, 2].map((idx) => {
                        const nextStepIndex =
                          ['ordered', 'shipped', 'in-transit', 'delivered'].indexOf(
                            product.currentStatus
                          );
                        const isConnecté = idx < nextStepIndex;

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'h-1 flex-1 rounded-full transition',
                              isConnecté ? 'bg-slate-400' : 'bg-slate-200'
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Timeline Details */}
                  <div className="border-t pt-3 space-y-2">
                    {product.timeline.map((step, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className={cn('flex-shrink-0 mt-1', getStepColor(step.status))}>
                          {getStepIcon(step.status)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">
                            {getStatusLabel(step.status)}
                          </p>
                          {step.location && (
                            <p className="text-xs text-slate-500">📍 {step.location}</p>
                          )}
                          {step.details && (
                            <p className="text-xs text-slate-600 mt-1">{step.details}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(step.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
