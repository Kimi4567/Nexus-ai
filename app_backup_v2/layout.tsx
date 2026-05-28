import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXUS AI - 4 وكلاء ذكاء اصطناعي",
  description: "NEX ينتج الفيديوهات. VEX يدير الإعلانات. PULSE يحلل البيانات.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased overflow-x-hidden min-h-screen" style={{ background: '#020204', color: '#f8fafc', fontFamily: "'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
