import "./globals.css";
import { Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader.jsx";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Pediatrack",
  description: "Plataforma de protocolos pediátricos",
  // Define a base URL for Open Graph/Twitter images resolution to avoid Next.js warnings.
  // You can override with NEXT_PUBLIC_SITE_URL in your environment for production.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <a href="#main-content" className="sr-only sr-only--focusable">
          Saltar al contenido principal
        </a>
        <SiteHeader />
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
