"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { CellData, COLS, getEffectiveRows } from "./types";
import { X, GripVertical, Table2 } from "lucide-react";
import { toast } from "sonner";
import {
  AggFn,
  PivotField,
  PivotConfig,
  Zone,
  buildPivot,
} from "./pivot-engine";

function FieldChip({
  field,
  zone,
  agg,
  onRemove,
  onAggChange,
}: {
  field: PivotField;
  zone: Zone;
  agg?: AggFn;
  onRemove: () => void;
  onAggChange?: (a: AggFn) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${zone}-${field.id}`, data: { field, zone } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-1 px-2 py-1 bg-[#e8f0fe] dark:bg-[#394457] text-[12px] rounded border border-[#c2d7f8] dark:border-[#5f6368] select-none"
    >
      <span {...listeners} className="cursor-grab">
        <GripVertical className="w-3 h-3 text-[#5f6368]" />
      </span>
      <span className="truncate max-w-[100px]">{field.name}</span>
      {zone === "values" && onAggChange && (
        <select
          value={agg}
          onChange={(e) => onAggChange(e.target.value as AggFn)}
          className="bg-transparent text-[10px] outline-none border-none text-[#1a73e8] cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {(["SUM", "COUNT", "AVERAGE", "MIN", "MAX"] as AggFn[]).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
      <button onClick={onRemove} className="ml-auto hover:text-red-500">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function DropZone({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-1 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={cn(
          "min-h-[60px] rounded-lg border-2 border-dashed p-2 space-y-1 transition-colors",
          "border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#2d2e30]",
        )}
      >
        {children}
        {React.Children.count(children) === 0 && (
          <div className="text-[11px] text-[#9aa0a6] italic text-center py-2">
            Glisser ici
          </div>
        )}
      </div>
    </div>
  );
}

interface PivotTableProps {
  data: Record<string, CellData>;
  onClose: () => void;
  onInsertSheet: (name: string, gridData: Record<string, CellData>) => void;
}

export function PivotTableDialog({
  data,
  onClose,
  onInsertSheet,
}: PivotTableProps) {
  const { fields, rawData } = useMemo(() => {
    const headers: string[] = [];
    for (let c = 0; c < COLS; c++) {
      const v = data[`0,${c}`]?.value;
      if (!v) break;
      headers.push(v);
    }
    const fields: PivotField[] = headers.map((name, i) => ({
      id: `f${i}`,
      name,
      colIndex: i,
    }));
    const rows: string[][] = [];
    for (let r = 1; r < getEffectiveRows(data); r++) {
      const row: string[] = [];
      let has = false;
      for (let c = 0; c < headers.length; c++) {
        const v = data[`${r},${c}`]?.value ?? "";
        row.push(v);
        if (v) has = true;
      }
      if (!has) break;
      rows.push(row);
    }
    return { fields, rawData: rows };
  }, [data]);

  const [config, setConfig] = useState<PivotConfig>({
    rows: [],
    columns: [],
    values: [],
    filters: [],
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const availableFields = useMemo(() => {
    const used = new Set([
      ...config.rows.map((f) => f.id),
      ...config.columns.map((f) => f.id),
      ...config.values.map((v) => v.field.id),
      ...config.filters.map((f) => f.field.id),
    ]);
    return fields.filter((f) => !used.has(f.id));
  }, [fields, config]);

  const findFieldById = useCallback(
    (id: string): { field: PivotField; zone: Zone } | null => {
      const parts = id.split("-");
      const zone = parts[0] as Zone;
      const fid = parts.slice(1).join("-");
      const field = fields.find((f) => f.id === fid);
      return field ? { field, zone } : null;
    },
    [fields],
  );

  const removeFromZone = useCallback((zone: Zone, fid: string) => {
    setConfig((prev) => {
      const n = { ...prev };
      if (zone === "rows") n.rows = prev.rows.filter((f) => f.id !== fid);
      if (zone === "columns")
        n.columns = prev.columns.filter((f) => f.id !== fid);
      if (zone === "values")
        n.values = prev.values.filter((v) => v.field.id !== fid);
      if (zone === "filters")
        n.filters = prev.filters.filter((f) => f.field.id !== fid);
      return n;
    });
  }, []);

  const addToZone = useCallback(
    (zone: Zone, field: PivotField) => {
      setConfig((prev) => {
        const n = { ...prev };
        if (zone === "rows") n.rows = [...prev.rows, field];
        if (zone === "columns") n.columns = [...prev.columns, field];
        if (zone === "values")
          n.values = [...prev.values, { field, agg: "SUM" as AggFn }];
        if (zone === "filters") {
          const vals = new Set(rawData.map((r) => r[field.colIndex] ?? ""));
          n.filters = [...prev.filters, { field, selected: vals }];
        }
        return n;
      });
    },
    [rawData],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;
      const info = findFieldById(active.id as string);
      if (!info) return;
      const oid = over.id as string;
      let target: Zone = "available";
      if (oid.startsWith("rows-") || oid === "zone-rows") target = "rows";
      else if (oid.startsWith("columns-") || oid === "zone-columns")
        target = "columns";
      else if (oid.startsWith("values-") || oid === "zone-values")
        target = "values";
      else if (oid.startsWith("filters-") || oid === "zone-filters")
        target = "filters";
      if (info.zone === target) return;
      if (info.zone !== "available") removeFromZone(info.zone, info.field.id);
      if (target !== "available") addToZone(target, info.field);
    },
    [findFieldById, removeFromZone, addToZone],
  );

  const result = useMemo(() => buildPivot(rawData, config), [rawData, config]);

  const handleInsert = useCallback(() => {
    if (!result.headers.length || !result.rows.length) {
      toast.info("Configurez au moins un champ Lignes et un champ Valeurs");
      return;
    }
    const gd: Record<string, CellData> = {};
    result.headers.forEach((h, c) => {
      gd[`0,${c}`] = { value: h, style: { bold: true, fillColor: "#e8f0fe" } };
    });
    result.rows.forEach((row, r) => {
      row.forEach((val, c) => {
        gd[`${r + 1},${c}`] = { value: val };
      });
    });
    onInsertSheet("Pivot", gd);
    toast.success("Tableau croise dynamique insere");
    onClose();
  }, [result, onInsertSheet, onClose]);

  if (fields.length === 0) {
    return (
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]"
        onClick={onClose}
      >
        <div
          className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-6 w-[400px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-center">
            Aucun en-tete detecte. La premiere ligne doit contenir les noms de
            colonnes.
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full h-9 bg-[#1a73e8] text-white rounded text-[13px] hover:bg-[#1557b0]"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const rowIds = config.rows.map((f) => `rows-${f.id}`),
    colIds = config.columns.map((f) => `columns-${f.id}`);
  const valIds = config.values.map((v) => `values-${v.field.id}`),
    filtIds = config.filters.map((f) => `filters-${f.field.id}`);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl w-[820px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#dadce0] dark:border-[#5f6368]">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-[#1a73e8]" />
            <span className="font-medium text-[15px]">
              Tableau croise dynamique
            </span>
            <span className="text-[12px] text-[#5f6368]">
              ({rawData.length} lignes, {fields.length} colonnes)
            </span>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[180px] border-r border-[#dadce0] dark:border-[#5f6368] p-3 overflow-y-auto">
              <div className="text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] mb-2 uppercase tracking-wide">
                Champs
              </div>
              <SortableContext
                items={availableFields.map((f) => `available-${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {availableFields.map((f) => (
                    <FieldChip
                      key={`av-${f.id}`}
                      field={f}
                      zone="available"
                      onRemove={() => {}}
                    />
                  ))}
                </div>
              </SortableContext>
              {availableFields.length === 0 && (
                <div className="text-[11px] text-[#9aa0a6] italic">
                  Tous assignes
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <SortableContext
                  items={[...rowIds, "zone-rows"]}
                  strategy={verticalListSortingStrategy}
                >
                  <DropZone label="Lignes">
                    {config.rows.map((f) => (
                      <FieldChip
                        key={`r-${f.id}`}
                        field={f}
                        zone="rows"
                        onRemove={() => removeFromZone("rows", f.id)}
                      />
                    ))}
                  </DropZone>
                </SortableContext>
                <SortableContext
                  items={[...colIds, "zone-columns"]}
                  strategy={verticalListSortingStrategy}
                >
                  <DropZone label="Colonnes">
                    {config.columns.map((f) => (
                      <FieldChip
                        key={`c-${f.id}`}
                        field={f}
                        zone="columns"
                        onRemove={() => removeFromZone("columns", f.id)}
                      />
                    ))}
                  </DropZone>
                </SortableContext>
                <SortableContext
                  items={[...valIds, "zone-values"]}
                  strategy={verticalListSortingStrategy}
                >
                  <DropZone label="Valeurs">
                    {config.values.map((v) => (
                      <FieldChip
                        key={`v-${v.field.id}`}
                        field={v.field}
                        zone="values"
                        agg={v.agg}
                        onRemove={() => removeFromZone("values", v.field.id)}
                        onAggChange={(a) =>
                          setConfig((p) => ({
                            ...p,
                            values: p.values.map((x) =>
                              x.field.id === v.field.id ? { ...x, agg: a } : x,
                            ),
                          }))
                        }
                      />
                    ))}
                  </DropZone>
                </SortableContext>
                <SortableContext
                  items={[...filtIds, "zone-filters"]}
                  strategy={verticalListSortingStrategy}
                >
                  <DropZone label="Filtres">
                    {config.filters.map((f) => (
                      <FieldChip
                        key={`fi-${f.field.id}`}
                        field={f.field}
                        zone="filters"
                        onRemove={() => removeFromZone("filters", f.field.id)}
                      />
                    ))}
                  </DropZone>
                </SortableContext>
              </div>
              <div className="flex gap-1 flex-wrap">
                {availableFields.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      const sample = rawData
                        .slice(0, 10)
                        .map((r) => r[f.colIndex]);
                      const nr =
                        sample.filter((v) => v && !isNaN(Number(v))).length /
                        Math.max(sample.length, 1);
                      nr > 0.5 ? addToZone("values", f) : addToZone("rows", f);
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#e8f0fe] dark:hover:bg-[#394457] transition-colors"
                  >
                    + {f.name}
                  </button>
                ))}
              </div>
              {result.headers.length > 0 && (
                <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-lg overflow-auto max-h-[280px]">
                  <table className="text-[12px] w-full border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-[#f1f3f4] dark:bg-[#3c4043]">
                        {result.headers.map((h, i) => (
                          <th
                            key={i}
                            className="px-3 py-1.5 text-left font-medium border-b border-[#dadce0] dark:border-[#5f6368] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 50).map((row, ri) => (
                        <tr
                          key={ri}
                          className={
                            ri % 2 === 1 ? "bg-[#f8f9fa] dark:bg-[#252526]" : ""
                          }
                        >
                          {row.map((v, ci) => (
                            <td
                              key={ci}
                              className="px-3 py-1 border-b border-[#e3e3e3] dark:border-[#3c4043] whitespace-nowrap"
                            >
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rows.length > 50 && (
                    <div className="text-[11px] text-[#5f6368] text-center py-1">
                      ... et {result.rows.length - 50} lignes de plus
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DragOverlay>
            {activeId &&
              (() => {
                const i = findFieldById(activeId);
                return i ? (
                  <div className="px-2 py-1 bg-[#e8f0fe] dark:bg-[#394457] text-[12px] rounded border border-[#1a73e8] shadow-lg">
                    {i.field.name}
                  </div>
                ) : null;
              })()}
          </DragOverlay>
        </DndContext>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#dadce0] dark:border-[#5f6368]">
          <button
            onClick={onClose}
            className="px-4 h-9 border border-[#dadce0] dark:border-[#5f6368] rounded text-[13px] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]"
          >
            Annuler
          </button>
          <button
            onClick={handleInsert}
            className="px-4 h-9 bg-[#1a73e8] text-white rounded text-[13px] hover:bg-[#1557b0] font-medium"
          >
            Inserer en nouvel onglet
          </button>
        </div>
      </div>
    </div>
  );
}
