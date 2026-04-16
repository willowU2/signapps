"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit2,
} from "lucide-react";

interface CustomKPI {
  id: string;
  title: string;
  value: string;
  unit: string;
  target: string;
  trend: number;
  color: string;
  period: string;
}

const COLORS = ["blue", "green", "orange", "purple", "red"];
const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  green: "bg-green-500/10 text-green-600 border-green-500/20",
  orange: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  red: "bg-red-500/10 text-red-600 border-red-500/20",
};

const DEFAULTS: CustomKPI[] = [
  {
    id: "1",
    title: "Response Time",
    value: "245",
    unit: "ms",
    target: "300",
    trend: -12.4,
    color: "green",
    period: "P95",
  },
  {
    id: "2",
    title: "Uptime",
    value: "99.97",
    unit: "%",
    target: "99.9",
    trend: 0.02,
    color: "blue",
    period: "30d",
  },
  {
    id: "3",
    title: "Active Users",
    value: "1,240",
    unit: "users",
    target: "1,500",
    trend: 8.3,
    color: "purple",
    period: "DAU",
  },
];

export function CustomKPIDashboard() {
  const [kpis, setKpis] = useState<CustomKPI[]>(DEFAULTS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editKpi, setEditKpi] = useState<CustomKPI | null>(null);
  const [form, setForm] = useState({
    title: "",
    value: "",
    unit: "",
    target: "",
    trend: "0",
    color: "blue",
    period: "monthly",
  });

  const openNew = () => {
    setEditKpi(null);
    setForm({
      title: "",
      value: "",
      unit: "",
      target: "",
      trend: "0",
      color: "blue",
      period: "monthly",
    });
    setDialogOpen(true);
  };
  const openEdit = (kpi: CustomKPI) => {
    setEditKpi(kpi);
    setForm({
      title: kpi.title,
      value: kpi.value,
      unit: kpi.unit,
      target: kpi.target,
      trend: String(kpi.trend),
      color: kpi.color,
      period: kpi.period,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) {
      toast.error("Titre requis");
      return;
    }
    if (editKpi) {
      setKpis((ks) =>
        ks.map((k) =>
          k.id === editKpi.id
            ? { ...k, ...form, trend: parseFloat(form.trend) }
            : k,
        ),
      );
    } else {
      setKpis((ks) => [
        ...ks,
        { id: Date.now().toString(), ...form, trend: parseFloat(form.trend) },
      ]);
    }
    setDialogOpen(false);
    toast.success(editKpi ? "KPI updated" : "KPI added");
  };

  const remove = (id: string) => {
    setKpis((ks) => ks.filter((k) => k.id !== id));
    toast.success("KPI removed");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Custom KPI Dashboard</h2>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Add KPI
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const isPositive = kpi.trend > 0;
          const isNeutral = kpi.trend === 0;
          const valueNum = parseFloat(kpi.value.replace(/,/g, ""));
          const targetNum = parseFloat(kpi.target.replace(/,/g, ""));
          const pct =
            isNaN(valueNum) || isNaN(targetNum) || targetNum === 0
              ? 0
              : Math.min(100, (valueNum / targetNum) * 100);
          return (
            <Card
              key={kpi.id}
              className={`border ${COLOR_CLASSES[kpi.color] || ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {kpi.title}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => openEdit(kpi)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      onClick={() => remove(kpi.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{kpi.value}</span>
                  <span className="text-sm text-muted-foreground">
                    {kpi.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isNeutral ? (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  ) : isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs ${isPositive ? "text-green-600" : isNeutral ? "text-muted-foreground" : "text-red-600"}`}
                  >
                    {isPositive ? "+" : ""}
                    {kpi.trend}%
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {kpi.period}
                  </Badge>
                </div>
                {kpi.target && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        vs target {kpi.target} {kpi.unit}
                      </span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-current rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {kpis.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            No KPIs yet. Add your first KPI.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editKpi ? "Edit KPI" : "New KPI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Current Value</Label>
                <Input
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Input
                  placeholder="ms, %, users..."
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Target</Label>
                <Input
                  value={form.target}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Trend %</Label>
                <Input
                  type="number"
                  value={form.trend}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, trend: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Period Label</Label>
                <Input
                  placeholder="monthly, DAU..."
                  value={form.period}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, period: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Select
                  value={form.color}
                  onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save}>{editKpi ? "Update" : "Add"} KPI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomKPIDashboard;
