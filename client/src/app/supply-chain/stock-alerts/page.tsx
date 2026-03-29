'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, TrendingDown, TrendingUp, Bell, BellOff, Plus, Settings, CheckCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { usePageTitle } from '@/hooks/use-page-title';

interface AlertRule {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  minThreshold: number;
  maxThreshold: number;
  currentStock: number;
  unit: string;
  alertEmail: boolean;
  alertDashboard: boolean;
  active: boolean;
}

interface StockAlert {
  id: string;
  ruleId: string;
  itemName: string;
  type: 'low' | 'out' | 'overstock';
  currentStock: number;
  threshold: number;
  triggeredAt: Date;
  resolved: boolean;
}

const RULES: AlertRule[] = [
  { id: '1', itemId: 'i1', itemName: 'Office Chair', sku: 'OFF-001', category: 'Furniture', minThreshold: 5, maxThreshold: 30, currentStock: 8, unit: 'pcs', alertEmail: true, alertDashboard: true, active: true },
  { id: '2', itemId: 'i2', itemName: 'Standing Desk', sku: 'OFF-002', category: 'Furniture', minThreshold: 5, maxThreshold: 20, currentStock: 3, unit: 'pcs', alertEmail: true, alertDashboard: true, active: true },
  { id: '3', itemId: 'i3', itemName: 'Laptop Stand', sku: 'IT-001', category: 'IT Equipment', minThreshold: 3, maxThreshold: 15, currentStock: 0, unit: 'pcs', alertEmail: false, alertDashboard: true, active: true },
  { id: '4', itemId: 'i4', itemName: 'USB-C Hub', sku: 'IT-002', category: 'IT Equipment', minThreshold: 10, maxThreshold: 50, currentStock: 45, unit: 'pcs', alertEmail: false, alertDashboard: true, active: true },
  { id: '5', itemId: 'i5', itemName: 'Printer Ink', sku: 'SUP-002', category: 'Supplies', minThreshold: 5, maxThreshold: 20, currentStock: 2, unit: 'pcs', alertEmail: true, alertDashboard: true, active: true },
  { id: '6', itemId: 'i6', itemName: 'A4 Paper', sku: 'SUP-001', category: 'Supplies', minThreshold: 100, maxThreshold: 500, currentStock: 220, unit: 'reams', alertEmail: false, alertDashboard: false, active: false },
];

const getAlertType = (rule: AlertRule): 'low' | 'out' | 'overstock' | null => {
  if (rule.currentStock === 0) return 'out';
  if (rule.currentStock <= rule.minThreshold) return 'low';
  if (rule.currentStock >= rule.maxThreshold) return 'overstock';
  return null;
};

const ACTIVE_ALERTS: StockAlert[] = RULES.filter(r => r.active && getAlertType(r)).map(r => ({
  id: r.id, ruleId: r.id, itemName: r.itemName, type: getAlertType(r)!, currentStock: r.currentStock,
  threshold: getAlertType(r) === 'overstock' ? r.maxThreshold : r.minThreshold,
  triggeredAt: new Date(Date.now() - Math.random() * 86400000 * 3), resolved: false,
}));

