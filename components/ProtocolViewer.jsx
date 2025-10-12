"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ProtocolTimeline from "./ProtocolTimeline.jsx";

const ProtocolMap = dynamic(() => import("./ProtocolMap.jsx"), { ssr: false });

const VIEWS = [
  { id: "timeline", label: "Ruta clínica" },
  { id: "map", label: "Mapa interactivo" },
  { id: "digest", label: "Resumen digest" },
];

export default function ProtocolViewer({ data }) {
  const [view, setView] = useState("timeline");
  const versiones = Array.isArray(data.versiones) ? data.versiones : [];
  const baseVersion = versiones[0] || {};
  const estratificacion = Array.isArray(baseVersion.estratificacion) ? baseVersion.estratificacion : [];
  const [selectedStratId, setSelectedStratId] = useState(estratificacion.find(s => s.default)?.id || estratificacion[0]?.id || "");

  return (
    <div className="viewer-shell">
      <div className="viewer-header-controls">
        {versiones.length > 1 && (
          <div className="version-selector">
            <label htmlFor="version-select">Versión:</label>
            <select
              id="version-select"
              value={versiones[0]?.id || ""}
              onChange={(e) => {
                // Update version (stub for now)
                alert(`Cambiar a versión ${e.target.value} próximamente`);
              }}
            >
              {versiones.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            // Export placeholder
            window.print();
          }}
          className="export-btn"
          aria-label="Exportar protocolo como PDF"
        >
          📄 Exportar PDF
        </button>
      </div>

      {estratificacion.length > 1 && (
        <div className="strat-selector" role="region" aria-label="Selección de estrato de riesgo">
          <label htmlFor="strat-select">Estratificación activa:</label>
          <select
            id="strat-select"
            value={selectedStratId}
            onChange={(e) => setSelectedStratId(e.target.value)}
          >
            {estratificacion.map((strat) => (
              <option key={strat.id} value={strat.id}>
                {strat.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="viewer-tabs" role="tablist" aria-label="Selector de vista del protocolo">
        {VIEWS.map((option, idx) => (
          <button
            key={option.id}
            id={`tab-${option.id}`}
            type="button"
            className="viewer-tab"
            role="tab"
            aria-pressed={view === option.id}
            aria-selected={view === option.id}
            aria-controls={`viewer-view-${option.id}`}
            tabIndex={view === option.id ? 0 : -1}
            onClick={() => setView(option.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                const next = VIEWS[(idx + 1) % VIEWS.length].id;
                setView(next);
              } else if (e.key === 'ArrowLeft') {
                const prev = VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length].id;
                setView(prev);
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div id={`viewer-view-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>

      {view === "timeline" && (
        <ProtocolTimeline data={data} selectedStratId={selectedStratId} />
      )}

      {view === "map" && (
        <div className="protocol-map-shell">
          <ProtocolMap data={data} showHeader={true} showLegend={true} selectedStratId={selectedStratId} />
        </div>
      )}

      {view === "digest" && (
        <div className="protocol-digest-shell">
          <section aria-labelledby="digest-title">
            <h3 id="digest-title">Resumen digest del protocolo</h3>
            <p>{data.digest?.resumen || data.descripcion || ""}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
              {data.digest?.cards?.map((card, idx) => (
                <article key={idx} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <h4>{card.title}</h4>
                  <p dangerouslySetInnerHTML={{__html: card.content}}></p>
                </article>
              )) || <p>No hay datos específicos de resumen disponibles.</p>}
            </div>
          </section>
          {data.fuentes && data.fuentes.length > 0 && (
            <section aria-labelledby="fuentes-title">
              <h4 id="fuentes-title">Fuentes originales</h4>
              <ul>
                {data.fuentes.map((url, idx) => (
                  <li key={idx}>
                    <a href={url} target="_blank" rel="noopener noreferrer">Descargar PDF fuente {idx + 1}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
