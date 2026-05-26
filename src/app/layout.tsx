import type { Metadata } from "next";
import { Fraunces, Literata } from "next/font/google";
import "./globals.css";

// "Living fieldbook" type (DESIGN.md): Fraunces for names/headings, Literata for body+italic.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-body",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "plurali",
  description: "Un árbol genealógico que la familia escribe junta.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${literata.variable}`}>
      <body>{children}</body>
    </html>
  );
}
