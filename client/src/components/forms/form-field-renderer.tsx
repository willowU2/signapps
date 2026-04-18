"use client";

/**
 * Unified form-field renderer for all 28 supported field types.
 * Used both in the builder preview and the public form page.
 * Applies optional per-field styling via FormField.style.
 */

import { useEffect, useRef, useState } from "react";
import type { FormField, FormFieldStyle } from "@/lib/api/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  ArrowUp,
  ArrowDown,
  Upload,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignatureField } from "./signature-field";
import { AddressMapField, type AddressValue } from "./address-map-field";

interface FormFieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

/** Build an inline style object from FormFieldStyle. */
function styleToCss(s?: FormFieldStyle): React.CSSProperties {
  if (!s) return {};
  return {
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontWeight:
      s.fontWeight === "medium"
        ? 500
        : s.fontWeight === "semibold"
          ? 600
          : s.fontWeight === "bold"
            ? 700
            : undefined,
    textAlign: s.textAlign,
    color: s.textColor,
    backgroundColor: s.backgroundColor,
    borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined,
    borderColor: s.borderColor,
    borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
    borderStyle: s.borderWidth ? "solid" : undefined,
    padding: s.padding ? `${s.padding}px` : undefined,
    accentColor: s.accentColor,
  };
}

function widthClass(w?: FormFieldStyle["width"]): string {
  switch (w) {
    case "half":
      return "w-full md:w-1/2";
    case "third":
      return "w-full md:w-1/3";
    case "quarter":
      return "w-full md:w-1/4";
    default:
      return "w-full";
  }
}

function shadowClass(s?: FormFieldStyle["shadow"]): string {
  switch (s) {
    case "sm":
      return "shadow-sm";
    case "md":
      return "shadow-md";
    case "lg":
      return "shadow-lg";
    default:
      return "";
  }
}

