export interface FontsManifest {
  generated_at: string;
  version: string;
  total: number;
  families: FontFamily[];
}

export interface FontFamily {
  id: string;
  name: string;
  category: FontCategory;
  source: FontSource;
  foundry?: string;
  license: string;
  variants: FontVariant[];
  popularity?: number;
  subsets?: string[];
}

export type FontCategory =
  | "sans-serif"
  | "serif"
  | "monospace"
  | "display"
  | "handwriting"
  | "programming";

export type FontSource = "google" | "nerd" | "awesome";

export interface FontVariant {
  weight: number;
  style: "normal" | "italic";
  file: string;
  size_bytes: number;
}
