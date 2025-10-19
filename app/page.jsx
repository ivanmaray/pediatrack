import data from "@/data/index.json";
import HomeClient from "@/components/HomeClient.jsx";
import { Suspense } from "react";

export const revalidate = 60;

export async function generateMetadata() {
  const total = Array.isArray(data) ? data.length : 0;
  return {
    title: `Pediatrack · ${total} protocolo${total === 1 ? "" : "s"}`,
    description: "Explora mapas terapéuticos interactivos para oncología pediátrica.",
    openGraph: {
      title: "Pediatrack — mapas terapéuticos pediátricos",
      description: "Visualiza protocolos (quimio, RT, inmuno) con tiempos y dosis.",
      url: "https://pediatrack.example/",
      siteName: "Pediatrack",
      images: [
        { url: "/og-cover.png", width: 1200, height: 630, alt: "Pediatrack" }
      ],
      locale: "es_ES",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      site: "@pediatrack",
      title: "Pediatrack — mapas terapéuticos",
      description: "Mapas claros para protocolos pediátricos.",
      images: ["/og-cover.png"]
    }
  };
}

export default function Home() {
  return (
    <Suspense fallback={<div className="container"><p>Cargando…</p></div>}>
      <HomeClient initialData={Array.isArray(data) ? data : []} />
    </Suspense>
  );
}
