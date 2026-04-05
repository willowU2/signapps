import { useCallback } from "react";
import { toast } from "sonner";
import type { OrgNode, OrgTree } from "@/types/org";

export function useOrgExport(nodes: OrgNode[], currentTree: OrgTree | null) {
  const handleExport = useCallback(
    (format: "json" | "csv") => {
      const filename = `org-structure-${currentTree?.name ?? "export"}`;
      let blob: Blob;

      if (format === "json") {
        const data = JSON.stringify(nodes, null, 2);
        blob = new Blob([data], { type: "application/json" });
      } else {
        const header = "Nom,Type,Parent,Code,Description,Actif\n";
        const parentNameMap = new Map(nodes.map((n) => [n.id, n.name]));
        const rows = nodes.map((n) =>
          [
            `"${n.name}"`,
            n.node_type,
            n.parent_id ? `"${parentNameMap.get(n.parent_id) ?? ""}"` : "",
            n.code ?? "",
            `"${(n.description ?? "").replace(/"/g, '""')}"`,
            n.is_active ? "Oui" : "Non",
          ].join(","),
        );
        blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export termine");
    },
    [nodes, currentTree],
  );

  const handlePrint = useCallback(() => window.print(), []);

  return { handleExport, handlePrint };
}
