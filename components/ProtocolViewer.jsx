"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ProtocolStepper from "./ProtocolStepper.jsx";

const Loading = () => (
  <div style={{ padding: 12, color: '#4a5970', fontSize: 13 }}>Cargando…</div>
);

// Ensure the dynamic import resolves to the component (default export) so React.lazy receives a function/class
const ProtocolTimeline = dynamic(() => import("./ProtocolTimeline.jsx").then(m => m.default), { ssr: false, loading: Loading });
const ProtocolQuickBars = dynamic(() => import("./ProtocolQuickBars.jsx").then(m => m.default), { ssr: false, loading: Loading });
const ProtocolMatrix = dynamic(() => import("./ProtocolMatrix.jsx").then(m => m.default), { ssr: false, loading: Loading });
const ProtocolCycleCalendar = dynamic(() => import("./ProtocolCycleCalendar.jsx").then(m => m.default), { ssr: false, loading: Loading });

const ProtocolMap = dynamic(() => import("./ProtocolMap.jsx").then(m => m.default), { ssr: false });

const VIEWS = [
  { id: "timeline", label: "🧭 Ruta clínica (secuencia)" },
  { id: "hitos", label: "🪜 Hitos (lista por semanas)" },
  { id: "quick", label: "⚡️ Vista rápida (barras)" },
  { id: "matrix", label: "🧩 Matriz (semanas × dominios)" },
  { id: "calendar", label: "📅 Calendario de ciclos" },
  { id: "map", label: "🗺️ Mapa interactivo (nodos)" },
  { id: "digest", label: "🧾 Resumen (narrativo)" },
];

const VIEW_HELP = {
  timeline: "Secuencia clínica de alto nivel con fases y dependencias.",
  hitos: "Lista ordenada por semana con hitos clave y filtros por categoría.",
  quick: "Barras rápidas para una visión de conjunto sin detalle fino.",
  matrix: "Matriz semanal por dominios (Quimio, RT, Cirugía, Inmuno, Evaluaciones).",
  calendar: "Tarjetas por ciclo de inducción con fármacos y semanas.",
  map: "Mapa interactivo con nodos/edges, zoom y exportación PNG/PDF.",
  digest: "Resumen narrativo con puntos clave y fuentes originales.",
};

export default function ProtocolViewer({ data }) {
  const [view, setView] = useState("timeline");
  const versiones = Array.isArray(data.versiones) ? data.versiones : [];
  const baseVersion = versiones[0] || {};
  const estratificacion = Array.isArray(baseVersion.estratificacion) ? baseVersion.estratificacion : [];
  const [selectedStratId, setSelectedStratId] = useState(estratificacion.find(s => s.default)?.id || estratificacion[0]?.id || "");

  // Initialize view from URL (?view=...) or hash (#<view>) or localStorage fallback
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const paramView = url.searchParams.get('view');
      const rawHash = window.location.hash?.replace('#', '') || '';
      const hashView = VIEWS.some(v => v.id === rawHash) ? rawHash : null;
      const stored = window.localStorage.getItem('proto:lastView') || undefined;
      const initial = paramView || hashView || stored;
      if (initial && VIEWS.some(v => v.id === initial)) {
        setView(initial);
      }
    } catch {}
  }, []);

  // Persist current view in URL and manage hash for #hitos
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      // Set hash to current view id for consistent deep-linking
      url.hash = view;
      window.history.replaceState({}, '', url);
      window.localStorage.setItem('proto:lastView', view);
    } catch {}
  }, [view]);

  // Keyboard shortcuts: 1-7 to switch views (ignore when typing)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < VIEWS.length) setView(VIEWS[idx].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
        {Array.isArray(data.fuentes) && data.fuentes.length > 0 && (() => {
          const raw = String(data.fuentes[0] || '');
          let href = '';
          if (!raw) href = '';
          else if (raw.startsWith('/data/fuentes/')) href = raw.replace('/data/fuentes/', '/fuentes/');
          else if (raw.startsWith('/fuentes/')) href = raw;
          else if (raw.startsWith('/')) href = `/fuentes${raw.replace(/^\//, '/')}`; // fallback map
          else href = `/fuentes/${raw}`;

          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="export-btn"
              aria-label="Abrir PDF original del protocolo"
              title="Abrir PDF original del protocolo"
              style={{ marginLeft: 8 }}
            >
              🔗 PDF original
            </a>
          ) : null;
        })()}
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

      <h3 style={{ margin: '8px 0 6px' }}>Vistas del protocolo</h3>
      <p style={{ margin: '0 0 8px', color: '#5a6a80', fontSize: 12 }}>
        Cambia de vista para analizar el mismo contenido desde otra perspectiva. Consejo: usa 1–7 o ←/→ para alternar.
      </p>
      <div className="viewer-tabs" role="tablist" aria-label="Vistas del protocolo (cambia la forma de visualizar, los datos son los mismos)">
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
            title={VIEW_HELP[option.id]}
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

      <p aria-live="polite" style={{ margin: '6px 0 14px', color: '#4a5970', fontSize: 13 }}>
        <strong>Vista actual:</strong> {VIEWS.find(v => v.id === view)?.label || ''}. {VIEW_HELP[view]} <span style={{ opacity: 0.9 }}>Nota: todas las pestañas son distintas formas de ver el mismo protocolo.</span>
      </p>

      <div id={`viewer-view-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>

      {view === "timeline" && (
        <ProtocolTimeline data={data} selectedStratId={selectedStratId} />
      )}

      {view === "hitos" && (
        <div className="protocol-stepper-shell" style={{ padding: 8 }}>
          <ProtocolStepper data={data} selectedStratId={selectedStratId} />
        </div>
      )}

      {view === "quick" && (
        <div className="protocol-quickbars-shell" style={{ padding: 8 }}>
          <ProtocolQuickBars data={data} selectedStratId={selectedStratId} />
        </div>
      )}

      {view === "matrix" && (
        <div className="protocol-matrix-shell" style={{ padding: 8 }}>
          <ProtocolMatrix data={data} selectedStratId={selectedStratId} />
        </div>
      )}

      {view === "calendar" && (
        <div className="protocol-calendar-shell" style={{ padding: 8 }}>
          <ProtocolCycleCalendar data={data} selectedStratId={selectedStratId} />
        </div>
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
                      {data.fuentes.map((url, idx) => {
                        const raw = String(url || '');
                        let href = '';
                        if (!raw) href = '';
                        else if (raw.startsWith('/data/fuentes/')) href = raw.replace('/data/fuentes/', '/fuentes/');
                        else if (raw.startsWith('/fuentes/')) href = raw;
                        else if (raw.startsWith('/')) href = `/fuentes${raw.replace(/^\//, '/')}`;
                        else href = `/fuentes/${raw}`;
                        return (
                          <li key={idx}>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer">Descargar PDF fuente {idx + 1}</a>
                            ) : (
                              <span>Fuente {idx + 1}</span>
                            )}
                          </li>
                        );
                      })}
              </ul>
            </section>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
