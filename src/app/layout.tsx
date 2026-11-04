import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { textos } from "@/ui/textos";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: textos.inicio.titulo,
  description: textos.inicio.descripcion,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
