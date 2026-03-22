"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DataSource = "users" | "storage" | "calendar" | "tasks";

interface Column {
  id: string;
  label: string;
  source: DataSource;
}

interface Filter {
  id: string;
  column: string;
  operator: "equals" | "contains" | "gt" | "lt";
  value: string;
}

interface ReportConfig {
  name: string;
  source: DataSource | null;
  columns: Set<string>;
  filters: Filter[];
}

interface ReportData {
  [key: string]: string | number | boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_SOURCES: Record<DataSource, string> = {
  users: "Users",
  storage: "Storage",
  calendar: "Calendar",
  tasks: "Tasks",
};

const COLUMN_MAP: Record<DataSource, Column[]> = {
  users: [
    { id: "id", label: "ID", source: "users" },
    { id: "email", label: "Email", source: "users" },
    { id: "name", label: "Name", source: "users" },
    { id: "created_at", label: "Created At", source: "users" },
    { id: "active", label: "Active", source: "users" },
  ],
  storage: [
    { id: "id", label: "File ID", source: "storage" },
    { id: "name", label: "File Name", source: "storage" },
    { id: "size", label: "Size (MB)", source: "storage" },
    { id: "owner", label: "Owner", source: "storage" },
    { id: "modified_at", label: "Modified At", source: "storage" },
  ],
  calendar: [
    { id: "id", label: "Event ID", source: "calendar" },
    { id: "title", label: "Title", source: "calendar" },
    { id: "start_time", label: "Start Time", source: "calendar" },
    { id: "end_time", label: "End Time", source: "calendar" },
    { id: "attendees", label: "Attendees", source: "calendar" },
  ],
  tasks: [
    { id: "id", label: "Task ID", source: "tasks" },
    { id: "title", label: "Title", source: "tasks" },
    { id: "status", label: "Status", source: "tasks" },
    { id: "assignee", label: "Assignee", source: "tasks" },
    { id: "due_date", label: "Due Date", source: "tasks" },
  ],
};

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
];

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