const alertTypeConfig = {
  out: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle, bgColor: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' },
  low: { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: TrendingDown, bgColor: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20' },
  overstock: { label: 'Overstock', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: TrendingUp, bgColor: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20' },
};

export default function StockAlertsPage() {
  usePageTitle('Alertes stock');
  const [rules, setRules] = useState<AlertRule[]>(RULES);
  const [alerts, setAlerts] = useState<StockAlert[]>(ACTIVE_ALERTS);
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const toggleRule = (id: string, field: 'active' | 'alertEmail' | 'alertDashboard', val: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    toast.success('Alert setting updated');
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast.success('Alert resolved');
  };

  const openAlert = ACTIVE_ALERTS.filter(a => !a.resolved);
  const activeRules = rules.filter(r => r.active);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 relative">
              <Bell className="h-5 w-5 text-primary" />
              {alerts.length > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">{alerts.length}</span>}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Stock Alerts</h1>
              <p className="text-sm text-muted-foreground">Low stock and overstock thresholds with notifications</p>
            </div>
          </div>
        </div>

        {/* Alert summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { type: 'out', count: alerts.filter(a => a.type === 'out').length },
            { type: 'low', count: alerts.filter(a => a.type === 'low').length },
            { type: 'overstock', count: alerts.filter(a => a.type === 'overstock').length },
          ].map(({ type, count }) => {
            const tc = alertTypeConfig[type as keyof typeof alertTypeConfig];
            const Icon = tc.icon;
            return (
              <Card key={type} className={cn(count > 0 && tc.bgColor)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={cn('h-6 w-6', count > 0 ? 'text-current' : 'text-muted-foreground')} />
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground capitalize">{type === 'out' ? 'Out of Stock' : type === 'low' ? 'Low Stock' : 'Overstock'}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active Alerts {alerts.length > 0 && <Badge className="ml-1 h-4 px-1 text-xs">{alerts.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="rules">Alert Rules ({rules.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {alerts.length === 0 && <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-muted-foreground"><CheckCircle className="h-8 w-8 mb-2 text-green-500 opacity-60" /><p>No active alerts — all stock levels are normal!</p></CardContent></Card>}
            {alerts.map(alert => {
              const tc = alertTypeConfig[alert.type];
              const Icon = tc.icon;
              return (
                <Card key={alert.id} className={cn('border', tc.bgColor)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-card dark:bg-gray-800 flex items-center justify-center shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{alert.itemName}</span>
                            <Badge className={cn('text-xs', tc.color)}>{tc.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Current: <span className="font-bold">{alert.currentStock}</span> · Threshold: {alert.threshold}
                          </p>
                          <p className="text-xs text-muted-foreground">{format(alert.triggeredAt, 'MMM d, HH:mm')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toast.success('Reorder initiated')}>Reorder</Button>
                        <Button size="sm" variant="ghost" onClick={() => resolveAlert(alert.id)}>Resolve</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-4 text-left font-medium">Item</th><th className="p-4 text-right font-medium">Stock</th><th className="p-4 text-right font-medium">Min</th><th className="p-4 text-right font-medium">Max</th><th className="p-4 text-center font-medium">Email</th><th className="p-4 text-center font-medium">Dashboard</th><th className="p-4 text-center font-medium">Active</th></tr></thead>
                    <tbody>
                      {rules.map(rule => {
                        const alertType = getAlertType(rule);
                        const tc = alertType ? alertTypeConfig[alertType] : null;
                        return (
                          <tr key={rule.id} className={cn('border-b hover:bg-muted/30', !rule.active && 'opacity-50')}>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {tc && <tc.icon className="h-4 w-4" />}
                                <div>
                                  <div className="font-medium">{rule.itemName}</div>
                                  <div className="text-xs text-muted-foreground">{rule.sku} · {rule.category}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <span className={cn('font-bold', alertType === 'out' ? 'text-red-600' : alertType === 'low' ? 'text-yellow-600' : alertType === 'overstock' ? 'text-blue-600' : '')}>
                                {rule.currentStock} {rule.unit}
                              </span>
                            </td>
                            <td className="p-4 text-right text-muted-foreground">{rule.minThreshold}</td>
                            <td className="p-4 text-right text-muted-foreground">{rule.maxThreshold}</td>
                            <td className="p-4 text-center"><Switch checked={rule.alertEmail} onCheckedChange={v => toggleRule(rule.id, 'alertEmail', v)} /></td>
                            <td className="p-4 text-center"><Switch checked={rule.alertDashboard} onCheckedChange={v => toggleRule(rule.id, 'alertDashboard', v)} /></td>
                            <td className="p-4 text-center"><Switch checked={rule.active} onCheckedChange={v => toggleRule(rule.id, 'active', v)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
