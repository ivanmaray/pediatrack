"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import data from "@/data/index.json";

const DIAG_MENU = [
  "Meduloblastoma",
  "Neuroblastoma",
  "Leucemia linfoblástica aguda",
  "Tumor de Wilms",
  "Sarcomas óseos",
  "Sarcomas de partes blandas",
  "Gliomas de bajo grado",
  "Gliomas de alto grado",
  "Ependimoma",
  "Hepatoblastoma",
  "Linfomas",
  "Otros"
];
const DEFAULT_AREA = "Meduloblastoma";

export default function Home() {
  const [q, setQ] = useState("");
  const [activeArea, setActiveArea] = useState("");

  // Unique areas (fallback to DEFAULT_AREA if missing)
  const areas = useMemo(() => {
    const fromData = new Set((data || []).map((p) => p.area || DEFAULT_AREA));
    const union = new Set([...DIAG_MENU, ...fromData]);
    return Array.from(union).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, []);

  // Filter protocols by query + area
  const protocolos = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data || []).filter((p) => {
      const okArea = !activeArea || (p.area || DEFAULT_AREA) === activeArea;
      if (!query) return okArea;
      const hay = [p.titulo, p.area, p.grupo, p.id]
        .filter(Boolean)
        .join(" · ")
        .toLowerCase();
      return okArea && hay.includes(query);
    });
  }, [q, activeArea]);

  // Group by area for pretty sections when no search active
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of protocolos) {
      const key = p.area || DEFAULT_AREA;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [protocolos]);

  return (
    <main style={{
      padding: 24,
      background: "#f6f8fc",
      minHeight: "100vh"
    }}>
      {/* HERO */}
      <section style={{
        borderRadius: 16,
        background: "linear-gradient(135deg, #eaf1ff, #f7f2ff)",
        border: "1px solid #d8e1f1",
        padding: "28px 24px",
        boxShadow: "0 12px 30px rgba(0,0,0,.06)",
        marginBottom: 18
      }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#0e1220" }}>Pediatrack · Protocolos</h1>
        <p style={{ margin: "8px 0 16px", color: "#55627a", maxWidth: 780 }}>
          Explora mapas terapéuticos interactivos para oncología pediátrica. Selecciona un <strong>diagnóstico</strong> (p. ej., Meduloblastoma) y luego el protocolo para ver radioterapia, quimioterapia, evaluaciones, imagen, soporte y cronograma en un vistazo.
        </p>

        {/* Search + chips */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 320px" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar protocolo, patología o grupo…"
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid #d8e1f1",
                padding: "12px 14px",
                outline: "none",
                background: "#fff",
                color: "#0e1220",
                boxShadow: "0 3px 8px rgba(0,0,0,.04)",
              }}
            />
            {q && (
              <button onClick={() => setQ("")} style={{ position: "absolute", right: 8, top: 8, borderRadius: 8, border: "1px solid #d8e1f1", background: "#fff", color: "#55627a", padding: "6px 8px", cursor: "pointer" }}>Limpiar</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#55627a", alignSelf: "center" }}>Diagnósticos:</span>
            <button
              onClick={() => setActiveArea("")}
              style={chipStyle(activeArea === "")}
            >Todas</button>
            {areas.map((a) => (
              <button key={a} onClick={() => setActiveArea(a)} style={chipStyle(activeArea === a)}>{a}</button>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTADOS / LISTA */}
      {q || activeArea ? (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#0e1220" }}>Resultados</h2>
            <div style={{ fontSize: 12, color: "#55627a" }}>{protocolos.length} protocolo(s)</div>
          </div>
          <Grid protocolos={protocolos} />
        </section>
      ) : (
        <section>
          {grouped.map(([areaName, items]) => (
            <div key={areaName} style={{ marginBottom: 18 }}>
              <h3 style={{ margin: "0 0 8px", color: "#0e1220" }}>{areaName}</h3>
              <Grid protocolos={items} />
            </div>
          ))}
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ marginTop: 24, color: "#66728e", fontSize: 12 }}>
        <div>© {new Date().getFullYear()} Pediatrack — prototipado clínico. Esta demo no sustituye a la práctica clínica ni a los documentos oficiales del protocolo.</div>
      </footer>
    </main>
  );
}

function Grid({ protocolos }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {protocolos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/protocolo/${p.id}`}
            style={{
              display: "block",
              padding: "14px 16px",
              border: "1px solid #d8e1f1",
              borderRadius: 12,
              background: "#fff",
              textDecoration: "none",
              color: "#0e1220",
              boxShadow: "0 4px 10px rgba(0,0,0,.04)",
            }}
          >
            <div style={{ fontSize: 12, color: "#66728e", marginBottom: 6 }}>
              {p.area || DEFAULT_AREA} · {p.grupo || "—"}
            </div>
            <div style={{ fontWeight: 600 }}>{p.titulo}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function chipStyle(active) {
  return {
    border: active ? "1px solid #7b93e1" : "1px solid #d8e1f1",
    background: active ? "#eaf1ff" : "#fff",
    color: "#0e1220",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 12,
    boxShadow: active ? "0 4px 10px rgba(0,0,0,.05)" : "none",
  };
}
