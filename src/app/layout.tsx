import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { textos } from "@/ui/textos";
import "./globals.css";

// Downloaded at build time and served by the app itself: the browser never
// calls Google (decision 0007).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: textos.marca, template: `%s · ${textos.marca}` },
  description: textos.inicio.descripcion,
};

// Lets the bottom bar reach the phone's safe area.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
