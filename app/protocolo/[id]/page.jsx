import { notFound } from "next/navigation";
import Link from "next/link";
import { getProtocol } from "@/lib/loadProtocol.js";
import dataIndex from "@/data/index.json";
import ProtocolViewer from "@/components/ProtocolViewer.jsx";

const FALLBACK_LEAD =
  "Explora el cronograma multidisciplinario, evalúa las fases de tratamiento y comparte el mapa terapéutico con tu equipo.";

export default async function Page({ params }) {
  const protocolo = await getProtocol(params.id);
  if (!protocolo) return notFound();

  const versiones = Array.isArray(protocolo.versiones) ? protocolo.versiones : [];
  const versionBase = versiones[0] || {};
  const estratificacion = Array.isArray(versionBase.estratificacion) ? versionBase.estratificacion : [];

  const lead =
    protocolo.descripcion ||
    versionBase.descripcion ||
    `Hoja de ruta interactiva para ${protocolo.titulo || protocolo.nombre || protocolo.id}.`;

  return (
    <div className="container page-shell protocol-page">
      <div>
        <Link href="/" className="back-link">
          ← Volver a protocolos
        </Link>
      </div>

      <section className="protocol-summary" aria-labelledby="protocol-title">
        <span className="protocol-summary__eyebrow">
          {protocolo.area || "Protocolo clínico"}
        </span>
        <h1 id="protocol-title">{protocolo.titulo || protocolo.nombre || protocolo.id}</h1>
        <p className="protocol-summary__lead">{lead || FALLBACK_LEAD}</p>
        <div className="protocol-summary__meta">
          <span className="meta-pill">🧬 Grupo: {protocolo.grupo || "No especificado"}</span>
          {versiones.length > 0 && (
            <span className="meta-pill">
              📚 {versiones.length} versión{versiones.length === 1 ? "" : "es"} disponibles
            </span>
          )}
          {estratificacion.length > 0 && (
            <span className="meta-pill">
              🧭 {estratificacion.length} estrategia{estratificacion.length === 1 ? "" : "s"} de riesgo
            </span>
          )}
          <span className="meta-pill">🗺️ Mapa interactivo con fases y dependencias</span>
        </div>
      </section>

      <section aria-label="Visor del protocolo">
        <ProtocolViewer data={protocolo} />
      </section>
    </div>
  );
}

export async function generateStaticParams() {
  try {
    const items = Array.isArray(dataIndex) ? dataIndex : [];
    return items.map((p) => ({ id: p.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const protocolo = await getProtocol(params.id);
  if (!protocolo) {
    return { title: "Protocolo no encontrado · Pediatrack" };
  }
  const t = protocolo.titulo || protocolo.id;
  const d = `${protocolo.area ? protocolo.area + " · " : ""}${protocolo.grupo || ""}`.trim() || FALLBACK_LEAD;
  return {
    title: `${t} · Pediatrack`,
    description: d,
  };
}
