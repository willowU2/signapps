"use client";

/**
 * widget-picker - dialog that lets the admin choose which custom
 * widget to append to the panel layout. Each widget has its own
 * minimal form to fill the required config fields.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WidgetType = "kpi_card" | "iframe_embed" | "link_list" | "markdown_note";

const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi_card: "KPI Card",
  iframe_embed: "Iframe externe",
  link_list: "Liste de liens",
  markdown_note: "Note markdown",
};

export interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (widgetType: WidgetType, config: Record<string, unknown>) => void;
}

export function WidgetPicker({ open, onClose, onPick }: WidgetPickerProps) {
  const [widgetType, setWidgetType] = useState<WidgetType>("kpi_card");
  const [label, setLabel] = useState("");
  const [metric, setMetric] = useState("headcount");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState("");

  const buildConfig = (): Record<string, unknown> => {
    switch (widgetType) {
      case "kpi_card":
        return { metric, label: label.trim() };
      case "iframe_embed":
        return { url, label: label.trim() || "Embed" };
      case "markdown_note":
        return { title: label.trim() || "Note", body };
      case "link_list": {
        const parsed = items
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [l, u] = line.split("|").map((s) => s.trim());
            if (!u) return null;
            return { label: l, url: u };
          })
          .filter(Boolean);
        return { title: label.trim() || "Liens", items: parsed };
      }
      default:
        return {};
    }
  };

  const handleSubmit = () => {
    onPick(widgetType, buildConfig());
    // reset form
    setLabel("");
    setMetric("headcount");
    setUrl("");
    setBody("");
    setItems("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un widget</DialogTitle>
          <DialogDescription>
            Les widgets apparaissent comme un onglet custom dans le panneau.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select
              value={widgetType}
              onValueChange={(v) => setWidgetType(v as WidgetType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {WIDGET_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Libellé</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Effectif live"
            />
          </div>

          {widgetType === "kpi_card" && (
            <div>
              <Label>Métrique builtin</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="headcount">headcount</SelectItem>
                  <SelectItem value="positions_open">positions_open</SelectItem>
                  <SelectItem value="raci_count">raci_count</SelectItem>
                  <SelectItem value="delegations_active">
                    delegations_active
                  </SelectItem>
                  <SelectItem value="audit_events_week">
                    audit_events_week
                  </SelectItem>
                  <SelectItem value="assignments_active">
                    assignments_active
                  </SelectItem>
                  <SelectItem value="skills_top">skills_top</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {widgetType === "iframe_embed" && (
            <div>
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://dashboard.example.com/embed"
              />
            </div>
          )}

          {widgetType === "markdown_note" && (
            <div>
              <Label>Contenu markdown</Label>
              <Textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="# Titre\n\n- Point 1\n- Point 2"
              />
            </div>
          )}

          {widgetType === "link_list" && (
            <div>
              <Label>Liens (1 par ligne, format &quot;label|url&quot;)</Label>
              <Textarea
                rows={4}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder="Wiki|https://wiki.example.com"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
