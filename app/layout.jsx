import "./globals.css";
import { Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader.jsx";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Pediatrack",
  description: "Plataforma de protocolos pediátricos"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
