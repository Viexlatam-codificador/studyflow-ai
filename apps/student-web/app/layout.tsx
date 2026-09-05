import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyFlow AI — Tu estudio, organizado por IA",
  description:
    "Reúne tus clases, tareas, documentos y evaluaciones. StudyFlow te dice qué hacer, cuándo hacerlo y te ayuda a avanzar.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
