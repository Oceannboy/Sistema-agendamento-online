import type { Metadata, Viewport } from "next";
import { Poppins, Quicksand } from "next/font/google";
import { NOME_EMPRESA } from "@/lib/config";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `Agenda ${NOME_EMPRESA}`,
    template: `%s · ${NOME_EMPRESA}`,
  },
  description: `Marque e acompanhe seus horários: Agenda ${NOME_EMPRESA}.`,
  applicationName: `Agenda ${NOME_EMPRESA}`,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: `Agenda ${NOME_EMPRESA}`,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3c38cf",
};

export default function LayoutRaiz({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${quicksand.variable}`}
    >
      <body className="font-sans antialiased">
        {/* Mobile-first: no desktop o app fica numa coluna centralizada de 430px */}
        <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-clip bg-fundo shadow-[0_0_48px_rgba(60,56,207,0.22)]">
          {children}
        </div>
      </body>
    </html>
  );
}
