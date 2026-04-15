"use client";

import { useEffect, useState } from "react";
import { TypeOutline } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const STORAGE_KEY_LH = "signapps-a11y-line-height";
const STORAGE_KEY_LS = "signapps-a11y-letter-spacing";
const STORAGE_KEY_WS = "signapps-a11y-word-spacing";

export function ComfortableReadingConfig() {
  const [lineHeight, setLineHeight] = useState("normal");
  const [letterSpacing, setLetterSpacing] = useState("normal");
  const [wordSpacing, setWordSpacing] = useState("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLh = localStorage.getItem(STORAGE_KEY_LH) || "normal";
    const storedLs = localStorage.getItem(STORAGE_KEY_LS) || "normal";
    const storedWs = localStorage.getItem(STORAGE_KEY_WS) || "normal";

    setLineHeight(storedLh);
    setLetterSpacing(storedLs);
    setWordSpacing(storedWs);

    applySettings(storedLh, storedLs, storedWs);
  }, []);

  const applySettings = (lh: string, ls: string, ws: string) => {
    const root = document.documentElement;
    root.style.setProperty("--a11y-line-height", lh);
    root.style.setProperty("--a11y-letter-spacing", ls);
    root.style.setProperty("--a11y-word-spacing", ws);
  };

  const handleLhChange = (val: string) => {
    setLineHeight(val);
    localStorage.setItem(STORAGE_KEY_LH, val);
    applySettings(val, letterSpacing, wordSpacing);
  };

  const handleLsChange = (val: string) => {
    setLetterSpacing(val);
    localStorage.setItem(STORAGE_KEY_LS, val);
    applySettings(lineHeight, val, wordSpacing);
  };

  const handleWsChange = (val: string) => {
    setWordSpacing(val);
    localStorage.setItem(STORAGE_KEY_WS, val);
    applySettings(lineHeight, letterSpacing, val);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <TypeOutline className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Confort Typographique</Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Aère les éléments de texte pour réduire la charge cognitive et
          faciliter le suivi des mots.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold">Espacement Lignes</Label>
          <Select value={lineHeight} onValueChange={handleLhChange}>
            <SelectTrigger>
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Standard</SelectItem>
              <SelectItem value="1.8">Aéré (1.8)</SelectItem>
              <SelectItem value="2.2">Très Aéré (2.2)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold">Espacement Lettres</Label>
          <Select value={letterSpacing} onValueChange={handleLsChange}>
            <SelectTrigger>
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Standard</SelectItem>
              <SelectItem value="1px">Large (+1px)</SelectItem>
              <SelectItem value="2px">Très Large (+2px)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold">Espacement Mots</Label>
          <Select value={wordSpacing} onValueChange={handleWsChange}>
            <SelectTrigger>
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Standard</SelectItem>
              <SelectItem value="2px">Large (+2px)</SelectItem>
              <SelectItem value="4px">Très Large (+4px)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
