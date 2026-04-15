// SignDesign - Type definitions

export interface DesignFormat {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
}

export const DESIGN_FORMATS: DesignFormat[] = [
  // Social Media
  {
    id: "instagram-post",
    name: "Instagram Post",
    category: "Social Media",
    width: 1080,
    height: 1080,
  },
  {
    id: "instagram-story",
    name: "Instagram Story",
    category: "Social Media",
    width: 1080,
    height: 1920,
  },
  {
    id: "facebook-cover",
    name: "Facebook Cover",
    category: "Social Media",
    width: 820,
    height: 312,
  },
  {
    id: "facebook-post",
    name: "Facebook Post",
    category: "Social Media",
    width: 1200,
    height: 630,
  },
  {
    id: "linkedin-banner",
    name: "LinkedIn Banner",
    category: "Social Media",
    width: 1584,
    height: 396,
  },
  {
    id: "linkedin-post",
    name: "LinkedIn Post",
    category: "Social Media",
    width: 1200,
    height: 1200,
  },
  {
    id: "twitter-post",
    name: "Twitter/X Post",
    category: "Social Media",
    width: 1200,
    height: 675,
  },
  {
    id: "youtube-thumbnail",
    name: "YouTube Thumbnail",
    category: "Social Media",
    width: 1280,
    height: 720,
  },
  // Print
  {
    id: "a4-portrait",
    name: "A4 Portrait",
    category: "Print",
    width: 2480,
    height: 3508,
  },
  {
    id: "a4-landscape",
    name: "A4 Landscape",
    category: "Print",
    width: 3508,
    height: 2480,
  },
  {
    id: "business-card",
    name: "Business Card",
    category: "Print",
    width: 1050,
    height: 600,
  },
  { id: "flyer", name: "Flyer", category: "Print", width: 1240, height: 1748 },
  {
    id: "poster",
    name: "Poster",
    category: "Print",
    width: 2480,
    height: 3508,
  },
  // Presentations
  {
    id: "presentation-16-9",
    name: "Presentation 16:9",
    category: "Presentation",
    width: 1920,
    height: 1080,
  },
  {
    id: "presentation-4-3",
    name: "Presentation 4:3",
    category: "Presentation",
    width: 1024,
    height: 768,
  },
  // Marketing
  {
    id: "email-header",
    name: "Email Header",
    category: "Marketing",
    width: 600,
    height: 200,
  },
  {
    id: "web-banner",
    name: "Web Banner",
    category: "Marketing",
    width: 1200,
    height: 400,
  },
  {
    id: "invitation",
    name: "Invitation",
    category: "Marketing",
    width: 1080,
    height: 1080,
  },
];

export interface DesignPage {
  id: string;
  objects: DesignObject[];
  background: string;
}

export interface DesignObject {
  id: string;
  type: "text" | "shape" | "image" | "group";
  name: string;
  fabricData: Record<string, any>;
  locked: boolean;
  visible: boolean;
}

export interface DesignMeta {
  id: string;
  name: string;
  format: DesignFormat;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Design {
  id: string;
  name: string;
  format: DesignFormat;
  pages: DesignPage[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: BrandColor[];
  logos: BrandLogo[];
  headingFont: string;
  bodyFont: string;
}

export interface BrandColor {
  id: string;
  name: string;
  value: string;
}

export interface BrandLogo {
  id: string;
  name: string;
  url: string;
  variant: "light" | "dark" | "default";
}

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  format: DesignFormat;
  thumbnail: string;
  pages: DesignPage[];
}

export type ExportFormat = "png" | "jpg" | "pdf" | "svg";
export type ExportDPI = 72 | 150 | 300;

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 60-100 for jpg
  dpi: ExportDPI;
  allPages: boolean;
}

export interface PhotoFilter {
  id: string;
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hueRotate: number;
  sepia: number;
  grayscale: number;
}

