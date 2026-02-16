"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
}

// Common timezones for quick access
const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

// All IANA timezones (subset for demo)
const ALL_TIMEZONES = [
  // Americas
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  // Europe
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  // Asia
  "Asia/Bangkok",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  // Pacific
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  // UTC
  "UTC",
];

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filtered = ALL_TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <div className="relative">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id="timezone">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {/* Common timezones first */}
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
              Common
            </div>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}

            <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-2">
              All Timezones
            </div>
            {ALL_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Timezone info */}
        {value && (
          <div className="mt-2 text-xs text-muted-foreground">
            <p className="break-words">{value}</p>
            {value !== "UTC" && (
              <p className="text-xs mt-1">
                Format: Region/City
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
