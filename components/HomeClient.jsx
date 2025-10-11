"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const DEFAULT_AREA = "Meduloblastoma";

const DIAG_GROUPS = {
  solid: {
    label: "Tumores sólidos pediátricos",
    subtitle: "Neuroectodérmicos, renales, hepáticos, sarcomas y SNC.",
    areas: [
      "Meduloblastoma",
      "Neuroblastoma",
      "Tumor de Wilms",
      "Sarcomas óseos",
      "Sarcomas de partes blandas",
      "Gliomas de bajo grado",
      "Gliomas de alto grado",
      "Ependimoma",
      "Hepatoblastoma",
      "Retinoblastoma",
      "Tumores germinales",
      "Histiocitosis de células de Langerhans",
      "Tumor teratoideo/rabdoide",
      "Otros tumores sólidos"
    ]
  },
  hemato: {
    label: "Hematología oncológica",
    subtitle: "Leucemias agudas, linfomas y síndromes mieloides.",
    areas: [
      "Leucemia linfoblástica aguda",
      "Leucemia mieloide aguda",
      "Leucemia mielomonocítica juvenil",
      "Síndromes mielodisplásicos",
      "Linfoma de Hodgkin",
      "Linfoma no Hodgkin"
    ]
  },
  otros: {
    label: "Protocolos transversales y soporte",
    subtitle: "Cuidados de soporte, ensayos y rutas compartidas.",
    areas: [
      "Trasplante hematopoyético",
      "Otros"
    ]
  }
};

const AREA_DOMAIN_MAP = new Map(
  Object.entries(DIAG_GROUPS).flatMap(([domain, group]) =>
    group.areas.map((area) => [area, domain])
  )
);

const HEMATO_KEYWORDS = ["leucemia", "linfoma", "hemat", "mielo", "mieloide", "mielodisplas", "mielomonocit", "trasplante", "hemato"];
const SOLID_KEYWORDS = [
  "tumor",
  "sarcoma",
  "blastoma",
  "neuro",
  "wilms",
  "glioma",
  "ependim",
  "hepato",
  "retino",
  "oste",
  "rabdoide",
  "teratoideo",
  "langerhans"
];

const normalize = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const inferDomain = (area = "") => {
  const norm = normalize(area);
  if (HEMATO_KEYWORDS.some((kw) => norm.includes(kw))) return "hemato";
  if (SOLID_KEYWORDS.some((kw) => norm.includes(kw))) return "solid";
  return "otros";
};

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const DOMAIN_OPTIONS = [
  { id: "todos", label: "Todos los diagnósticos", subtitle: "Listado completo" },
  ...Object.entries(DIAG_GROUPS).map(([id, group]) => ({
    id,
    label: group.label,
    subtitle: group.subtitle
  }))
];

const DOMAIN_ORDER = ["solid", "hemato", "otros"];

