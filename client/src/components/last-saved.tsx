"use client";

import { useEffect, useState } from "react";

export function LastSaved({ savedAt }: { savedAt: Date | null }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!savedAt) return;
    function update() {
      const diff = Math.round((Date.now() - savedAt!.getTime()) / 1000);
      if (diff < 5) setLabel("Sauvegarde a l'instant");
      else if (diff < 60) setLabel("Sauvegarde il y a " + diff + "s");
      else setLabel("Sauvegarde il y a " + Math.round(diff / 60) + "min");
    }
    update();
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, [savedAt]);

  if (!label) return null;
  return <span className="text-xs text-muted-foreground">{label}</span>;
}
