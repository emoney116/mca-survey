import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Metrolina Baseball Survey",
    short_name: "MCA Survey",
    description: "Fall development goals survey for Metrolina Baseball.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#f7f7f8",
    icons: [
      {
        src: "/metrolina-logo.png",
        sizes: "1879x1779",
        type: "image/png",
      },
    ],
  };
}
