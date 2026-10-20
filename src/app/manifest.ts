import type { MetadataRoute } from "next";
import { NOME_EMPRESA } from "@/lib/config";

/** PWA instalável: manifest gerado com o nome da empresa. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Agenda ${NOME_EMPRESA}`,
    short_name: "Agenda",
    description: `Marque e acompanhe seus horários: Agenda ${NOME_EMPRESA}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#3c38cf",
    theme_color: "#3c38cf",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
