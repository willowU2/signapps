"use client";

import { useState } from "react";
import { useDynamicFont } from "@/lib/fonts/use-dynamic-font";
import { FontPickerDropdown } from "./FontPickerDropdown";
import { FontBrowserDialog } from "./FontBrowserDialog";

interface Props {
  value?: string;
  onChange: (family: string) => void;
}

export function FontPicker({ value, onChange }: Props) {
  const [browserOpen, setBrowserOpen] = useState(false);
  useDynamicFont(value);

  return (
    <>
      <FontPickerDropdown
        value={value}
        onChange={onChange}
        onOpenBrowser={() => setBrowserOpen(true)}
      />
      <FontBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        value={value}
        onSelect={(id) => {
          onChange(id);
          setBrowserOpen(false);
        }}
      />
    </>
  );
}