export function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: FormFieldRendererProps) {
  const style = field.style;
  const css = styleToCss(style);
  const wClass = widthClass(style?.width);
  const sClass = shadowClass(style?.shadow);
  const t = field.field_type;

  // ─── Content blocks (non-input) ───
  if (t === "Heading") {
    return (
      <h2 style={css} className={cn("text-2xl font-bold", sClass)}>
        {field.settings?.content || field.label}
      </h2>
    );
  }
  if (t === "Description") {
    return (
      <p style={css} className={cn("text-sm text-muted-foreground", sClass)}>
        {field.settings?.content || field.label}
      </p>
    );
  }
  if (t === "Divider") {
    return (
      <hr
        style={{
          borderColor: style?.borderColor || "#e5e7eb",
          borderWidth: style?.borderWidth ?? 1,
        }}
        className="my-2"
      />
    );
  }
  if (t === "Image") {
    return field.settings?.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={field.settings.imageUrl}
        alt={field.label}
        style={css}
        className={cn("max-w-full rounded-md", sClass)}
      />
    ) : (
      <div className="text-xs text-muted-foreground italic">
        (Bloc image — ajoute une URL dans Paramètres)
      </div>
    );
  }
  if (t === "PageBreak") {
    return (
      <div className="my-4 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground border-y border-dashed">
        — Saut de page —
      </div>
    );
  }

  // Label + description wrapper for all input fields
  const labelBlock = (
    <div className="space-y-1 mb-2">
      <Label
        className="text-sm font-medium"
        style={{
          fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
          fontWeight:
            style?.fontWeight === "bold"
              ? 700
              : style?.fontWeight === "semibold"
                ? 600
                : style?.fontWeight === "medium"
                  ? 500
                  : undefined,
          color: style?.textColor,
          textAlign: style?.textAlign,
        }}
      >
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );

  // ─── Text inputs ───
  if (
    t === "Text" ||
    t === "Email" ||
    t === "Url" ||
    t === "Phone" ||
    t === "Password"
  ) {
    const inputType =
      t === "Email"
        ? "email"
        : t === "Url"
          ? "url"
          : t === "Phone"
            ? "tel"
            : t === "Password"
              ? "password"
              : "text";
    return (
      <div className={wClass}>
        {labelBlock}
        <Input
          type={inputType}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          maxLength={field.settings?.maxLength}
          pattern={field.settings?.pattern}
          style={css}
          className={sClass}
        />
      </div>
    );
  }

  if (t === "TextArea") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          maxLength={field.settings?.maxLength}
          style={css}
          className={sClass}
        />
      </div>
    );
  }

  if (t === "Number") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.placeholder}
          disabled={disabled}
          min={field.settings?.min}
          max={field.settings?.max}
          step={field.settings?.step}
          style={css}
          className={sClass}
        />
      </div>
    );
  }

  // ─── Choices ───
  if (t === "SingleChoice") {
    return (
      <div className={wClass}>
        {labelBlock}
        <RadioGroup
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={disabled}
          style={{ accentColor: style?.accentColor }}
        >
          {(field.options || []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
              <Label
                htmlFor={`${field.id}-${i}`}
                className="text-sm font-normal cursor-pointer"
              >
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (t === "MultipleChoice") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="space-y-2">
          {(field.options || []).map((opt, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Checkbox
                id={`${field.id}-${i}`}
                checked={selected.includes(opt)}
                onCheckedChange={(chk) => {
                  const next = chk
                    ? [...selected, opt]
                    : selected.filter((s) => s !== opt);
                  onChange(next);
                }}
                disabled={disabled}
                style={{ accentColor: style?.accentColor }}
              />
              <Label
                htmlFor={`${field.id}-${i}`}
                className="text-sm font-normal cursor-pointer"
              >
                {opt}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (t === "Dropdown") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Select
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger style={css} className={sClass}>
            <SelectValue placeholder={field.placeholder || "Choisir..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt, i) => (
              <SelectItem key={i} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (t === "ImageChoice") {
    const opts = field.settings?.imageOptions || [];
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {opts.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.label)}
              className={cn(
                "relative aspect-square rounded-md border-2 overflow-hidden transition-all",
                value === o.label
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={o.imageUrl}
                alt={o.label}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center">
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (t === "YesNo") {
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="flex items-center gap-2">
          <Switch
            checked={value === true || value === "yes"}
            onCheckedChange={(v) => onChange(v)}
            disabled={disabled}
          />
          <span className="text-sm">
            {value === true || value === "yes" ? "Oui" : "Non"}
          </span>
        </div>
      </div>
    );
  }

  if (t === "Rating") {
    const rating = (value as number) ?? 0;
    const max = field.settings?.max ?? 5;
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(i + 1)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className="h-6 w-6"
                style={{
                  color:
                    i < rating ? style?.accentColor || "#eab308" : "#e5e7eb",
                  fill:
                    i < rating
                      ? style?.accentColor || "#eab308"
                      : "transparent",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (t === "LinearScale") {
    const min = field.settings?.min ?? 1;
    const max = field.settings?.max ?? 10;
    const current = (value as number) ?? min;
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{field.settings?.minLabel || min}</span>
            <span>{field.settings?.maxLabel || max}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: max - min + 1 }).map((_, i) => {
              const n = min + i;
              const active = current === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(n)}
                  className={cn(
                    "h-9 w-9 rounded-full border text-xs font-medium transition-all",
                    active ? "text-white" : "bg-background hover:bg-muted",
                  )}
                  style={{
                    backgroundColor: active
                      ? style?.accentColor || "#4f46e5"
                      : undefined,
                    borderColor: active
                      ? style?.accentColor || "#4f46e5"
                      : undefined,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (t === "NPS") {
    const current = (value as number) ?? -1;
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Pas du tout probable</span>
            <span>Très probable</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                className={cn(
                  "flex-1 h-9 rounded-md border text-xs font-semibold transition-all",
                  current === n
                    ? "text-white"
                    : n <= 6
                      ? "bg-red-50 hover:bg-red-100 border-red-200"
                      : n <= 8
                        ? "bg-amber-50 hover:bg-amber-100 border-amber-200"
                        : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
                )}
                style={{
                  backgroundColor:
                    current === n
                      ? style?.accentColor ||
                        (n <= 6 ? "#ef4444" : n <= 8 ? "#f59e0b" : "#10b981")
                      : undefined,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Date/Time ───
  if (t === "Date") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={css}
          className={sClass}
        />
      </div>
    );
  }
  if (t === "Time") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Input
          type="time"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={css}
          className={sClass}
        />
      </div>
    );
  }
  if (t === "DateTime") {
    return (
      <div className={wClass}>
        {labelBlock}
        <Input
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={css}
          className={sClass}
        />
      </div>
    );
  }

  // ─── Advanced ───
  if (t === "Slider") {
    const min = field.settings?.min ?? 0;
    const max = field.settings?.max ?? 100;
    const step = field.settings?.step ?? 1;
    const current = (value as number) ?? min;
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {field.settings?.minLabel || min}
            </span>
            <span className="font-semibold tabular-nums">{current}</span>
            <span className="text-muted-foreground">
              {field.settings?.maxLabel || max}
            </span>
          </div>
          <Slider
            value={[current]}
            min={min}
            max={max}
            step={step}
            onValueChange={([v]) => onChange(v)}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  if (t === "Color") {
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) || "#4f46e5"}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-9 w-14 rounded-md border cursor-pointer"
          />
          <Input
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-9 text-sm flex-1 font-mono"
          />
        </div>
      </div>
    );
  }

  if (t === "Address") {
    return (
      <div className={wClass}>
        {labelBlock}
        <AddressMapField
          value={value as AddressValue}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (t === "File") {
    return (
      <div className={wClass}>
        {labelBlock}
        <label
          className="flex items-center justify-center gap-2 h-20 rounded-md border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
          style={css}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {value instanceof File
              ? value.name
              : "Cliquer pour sélectionner un fichier"}
          </span>
          <input
            type="file"
            className="hidden"
            accept={field.settings?.acceptedTypes?.join(",")}
            disabled={disabled}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    );
  }

  if (t === "Signature") {
    return (
      <div className={wClass}>
        {labelBlock}
        <div style={css} className={sClass}>
          <SignatureField
            fieldId={field.id}
            onChange={(_id, v) => onChange(v)}
          />
        </div>
      </div>
    );
  }

  if (t === "Matrix") {
    const rows = field.settings?.rows || [];
    const cols = field.settings?.columns || [];
    const answers = (value as Record<string, string>) || {};
    return (
      <div className={wClass}>
        {labelBlock}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border">
            <thead>
              <tr>
                <th className="p-2 text-left"></th>
                {cols.map((c, i) => (
                  <th key={i} className="p-2 text-center font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t">
                  <td className="p-2">{r}</td>
                  {cols.map((c, ci) => (
                    <td key={ci} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`${field.id}-${ri}`}
                        checked={answers[r] === c}
                        onChange={() => onChange({ ...answers, [r]: c })}
                        disabled={disabled}
                        style={{ accentColor: style?.accentColor }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (t === "Ranking") {
    return (
      <RankingRenderer
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (t === "Consent") {
    return (
      <div className={wClass}>
        <div
          className="flex items-start gap-2 rounded-md p-3 border"
          style={css}
        >
          <Checkbox
            checked={value === true}
            onCheckedChange={(v) => onChange(v === true)}
            disabled={disabled}
            className="mt-0.5"
          />
          <div className="text-sm">
            <p>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </p>
            {field.settings?.consentUrl && (
              <a
                href={field.settings.consentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline mt-0.5 inline-block"
              >
                Lire les conditions
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground italic">
      Type de champ non supporté : {t}
    </div>
  );
}

// ─── Sub-component: Ranking with robust HTML5 drag-n-drop ───
// The dragged element identity is tracked via ref (not state) so re-renders
// during drag don't interrupt the browser's drag session.
function RankingRenderer({
  field,
  value,
  onChange,
  disabled,
}: FormFieldRendererProps) {
  const defaultItems = field.options || [];
  const [items, setItems] = useState<string[]>(() => {
    if (Array.isArray(value) && value.length > 0) return value as string[];
    return defaultItems;
  });
  // Highlight state (safe to re-render) — only indexes, not identities
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Stable drag id via ref — survives re-renders mid-drag
  const dragIdRef = useRef<string | null>(null);

  // Re-hydrate if parent options change (builder adds items)
  useEffect(() => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      setItems(defaultItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.options?.join("|")]);

  const commit = (next: string[]) => {
    setItems(next);
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const ni = i + dir;
    if (ni < 0 || ni >= items.length) return;
    const next = [...items];
    [next[i], next[ni]] = [next[ni], next[i]];
    commit(next);
  };

  const reset = () => commit([...defaultItems]);

  const accent = field.style?.accentColor || "#4f46e5";

  // ── Drag handlers ──
  const onDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox to initiate drag
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e: React.DragEvent, overIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const id = dragIdRef.current;
    if (!id) return;
    const currentIdx = items.indexOf(id);
    if (currentIdx === -1 || currentIdx === overIdx) {
      if (overIndex !== overIdx) setOverIndex(overIdx);
      return;
    }
    // Live reorder — commit on each index crossed
    const next = [...items];
    next.splice(currentIdx, 1);
    next.splice(overIdx, 0, id);
    commit(next);
    setOverIndex(overIdx);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragIdRef.current = null;
    setDraggingId(null);
    setOverIndex(null);
  };

  const onDragEnd = () => {
    dragIdRef.current = null;
    setDraggingId(null);
    setOverIndex(null);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="space-y-1 min-w-0">
          <Label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground italic">
            Glisse ou utilise les flèches pour classer (1 = préféré)
          </p>
        </div>
        {!disabled && items.join("|") !== defaultItems.join("|") && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded px-2 py-1"
            title="Réinitialiser l'ordre"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
      <div className="space-y-1.5" onDragOver={(e) => e.preventDefault()}>
        {items.map((it, i) => {
          const isDragging = draggingId === it;
          const isOver = overIndex === i && !isDragging;
          return (
            <div
              key={it}
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, it)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              className={cn(
                "relative flex items-center gap-2 rounded-md border bg-background px-2 py-2 select-none transition-opacity",
                !disabled && "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40 ring-2 ring-primary",
                isOver && "bg-primary/5",
              )}
            >
              {!disabled && (
                <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 pointer-events-none" />
              )}
              <span
                className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 pointer-events-none"
                style={{ backgroundColor: accent }}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-sm pointer-events-none">{it}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  title="Monter"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || i === items.length - 1}
                  onClick={() => move(i, 1)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  title="Descendre"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic border border-dashed rounded-md p-4 text-center">
          Aucun élément à classer — ajoute des options dans l&apos;éditeur.
        </p>
      )}
    </div>
  );
}
