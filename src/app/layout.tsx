import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegistraApp from "@/components/RegistraApp";

export const metadata: Metadata = {
  title: "Fechamento de Caixa",
  description: "Controle diário de caixa, funcionários e faturamento",
  manifest: "/manifest.webmanifest",
  applicationName: "Caixa",
  appleWebApp: { capable: true, title: "Caixa", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icone-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icone-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d9488",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <RegistraApp />
      </body>
    </html>
  );
}
