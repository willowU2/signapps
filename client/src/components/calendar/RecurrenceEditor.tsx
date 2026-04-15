"use client";

import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface RecurrenceEditorProps {
  value?: string;
  onChange: (rrule: string) => void;
}

const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const DAYS_OF_WEEK = [
  { label: "Monday", value: "MO" },
  { label: "Tuesday", value: "TU" },
  { label: "Wednesday", value: "WE" },
  { label: "Thursday", value: "TH" },
  { label: "Friday", value: "FR" },
  { label: "Saturday", value: "SA" },
  { label: "Sunday", value: "SU" },
];

interface RecurrenceConfig {
  frequency: string;
  count?: number;
  until?: string;
  interval?: number;
  byDay?: string[];
}

function parseRRule(rrule?: string): RecurrenceConfig {
  const config: RecurrenceConfig = { frequency: "WEEKLY" };

  if (!rrule) return config;

  const parts = rrule.split(";");
  parts.forEach((part) => {
    const [key, val] = part.split("=");
    switch (key) {
      case "FREQ":
        config.frequency = val;
        break;
      case "COUNT":
        config.count = parseInt(val);
        break;
      case "UNTIL":
        config.until = val;
        break;
      case "INTERVAL":
        config.interval = parseInt(val);
        break;
      case "BYDAY":
        config.byDay = val.split(",");
        break;
    }
  });

  return config;
}

function buildRRule(config: RecurrenceConfig): string {
  let rrule = `FREQ=${config.frequency}`;

  if (config.interval && config.interval > 1) {
    rrule += `;INTERVAL=${config.interval}`;
  }

  if (config.byDay && config.byDay.length > 0) {
    rrule += `;BYDAY=${config.byDay.join(",")}`;
  }

  if (config.count) {
    rrule += `;COUNT=${config.count}`;
  } else if (config.until) {
    rrule += `;UNTIL=${config.until}`;
  }

  return rrule;
}

export function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const [config, setConfig] = useState<RecurrenceConfig>(parseRRule(value));
  const [showOptions, setShowOptions] = useState(!!value);

  const handleFrequencyChange = (freq: string) => {
    const newConfig = { ...config, frequency: freq };
    setConfig(newConfig);
    onChange(buildRRule(newConfig));
  };

  const handleCountChange = (count: number) => {
    const newConfig = {
      ...config,
      count: count || undefined,
      until: undefined,
    };
    setConfig(newConfig);
    onChange(buildRRule(newConfig));
  };

  const handleDayChange = (day: string, checked: boolean) => {
    const byDay = config.byDay || [];
    const newByDay = checked ? [...byDay, day] : byDay.filter((d) => d !== day);

    const newConfig = {
      ...config,
      byDay: newByDay.length > 0 ? newByDay : undefined,
    };
    setConfig(newConfig);
    onChange(buildRRule(newConfig));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="recurring"
          checked={showOptions}
          onCheckedChange={(checked) => {
            setShowOptions(!!checked);
            if (checked) {
              onChange(buildRRule(config));
            } else {
              onChange("");
            }
          }}
        />
        <Label htmlFor="recurring" className="font-normal cursor-pointer">
          Repeat
        </Label>
      </div>

      {showOptions && (
        <div className="space-y-4 pl-6 border-l-2">
          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Repeat every</Label>
            <Select
              value={config.frequency}
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq.charAt(0) + freq.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days of week for weekly */}
          {config.frequency === "WEEKLY" && (
            <div className="space-y-2">
              <Label>On days</Label>
              <div className="grid grid-cols-2 gap-3">
                {DAYS_OF_WEEK.map(({ label, value }) => (
                  <div key={value} className="flex items-center gap-2">
                    <Checkbox
                      id={`day-${value}`}
                      checked={(config.byDay || []).includes(value)}
                      onCheckedChange={(checked) =>
                        handleDayChange(value, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`day-${value}`}
                      className="font-normal cursor-pointer text-sm"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div className="space-y-2">
            <Label htmlFor="count">Repeat for</Label>
            <Input
              id="count"
              type="number"
              placeholder="Number of occurrences"
              value={config.count || ""}
              onChange={(e) => handleCountChange(parseInt(e.target.value))}
              min="1"
              max="365"
            />
          </div>

          {/* Preview */}
          {value && (
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              Pattern: <code>{value}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
