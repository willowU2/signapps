import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SignApps Platform",
    short_name: "SignApps",
    description: "Enterprise microservices management platform",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f8",
    theme_color: "#135bec",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
