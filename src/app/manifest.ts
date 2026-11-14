import type { MetadataRoute } from "next";
import { textos } from "@/ui/textos";

// "Agregar a pantalla de inicio" on a phone: the name, the colors and the
// icon of Yapoin (the comb of the brand). Without start_url, the phone opens
// the page that was added: the agenda for an owner, the booking page of a
// barbershop for a customer. There is no service worker: it is not the
// installable app of task 6.3, which stays out.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: textos.marca,
    short_name: textos.marca,
    description: textos.inicio.descripcion,
    display: "standalone",
    background_color: "#f4f7f6",
    theme_color: "#1e7f8c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
