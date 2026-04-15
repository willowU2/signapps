"use client";

import { useEffect } from "react";

export function useFaviconBadge(count: number) {
  useEffect(() => {
    const link = document.querySelector(
      "link[rel~='icon']",
    ) as HTMLLinkElement | null;
    if (!link) return;

    if (count <= 0) {
      link.href = "/favicon.ico";
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
      return;
    }

    const cleanTitle = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = `(${count}) ${cleanTitle}`;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(24, 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count > 99 ? "99+" : String(count), 24, 8);
      link.href = canvas.toDataURL("image/png");
    };
    img.src = "/favicon.ico";

    return () => {
      link.href = "/favicon.ico";
      document.title = cleanTitle;
    };
  }, [count]);
}