export default function HomeClient({ initialData }) {
  const data = Array.isArray(initialData) ? initialData : [];
  const [q, setQ] = useState("");
  const [activeArea, setActiveArea] = useState("");
  const [activeDomain, setActiveDomain] = useState("todos");
  const searchRef = useRef(null);
  const dq = useDebouncedValue(q, 200);

  const areaToDomain = useMemo(() => {
    const map = new Map(AREA_DOMAIN_MAP);
    data.forEach((protocolo) => {
      const area = protocolo.area || DEFAULT_AREA;
      if (!map.has(area)) {
        map.set(area, inferDomain(area));
      }
    });
    return map;
  }, [data]);

  useEffect(() => {
    if (!activeArea) return;
    const domain = areaToDomain.get(activeArea) || "otros";
    if (activeDomain !== "todos" && domain !== activeDomain) {
      setActiveArea("");
    }
  }, [activeArea, activeDomain, areaToDomain]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allAreas = useMemo(() => {
    const fromData = (data || []).map((p) => p.area || DEFAULT_AREA);
    const base = Array.from(AREA_DOMAIN_MAP.keys());
    return Array.from(new Set([...base, ...fromData, DEFAULT_AREA])).filter(Boolean);
  }, [data]);

  const filteredAreas = useMemo(() => {
    const sorted = [...allAreas].sort((a, b) => a.localeCompare(b, 'es'));
    if (activeDomain === "todos") return sorted;
    return sorted.filter((area) => (areaToDomain.get(area) || "otros") === activeDomain);
  }, [allAreas, activeDomain, areaToDomain]);

  const totalProtocols = data.length;
  const totalAreas = useMemo(() => allAreas.length, [allAreas]);
  const totalGrupos = useMemo(
    () => new Set((data || []).map((p) => p.grupo).filter(Boolean)).size,
    [data]
  );

  const domainCoverage = useMemo(() => {
    const sets = {
      solid: new Set(),
      hemato: new Set(),
      otros: new Set()
    };
    data.forEach((protocolo) => {
      const area = protocolo.area || DEFAULT_AREA;
      const domain = areaToDomain.get(area) || inferDomain(area);
      (sets[domain] ?? sets.otros).add(area);
    });
    return {
      solid: sets.solid.size,
      hemato: sets.hemato.size,
      otros: sets.otros.size
    };
  }, [data, areaToDomain]);

  const protocolos = useMemo(() => {
    const query = dq.trim().toLowerCase();
    return (data || []).filter((p) => {
      const area = p.area || DEFAULT_AREA;
      const domain = areaToDomain.get(area) || inferDomain(area);
      const matchesDomain = activeDomain === "todos" || domain === activeDomain;
      const matchesArea = !activeArea || area === activeArea;
      if (!matchesDomain || !matchesArea) return false;

      if (!query) return true;
      const hay = [p.titulo, p.area, p.grupo, p.id]
        .filter(Boolean)
        .join(" · ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [data, dq, activeArea, activeDomain, areaToDomain]);

  const groupedByDomain = useMemo(() => {
    const map = new Map();
    protocolos.forEach((p) => {
      const area = p.area || DEFAULT_AREA;
      const domain = areaToDomain.get(area) || inferDomain(area);
      if (!map.has(domain)) map.set(domain, new Map());
      const areaMap = map.get(domain);
      if (!areaMap.has(area)) areaMap.set(area, []);
      areaMap.get(area).push(p);
    });

    return DOMAIN_ORDER.map((domain) => {
      const areas = map.get(domain);
      if (!areas) return null;
      return {
        domain,
        label: DIAG_GROUPS[domain]?.label || "Otros",
        subtitle: DIAG_GROUPS[domain]?.subtitle,
        areas: Array.from(areas.entries()).sort(([a], [b]) => a.localeCompare(b))
      };
    }).filter(Boolean);
  }, [protocolos, areaToDomain]);

  const totalVersiones = useMemo(
    () =>
      data.reduce((acc, protocolo) => {
        const versiones = Array.isArray(protocolo.versiones) ? protocolo.versiones.length : 0;
        return acc + versiones;
      }, 0),
    [data]
  );

  const totalEstrategias = useMemo(
    () =>
      data.reduce((acc, protocolo) => {
        const versiones = Array.isArray(protocolo.versiones) ? protocolo.versiones : [];
        versiones.forEach((version) => {
          const estrats = Array.isArray(version.estratificacion) ? version.estratificacion : [];
          estrats.forEach((e) => acc.add(e.id || e.label));
        });
        return acc;
      }, new Set()).size,
    [data]
  );

  const coverage = useMemo(() => {
    const keys = [
      "evaluacion",
      "cirugia",
      "radioterapia",
      "quimioterapia",
      "inmunoterapia",
      "trasplante",
      "profilaxis",
      "soporte",
      "seguimiento"
    ];
    const totals = Object.fromEntries(keys.map((k) => [k, 0]));
    data.forEach((protocolo) => {
      const versiones = Array.isArray(protocolo.versiones) ? protocolo.versiones : [];
      const universe = versiones.length ? versiones : [{}];
      keys.forEach((key) => {
        const hasKey = universe.some((version) =>
          Boolean(version[key] || (version.quimioterapia && version.quimioterapia[key]))
        );
        if (hasKey) totals[key] += 1;
      });
    });
    return { totals, keys };
  }, [data]);

  const multiNumerator = coverage.totals.quimioterapia + coverage.totals.inmunoterapia;
  const multiDisplay = totalProtocols
    ? `${multiNumerator}/${totalProtocols * 2}`
    : "0";

  const isFiltering = Boolean(q || activeArea || activeDomain !== "todos");

  const highlight = (text, query) => {
    if (!query) return text;
    const normText = String(text);
    const idx = normText.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return normText;
    const before = normText.slice(0, idx);
    const match = normText.slice(idx, idx + query.length);
    const after = normText.slice(idx + query.length);
    return (
      <>
        {before}
        <mark>{match}</mark>
        {after}
      </>
    );
  };

  return (
    <main className="container page-shell">
      <div className="home">
        <section className="hero-card" aria-labelledby="hero-title" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="hero-card__content">
            <span className="hero-card__eyebrow">Oncología y hematología pediátrica</span>
            <h1 id="hero-title">Protocolos sintetizados y estructurados</h1>
            <p className="hero-card__lead">
              Pediatrack resume y estructura protocolos extensos y complejos de tumores sólidos y hematológicos para hacerlos legibles y aplicables: fases de decisión, esquemas terapéuticos y seguimiento de toxicidades. Enfoque técnico, rigor y trazabilidad.
            </p>
            <div className="hero-card__stats">
              <span className="stat-pill">📄 {totalProtocols} protocolo{totalProtocols === 1 ? "" : "s"} activos</span>
              <span className="stat-pill">🧠 {domainCoverage.solid} áreas de tumores sólidos</span>
              <span className="stat-pill">🩸 {domainCoverage.hemato} áreas hematológicas</span>
            </div>
          </div>
          <div
            className="hero-card__illustration"
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '48px',
              top: '88px',
              width: '320px',
              maxWidth: '32%'
            }}
          >
            <img
              src="/logo-inverso.avif"
              alt=""
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </section>

        <section id="protocolos" className="search-panel" aria-label="Buscador de protocolos">
          <div className="search-panel__heading">
            <h2>Explorar protocolos</h2>
            <div className="search-count" aria-live="polite">
              {isFiltering
                ? `${protocolos.length} coincidencia${protocolos.length === 1 ? "" : "s"}`
                : `${totalProtocols} protocolo${totalProtocols === 1 ? "" : "s"} disponibles`}
            </div>
            <button
              type="button"
              className="reset-filters"
              onClick={() => {
                setQ("");
                setActiveArea("");
                setActiveDomain("todos");
              }}
              aria-label="Restablecer filtros"
            >
              Reiniciar filtros
            </button>
          </div>
          <form
            role="search"
            aria-label="Buscar protocolo"
            className="search-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="search-bar">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por protocolo, patología, grupo cooperativo o ID…"
                aria-label="Buscar protocolos"
                autoFocus
                title="Pulsa / para buscar"
              />
              {q && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="domain-selector" role="group" aria-label="Tipo de patología">
              {DOMAIN_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="domain-chip"
                  aria-pressed={activeDomain === option.id}
                  onClick={() => {
                    setActiveDomain(option.id);
                    setActiveArea("");
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>
                    {option.id === "todos"
                      ? `${totalProtocols} protocolos`
                      : `${domainCoverage[option.id] ?? 0} áreas registradas`}
                  </span>
                </button>
              ))}
            </div>

            <div className="chip-group" role="group" aria-label="Filtrar por diagnóstico">
              <span className="chip-label">Diagnósticos</span>
              <button
                type="button"
                onClick={() => setActiveArea("")}
                className={`chip ${activeArea === "" ? "chip--active" : ""}`}
                aria-pressed={activeArea === ""}
              >
                Todos
              </button>
              {filteredAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setActiveArea(area)}
                  className={`chip ${activeArea === area ? "chip--active" : ""}`}
                  aria-pressed={activeArea === area}
                >
                  {area}
                </button>
              ))}
            </div>
          </form>

          {isFiltering ? (
            protocolos.length ? (
              <Grid protocolos={protocolos} highlight={highlight} query={dq} />
            ) : (
              <div className="empty-state" role="status">
                <strong>No encontramos resultados.</strong>
                <span>
                  Ajusta el tipo de patología o modifica la búsqueda para localizar el protocolo que necesitas.
                </span>
              </div>
            )
          ) : (
            <div className="empty-state" role="note">
              <strong>¿No sabes por dónde empezar?</strong>
              <span>
                Selecciona la categoría de patología o revisa más abajo las áreas integradas por tumores sólidos, hematología y soporte.
              </span>
            </div>
          )}
        </section>

        {!isFiltering && groupedByDomain.length > 0 && (
          <section aria-label="Protocolos por dominio terapéutico">
            {groupedByDomain.map(({ domain, label, subtitle, areas }) => (
              <div key={domain} className="domain-section">
                <header className="domain-section__header">
                  <h3 className="domain-section__title">{label}</h3>
                  {subtitle && <p className="domain-section__caption">{subtitle}</p>}
                </header>
                {areas.map(([areaName, items]) => (
                  <div key={areaName} className="area-section">
                    <h4 className="area-section__title">{areaName}</h4>
                    <Grid protocolos={items} highlight={highlight} query={dq} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        <section id="telemetria" className="insights-panel" aria-label="Resumen técnico de datos">
          <div className="insights-header">
            <h2>Telemetría del dataset</h2>
            <p>Instantánea generada a partir de los archivos JSON integrados en la build.</p>
          </div>
          <div className="insights-grid">
            <article className="insight-card">
              <span className="insight-card__label">Versiones publicadas</span>
              <span className="insight-card__value">{totalVersiones}</span>
              <span className="insight-card__footnote">
                Conteo de las variaciones de protocolo disponibles para revisión.
              </span>
            </article>
            <article className="insight-card">
              <span className="insight-card__label">Estrategias de riesgo</span>
              <span className="insight-card__value">{totalEstrategias}</span>
              <span className="insight-card__footnote">
                Modalidades LR/SR y ramas experimentales identificadas por protocolo.
              </span>
            </article>
            <article className="insight-card">
              <span className="insight-card__label">Cobertura de radioterapia</span>
              <span className="insight-card__value">
                {coverage.totals.radioterapia}/{totalProtocols}
              </span>
              <span className="insight-card__footnote">
                Protocolos con planificación de RT diferenciada por riesgo o rama.
              </span>
            </article>
            <article className="insight-card">
              <span className="insight-card__label">Trayectos multidisciplina</span>
              <span className="insight-card__value">{multiDisplay}</span>
              <span className="insight-card__footnote">
                Quimioterapia + inmunoterapia respecto al máximo esperable por protocolo.
              </span>
            </article>
          </div>
        </section>

        <section id="pipeline" className="tech-section" aria-label="Arquitectura y pipeline clínico">
          <div className="tech-section__grid">
            <div>
              <h2>Arquitectura de visualización</h2>
              <p className="tech-section__lead">
                Cada mapa se renderiza en cliente mediante React Flow, sincronizado con el motor temporal de Pediatrack.
                El runtime usa Next.js 14 (app router) con revalidación de 60 segundos, asegurando que las actualizaciones
                de JSON lleguen sin despliegues manuales.
              </p>
              <ul className="timeline-list tech-section__timeline">
                <li className="timeline-item">
                  <span className="timeline-item__title">1. Parsing de protocolos</span>
                  <p className="timeline-item__descr">
                    `getProtocol` resuelve el fichero respetando el casing para evitar fallos en ambientes Linux/macOS.
                  </p>
                </li>
                <li className="timeline-item">
                  <span className="timeline-item__title">2. Resolución de anclas</span>
                  <p className="timeline-item__descr">
                    Los anchors (`rt_start`, `mtto_cycle_index`) se transforman en semanas absolutas para dibujar la línea temporal.
                  </p>
                </li>
                <li className="timeline-item">
                  <span className="timeline-item__title">3. Render adaptativo</span>
                  <p className="timeline-item__descr">
                    El visor alterna entre timeline clínico y mapa interactivo según la necesidad del comité oncológico.
                  </p>
                </li>
              </ul>
            </div>
            <div>
              <h2>Checklist de completitud clínica</h2>
              <div className="schema-card">
                <table>
                  <thead>
                    <tr>
                      <th>Recurso</th>
                      <th>Protocolos cubiertos</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.keys.map((key) => (
                      <tr key={key}>
                        <td><code>{key}</code></td>
                        <td>{coverage.totals[key]} / {totalProtocols}</td>
                        <td>
                          {coverage.totals[key] === totalProtocols
                            ? "Presente en todos los protocolos"
                            : "Pendiente de completar en algunos archivos"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="page-footer">
        © {new Date().getFullYear()} Pediatrack — prototipado clínico. Esta demo no sustituye a la práctica clínica ni a los documentos oficiales del protocolo.
      </footer>
    </main>
  );
}

function Grid({ protocolos, highlight, query }) {
  return (
    <ul className="protocol-grid">
      {protocolos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/protocolo/${p.id}`}
            className="protocol-card"
            aria-label={`Ver protocolo ${p.titulo || p.nombre || p.id}`}
          >
            <div className="protocol-card__meta">
              <span>{highlight(p.area || DEFAULT_AREA, query)}</span>
              {p.grupo && <span>· {highlight(p.grupo, query)}</span>}
            </div>
            <p className="protocol-card__title">{highlight(p.titulo || p.nombre || p.id, query)}</p>
            <div className="tag-row">
              <span className="badge">
                <img
                  className="badge__logo"
                  src="/pediatrack-mark.svg"
                  alt=""
                  width="14"
                  height="14"
                  aria-hidden="true"
                />
                <span>ID {p.id}</span>
              </span>
              {p.nombre && <span className="badge badge--secondary">{p.nombre}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