export const PHOTO_FILTER_PRESETS: PhotoFilter[] = [
  {
    id: "original",
    name: "Original",
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    hueRotate: 0,
    sepia: 0,
    grayscale: 0,
  },
  {
    id: "vivid",
    name: "Vivid",
    brightness: 105,
    contrast: 120,
    saturation: 140,
    blur: 0,
    hueRotate: 0,
    sepia: 0,
    grayscale: 0,
  },
  {
    id: "warm",
    name: "Warm",
    brightness: 105,
    contrast: 105,
    saturation: 110,
    blur: 0,
    hueRotate: 15,
    sepia: 20,
    grayscale: 0,
  },
  {
    id: "cool",
    name: "Cool",
    brightness: 100,
    contrast: 110,
    saturation: 90,
    blur: 0,
    hueRotate: -15,
    sepia: 0,
    grayscale: 0,
  },
  {
    id: "vintage",
    name: "Vintage",
    brightness: 95,
    contrast: 90,
    saturation: 70,
    blur: 0,
    hueRotate: 10,
    sepia: 40,
    grayscale: 0,
  },
  {
    id: "bw",
    name: "B&W",
    brightness: 105,
    contrast: 120,
    saturation: 0,
    blur: 0,
    hueRotate: 0,
    sepia: 0,
    grayscale: 100,
  },
  {
    id: "sepia",
    name: "Sepia",
    brightness: 100,
    contrast: 100,
    saturation: 60,
    blur: 0,
    hueRotate: 0,
    sepia: 80,
    grayscale: 0,
  },
  {
    id: "dramatic",
    name: "Dramatic",
    brightness: 90,
    contrast: 150,
    saturation: 80,
    blur: 0,
    hueRotate: 0,
    sepia: 0,
    grayscale: 0,
  },
];

export const SHAPE_CATEGORIES = [
  {
    id: "basic",
    name: "Basic Shapes",
    shapes: [
      { id: "rect", name: "Rectangle", icon: "Square" },
      { id: "circle", name: "Circle", icon: "Circle" },
      { id: "triangle", name: "Triangle", icon: "Triangle" },
      { id: "star", name: "Star", icon: "Star" },
      { id: "diamond", name: "Diamond", icon: "Diamond" },
      { id: "hexagon", name: "Hexagon", icon: "Hexagon" },
    ],
  },
  {
    id: "arrows",
    name: "Arrows",
    shapes: [
      { id: "arrow-right", name: "Arrow Right", icon: "ArrowRight" },
      { id: "arrow-left", name: "Arrow Left", icon: "ArrowLeft" },
      { id: "arrow-up", name: "Arrow Up", icon: "ArrowUp" },
      { id: "arrow-down", name: "Arrow Down", icon: "ArrowDown" },
    ],
  },
  {
    id: "lines",
    name: "Lines",
    shapes: [
      { id: "line", name: "Line", icon: "Minus" },
      { id: "arrow-line", name: "Arrow Line", icon: "MoveRight" },
    ],
  },
];

export const TEXT_STYLES = [
  {
    id: "heading-lg",
    name: "Large Heading",
    fontSize: 64,
    fontWeight: "bold",
    fontFamily: "Inter",
  },
  {
    id: "heading-md",
    name: "Medium Heading",
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "Inter",
  },
  {
    id: "heading-sm",
    name: "Small Heading",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Inter",
  },
  {
    id: "subheading",
    name: "Subheading",
    fontSize: 24,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  {
    id: "body",
    name: "Body Text",
    fontSize: 18,
    fontWeight: "normal",
    fontFamily: "Inter",
  },
  {
    id: "body-sm",
    name: "Small Text",
    fontSize: 14,
    fontWeight: "normal",
    fontFamily: "Inter",
  },
  {
    id: "caption",
    name: "Caption",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter",
  },
];

export const FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
  "Palatino",
  "Garamond",
  "Bookman",
];
