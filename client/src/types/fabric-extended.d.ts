import type { FabricObject, FabricText } from "fabric";

declare module "fabric" {
  interface FabricObject {
    id?: string;
  }
}

export interface FabricActiveObject extends FabricText {
  id?: string;
  rx?: number;
}