function generateMockData(source: DataSource, columns: string[]): ReportData[] {
  const mockRows: ReportData[] = [];
  const rowCount = 5;

  for (let i = 0; i < rowCount; i++) {
    const row: ReportData = {};
    columns.forEach((col) => {
      switch (source) {
        case "users":
          row[col] =
            col === "id"
              ? `USR${String(i + 1).padStart(3, "0")}`
              : col === "email"
                ? `user${i + 1}@example.com`
                : col === "name"
                  ? `User ${i + 1}`
                  : col === "created_at"
                    ? "2024-01-15"
                    : col === "active"
                      ? i % 2 === 0
                      : "";
          break;
        case "storage":
          row[col] =
            col === "id"
              ? `FILE${String(i + 1).padStart(3, "0")}`
              : col === "name"
                ? `document-${i + 1}.pdf`
                : col === "size"
                  ? (Math.random() * 100).toFixed(2)
                  : col === "owner"
                    ? `user${i + 1}@example.com`
                    : col === "modified_at"
                      ? "2024-02-20"
                      : "";
          break;
        case "calendar":
          row[col] =
            col === "id"
              ? `EVT${String(i + 1).padStart(3, "0")}`
              : col === "title"
                ? `Meeting ${i + 1}`
                : col === "start_time"
                  ? "10:00 AM"
                  : col === "end_time"
                    ? "11:00 AM"
                    : col === "attendees"
                      ? `${2 + i} people`
                      : "";
          break;
        case "tasks":
          row[col] =
            col === "id"
              ? `TSK${String(i + 1).padStart(3, "0")}`
              : col === "title"
                ? `Task ${i + 1}`
                : col === "status"
                  ? ["Open", "In Progress", "Done"][i % 3]
                  : col === "assignee"
                    ? `user${(i % 3) + 1}@example.com`
                    : col === "due_date"
                      ? "2024-03-01"
                      : "";
          break;
      }
    });
    mockRows.push(row);
  }

  return mockRows;
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-sm ${
              i === current ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className="mx-1 h-px w-8 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReportBuilder() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ReportConfig>({
    name: "",
    source: null,
    columns: new Set(),
    filters: [],
  });
  const [previewData, setPreviewData] = useState<ReportData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const steps = [
    "Select Data Source",
    "Select Columns",
    "Add Filters",
    "Preview & Export",
  ];

  const availableColumns =
    config.source && config.source in COLUMN_MAP
      ? COLUMN_MAP[config.source]
      : [];

  const toggleColumn = (colId: string) => {
    setConfig((prev) => {
      const next = new Set(prev.columns);
      next.has(colId) ? next.delete(colId) : next.add(colId);
      return { ...prev, columns: next };
    });
  };

  const addFilter = () => {
    setConfig((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          id: `filter-${Date.now()}`,
          column: availableColumns[0]?.id || "",
          operator: "equals",
          value: "",
        },
      ],
    }));
  };

  const updateFilter = (
    filterId: string,
    field: keyof Filter,
    value: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.map((f) =>
        f.id === filterId ? { ...f, [field]: value } : f
      ),
    }));
  };

  const deleteFilter = (filterId: string) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== filterId),
    }));
  };

  const handlePreview = () => {
    if (!config.source || config.columns.size === 0) return;
    const columnArray = Array.from(config.columns);
    const data = generateMockData(config.source, columnArray);
    setPreviewData(data);
    setShowPreview(true);
  };

  const handleSourceChange = (source: string) => {
    setConfig((prev) => ({
      ...prev,
      source: source as DataSource,
      columns: new Set(),
      filters: [],
    }));
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Report Builder</h2>
        <p className="text-sm text-muted-foreground">
          Create custom reports from your data sources.
        </p>
      </div>

      <StepIndicator steps={steps} current={step} />

      {/* ================================================================== */}
      {/* Step 0 — Select Data Source                                       */}
      {/* ================================================================== */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Choose a data source:</p>
          {(Object.keys(DATA_SOURCES) as DataSource[]).map((s) => (
            <button
              key={s}
              onClick={() => handleSourceChange(s)}
              className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                config.source === s
                  ? "border-primary bg-primary/5 font-medium"
                  : "hover:bg-muted"
              }`}
            >
              {DATA_SOURCES[s]}
            </button>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(1)} disabled={!config.source}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 1 — Select Columns                                           */}
      {/* ================================================================== */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">
            Select columns from{" "}
            <span className="text-primary">
              {config.source ? DATA_SOURCES[config.source] : ""}
            </span>
            :
          </p>
          <div className="space-y-3 rounded-md border p-4">
            {availableColumns.map(({ id, label }) => (
              <div key={id} className="flex items-center gap-3">
                <Checkbox
                  id={`col-${id}`}
                  checked={config.columns.has(id)}
                  onCheckedChange={() => toggleColumn(id)}
                />
                <Label htmlFor={`col-${id}`} className="cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={config.columns.size === 0}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 2 — Add Filters                                              */}
      {/* ================================================================== */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Add filters (optional):</p>
          <div className="space-y-3 rounded-md border p-4">
            {config.filters.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No filters added yet. Click "Add Filter" to start.
              </p>
            )}
            {config.filters.map((filter) => (
              <div key={filter.id} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Column</Label>
                  <Select value={filter.column} onValueChange={(v) => updateFilter(filter.id, "column", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map(({ id, label }) => (
                        <SelectItem key={id} value={id}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Operator</Label>
                  <Select value={filter.operator} onValueChange={(v) => updateFilter(filter.id, "operator", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input
                    placeholder="Enter value"
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteFilter(filter.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={addFilter} className="w-full">
            Add Filter
          </Button>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Step 3 — Preview & Export                                         */}
      {/* ================================================================== */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Preview and export your report:</p>
          <div className="rounded-md border p-4 space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Data Source:</span>
              <span>{config.source ? DATA_SOURCES[config.source] : "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Columns:</span>
              <span>
                {availableColumns
                  .filter((c) => config.columns.has(c.id))
                  .map((c) => c.label)
                  .join(", ") || "—"}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32">Filters:</span>
              <span>
                {config.filters.length > 0
                  ? `${config.filters.length} filter(s) applied`
                  : "None"}
              </span>
            </div>
          </div>

          {showPreview && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b">
                  <tr>
                    {Array.from(config.columns).map((colId) => (
                      <th key={colId} className="px-3 py-2 text-left font-medium">
                        {availableColumns.find((c) => c.id === colId)?.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      {Array.from(config.columns).map((colId) => (
                        <td key={colId} className="px-3 py-2">
                          {String(row[colId])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!showPreview && (
            <Button onClick={handlePreview} variant="secondary" className="w-full">
              Generate Preview
            </Button>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={!showPreview}>
              Export Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
