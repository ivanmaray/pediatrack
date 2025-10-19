"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

async function loadProtocol(id) {
  const res = await fetch(`/api/protocolo/${id}`);
  if (!res.ok) return null;
  return res.json();
}

const DEFAULT_AREA = "Meduloblastoma";

const DIAG_GROUPS = {
  solid: {
    label: "Tumores sólidos pediátricos",
    subtitle: "Tumores cerebrales, sarcomas, neuroblastoma y otros sólidos.",
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

export default function HomeClient({ initialData, onlySearch = false }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const metaData = Array.isArray(initialData) ? initialData : [];
  const [q, setQ] = useState("");
  const [activeArea, setActiveArea] = useState("");
  const [activeDomain, setActiveDomain] = useState("todos");
  const [fullProtocols, setFullProtocols] = useState([]);
  const searchRef = useRef(null);
  const sectionRef = useRef(null);
  const dq = useDebouncedValue(q, 200);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const promises = metaData.map(p => loadProtocol(p.id));
        const res = await Promise.all(promises);
        setFullProtocols(res.filter(Boolean));
      } catch (err) {
        console.error("Error loading protocols:", err);
      }
    };
    load();
  }, [metaData]);

  // Telemetría simple en localStorage
  const logEvent = (type, payload = {}) => {
    try {
      const key = 'pt.telemetry';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ t: Date.now(), type, ...payload });
      localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
    } catch {}
  };

  useEffect(() => {
    // cargar recientes al montar
    try {
      const raw = localStorage.getItem('pt.recentSearches');
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    // guardar términos de búsqueda recientes tras debounce
    if (!onlySearch) return;
    const term = dq.trim();
    if (!term) return;
    try {
      const raw = localStorage.getItem('pt.recentSearches');
      const arr = raw ? JSON.parse(raw) : [];
      const next = [term, ...arr.filter(x => x !== term)].slice(0, 8);
      localStorage.setItem('pt.recentSearches', JSON.stringify(next));
      setRecentSearches(next);
      logEvent('search', { q: term, area: activeArea, domain: activeDomain });
    } catch {}
  }, [dq]);

  const data = fullProtocols.length ? fullProtocols : metaData;

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

  // Coincidencias de diagnósticos según lo escrito en la barra de búsqueda (home)
  const areaMatches = useMemo(() => {
    const term = dq.trim().toLowerCase();
    const base = filteredAreas;
    if (!term) return base.slice(0, 16);
    return base.filter((a) => a.toLowerCase().includes(term)).slice(0, 16);
  }, [filteredAreas, dq]);

  // Leer parámetros de la URL en modo búsqueda para prefiltrar
  useEffect(() => {
    if (!onlySearch || !searchParams) return;
    const domainParam = searchParams.get("domain");
    const areaParam = searchParams.get("area");
    const qParam = searchParams.get("q");
    if (domainParam && ["todos","solid","hemato","otros"].includes(domainParam)) {
      setActiveDomain(domainParam);
    }
    if (areaParam) {
      setActiveArea(areaParam);
    }
    if (qParam) {
      setQ(qParam);
    }
    // Solo a la carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlySearch, searchParams]);

  // Persistir filtros en la URL para compartir estado
  useEffect(() => {
    if (!onlySearch || !router) return;
    const params = new URLSearchParams();
    if (activeDomain && activeDomain !== 'todos') params.set('domain', activeDomain);
    if (activeArea) params.set('area', activeArea);
    if (dq) params.set('q', dq);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : `/search`);
  }, [onlySearch, router, dq, activeArea, activeDomain]);

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

  // Desplazar vista al bloque de resultados cuando cambian filtros o búsqueda
  const prevFiltersRef = useRef({ q: "", area: "", domain: "todos" });
  useEffect(() => {
    if (!onlySearch) return;
    const prev = prevFiltersRef.current;
    const changed = prev.q !== dq || prev.area !== activeArea || prev.domain !== activeDomain;
    prevFiltersRef.current = { q: dq, area: activeArea, domain: activeDomain };
    if (!changed) return;
    if (sectionRef.current && (dq || activeArea || activeDomain !== "todos")) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [dq, activeArea, activeDomain, onlySearch]);

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

  // Home index de diagnósticos (sin buscador): muestra áreas y, al clicar, despliega sus protocolos
  const areasFromData = useMemo(() => {
    return Array.from(new Set((data || []).map(p => p.area).filter(Boolean)));
  }, [data]);
  const PREFERRED_ORDER = [
    "Leucemia linfoblástica aguda",
    "Linfoma de Hodgkin",
    "Meduloblastoma",
    "Neuroblastoma",
    "Tumor de Wilms",
    "Sarcomas de partes blandas",
    "Sarcomas óseos",
    "Gliomas de bajo grado",
    "Gliomas de alto grado"
  ];
  const orderedAreas = useMemo(() => {
    return [...areasFromData].sort((a, b) => {
      const ia = PREFERRED_ORDER.indexOf(a);
      const ib = PREFERRED_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'es');
    });
  }, [areasFromData]);
  const byArea = useMemo(() => {
    const m = new Map();
    (data || []).forEach(p => {
      const area = p.area || DEFAULT_AREA;
      if (!m.has(area)) m.set(area, []);
      m.get(area).push(p);
    });
    return m;
  }, [data]);
  const [openArea, setOpenArea] = useState("");

  return (
    <main className="container page-shell">
      <div className="home">
        {!onlySearch && (
          <>
            <section className="hero hero--center" aria-labelledby="hero-title">
              <div className="hero__brand">
                <img src="/pediatrack-mark.svg" alt="" width="40" height="40" aria-hidden="true" />
                <span className="eyebrow">Oncología y Hematología pediátricas</span>
              </div>
              <h1 id="hero-title">Mapas terapéuticos, precisos y accionables</h1>
              <p className="hero__lead">Explora protocolos onco-hematológicos por patología. Visualiza fases y ciclos con tiempos y dosis, listos para la práctica clínica y los comités.</p>
              <ul className="hero__bullets" aria-label="Ventajas clave">
                <li>Inducción, consolidación, RT e inmuno</li>
                <li>Exportación a PNG/PDF</li>
                <li>Enlaces compartibles con estado</li>
              </ul>
              <div className="quick-links" aria-label="Incluye">
                <span className="chip" aria-hidden="true">Incluye:</span>
                <span className="chip">Evaluaciones</span>
                <span className="chip">Quimioterapia</span>
                <span className="chip">Inmunoterapia</span>
                <span className="chip">Radioterapia</span>
                <span className="chip">Trasplante (TPH)</span>
                <span className="chip">Seguimiento</span>
              </div>
            </section>

            <section aria-labelledby="oncop-title">
              <header style={{textAlign: 'center', marginBottom: 12}}>
                <h2 id="oncop-title" style={{margin: 0}}>Elige una patología onco-hematológica</h2>
                <p className="hero__lead" style={{marginTop: 4}}>Haz clic en un diagnóstico para ver los protocolos disponibles.</p>
              </header>
              {DOMAIN_ORDER.map((domainKey) => {
                const title = DIAG_GROUPS[domainKey]?.label || (domainKey === 'hemato' ? 'Hematología oncológica' : domainKey === 'solid' ? 'Tumores sólidos pediátricos' : 'Protocolos transversales y soporte');
                const areasForDomain = orderedAreas.filter(a => (areaToDomain.get(a) || inferDomain(a)) === domainKey);
                if (areasForDomain.length === 0) return null;
                return (
                  <div key={domainKey} className="domain-section">
                    <h3 className="domain-section__title" style={{ margin: '16px 8px' }}>{title}</h3>
                    <ul className="protocol-grid" aria-label={`Diagnósticos · ${title}`}>
                    {areasForDomain.map((area) => {
                const count = byArea.get(area)?.length || 0;
                const expanded = openArea === area;
                return (
                  <li key={area}>
                    <button
                      type="button"
                      className="protocol-card"
                      aria-expanded={expanded}
                      onClick={() => setOpenArea(expanded ? "" : area)}
                      style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
                    >
                      <div className="protocol-card__meta">
                        <span>{area}</span>
                      </div>
                      <p className="protocol-card__title">{count} protocolo{count === 1 ? '' : 's'}</p>
                      <div className="tag-row">
                        <span className="badge">Ver protocolos</span>
                      </div>
                    </button>
                    {expanded && (
                      <div style={{ marginTop: 8 }}>
                        <Grid protocolos={byArea.get(area) || []} highlight={(x)=>x} query={""} />
                      </div>
                    )}
                  </li>
                    );
                  })}
                    </ul>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {onlySearch && (
          <section id="protocolos" ref={sectionRef} className="search-panel" aria-label="Buscador de protocolos">
            <div className="search-panel__heading">
              <h2>🔍 Búsqueda avanzada de protocolos</h2>
              <div className="search-summary">
                <div className="search-count" aria-live="polite">
                  {isFiltering ? (
                    <>
                      <strong>{protocolos.length}</strong> resultado{protocolos.length === 1 ? "" : "s"}
                      {q && <span className="filter-active"> · "{dq}"</span>}
                      {activeDomain !== "todos" && <span className="filter-active"> · {DOMAIN_OPTIONS.find(d => d.id === activeDomain)?.label}</span>}
                      {activeArea && <span className="filter-active"> · {activeArea}</span>}
                    </>
                  ) : (
                    <>
                      <strong>{totalProtocols}</strong> protocolos disponibles
                    </>
                  )}
                </div>
                {(q || activeArea || activeDomain !== "todos") && (
                  <button
                    type="button"
                    className="reset-filters"
                    onClick={() => {
                      setQ("");
                      setActiveArea("");
                      setActiveDomain("todos");
                      try {
                        const key = 'pt.telemetry';
                        const arr = JSON.parse(localStorage.getItem(key) || '[]');
                        arr.push({ t: Date.now(), type: 'filters_reset' });
                        localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                      } catch {}
                    }}
                    aria-label="Restablecer todos los filtros"
                  >
                    🧹 Limpiar todos los filtros
                  </button>
                )}
              </div>
            </div>

            {(q || activeArea || activeDomain !== "todos") && (
              <div className="active-filters" role="list" aria-label="Filtros activos">
                {q && (
                  <span className="active-chip" role="listitem">
                    "{dq}"
                    <button
                      type="button"
                      className="active-chip__remove"
                      aria-label="Quitar filtro de búsqueda"
                      onClick={() => {
                        setQ("");
                        try {
                          const key = 'pt.telemetry';
                          const arr = JSON.parse(localStorage.getItem(key) || '[]');
                          arr.push({ t: Date.now(), type: 'filter_remove', key: 'q' });
                          localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                        } catch {}
                      }}
                    >×</button>
                  </span>
                )}
                {activeDomain !== "todos" && (
                  <span className="active-chip" role="listitem">
                    {DOMAIN_OPTIONS.find(d => d.id === activeDomain)?.label || activeDomain}
                    <button
                      type="button"
                      className="active-chip__remove"
                      aria-label="Quitar filtro de categoría"
                      onClick={() => {
                        setActiveDomain("todos");
                        try {
                          const key = 'pt.telemetry';
                          const arr = JSON.parse(localStorage.getItem(key) || '[]');
                          arr.push({ t: Date.now(), type: 'filter_remove', key: 'domain' });
                          localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                        } catch {}
                      }}
                    >×</button>
                  </span>
                )}
                {activeArea && (
                  <span className="active-chip" role="listitem">
                    {activeArea}
                    <button
                      type="button"
                      className="active-chip__remove"
                      aria-label="Quitar filtro de área"
                      onClick={() => {
                        setActiveArea("");
                        try {
                          const key = 'pt.telemetry';
                          const arr = JSON.parse(localStorage.getItem(key) || '[]');
                          arr.push({ t: Date.now(), type: 'filter_remove', key: 'area' });
                          localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                        } catch {}
                      }}
                    >×</button>
                  </span>
                )}
              </div>
            )}
            <form
              role="search"
              aria-label="Buscar protocolo"
              className="search-form"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="search-section">
                <div className="search-bar">
                  <div className="search-input-container">
                    <input
                      ref={searchRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Ej: neuroblastoma, meduloblastoma, ALL, Hodgkin…"
                      aria-label="Buscar protocolos por nombre o código"
                      autoFocus
                      title="Busca por protocolos específicos, patologías o códigos. Presiona / para buscar"
                      list="search-suggestions"
                    />
                    <datalist id="search-suggestions">
                      <option value="neuroblastoma"></option>
                      <option value="meduloblastoma"></option>
                      <option value="sarcoma óseo"></option>
                      <option value="sarcoma de partes blandas"></option>
                      <option value="tumor de Wilms"></option>
                      <option value="ALL"></option>
                      <option value="Hodgkin"></option>
                      <option value="PNET5"></option>
                      <option value="HRNBL"></option>
                      <option value="blastoma hepatocelular"></option>
                    </datalist>
                    {q && (
                      <button
                        type="button"
                        className="search-clear"
                        onClick={() => setQ("")}
                        aria-label="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {recentSearches.length > 0 && (
                  <div className="recent-searches" role="list" aria-label="Búsquedas recientes" style={{marginTop: 8}}>
                    <span className="chip-label">Recientes:</span>
                    <div className="chip-group">
                      {recentSearches.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="chip"
                          role="listitem"
                          onClick={() => setQ(term)}
                        >{term}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="filters-section">
                <div className="filter-group">
                  <label className="filter-label">Categoría de patología</label>
                  <div className="domain-selector" role="group" aria-label="Tipo de patología">
                    {DOMAIN_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`domain-chip ${activeDomain === option.id ? 'domain-chip--active' : ''}`}
                        aria-pressed={activeDomain === option.id}
                        onClick={() => {
                          setActiveDomain(option.id);
                          setActiveArea("");
                          try {
                            const key = 'pt.telemetry';
                            const arr = JSON.parse(localStorage.getItem(key) || '[]');
                            arr.push({ t: Date.now(), type: 'filter_domain', domain: option.id });
                            localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                          } catch {}
                        }}
                      >
                        <strong>{option.label}</strong>
                        <span className="domain-chip__count">
                          {option.id === "todos"
                            ? `${totalProtocols} protocolos`
                            : `${domainCoverage[option.id] ?? 0} áreas`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {activeDomain !== "todos" && filteredAreas.length > 0 && (
                  <div className="filter-group">
                    <label className="filter-label">Diagnósticos específicos</label>
                    <div className="chip-group" role="group" aria-label="Filtrar por diagnóstico">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveArea("");
                          try {
                            const key = 'pt.telemetry';
                            const arr = JSON.parse(localStorage.getItem(key) || '[]');
                            arr.push({ t: Date.now(), type: 'filter_area', area: '' });
                            localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                          } catch {}
                        }}
                        className={`chip ${activeArea === "" ? "chip--active" : ""}`}
                        aria-pressed={activeArea === ""}
                      >
                        ✅ Todos los diagnósticos
                      </button>
                      {filteredAreas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => {
                            setActiveArea(area);
                            try {
                              const key = 'pt.telemetry';
                              const arr = JSON.parse(localStorage.getItem(key) || '[]');
                              arr.push({ t: Date.now(), type: 'filter_area', area });
                              localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
                            } catch {}
                          }}
                          className={`chip ${activeArea === area ? "chip--active" : ""}`}
                          aria-pressed={activeArea === area}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </form>

             {isFiltering ? (
               protocolos.length ? (
                 <Grid protocolos={protocolos} highlight={highlight} query={dq} />
               ) : (
                 <div className="empty-state" role="status" aria-live="polite">
                   <h3>No encontramos resultados.</h3>
                   <p>Prueba a:</p>
                   <ul>
                     <li>Buscar por patología ("neuroblastoma", "meduloblastoma", "Hodgkin").</li>
                     <li>Limpiar filtros o cambiar de categoría.</li>
                     <li>Usar siglas: HRNBL, PNET5, LLA.</li>
                   </ul>
                   <div className="quick-examples">
                     <span>Ejemplos rápidos:</span>
                     <div className="quick-picker__chips">
                       <button type="button" className="chip" onClick={() => setQ('neuroblastoma')}>neuroblastoma</button>
                       <button type="button" className="chip" onClick={() => setQ('meduloblastoma')}>meduloblastoma</button>
                       <button type="button" className="chip" onClick={() => setQ('Hodgkin')}>Hodgkin</button>
                       <button type="button" className="chip" onClick={() => setQ('PNET5')}>PNET5</button>
                     </div>
                   </div>
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
        )}

        {onlySearch && !isFiltering && groupedByDomain.length > 0 && (
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

        {false && (
          <section className="featured" aria-label="Protocolos destacados">
            <header className="section-header">
              <h2>Destacados</h2>
            </header>
            <Grid protocolos={data.slice(0, 4)} highlight={highlight} query={""} />
          </section>
        )}

        {/* Telemetría y sección técnica eliminadas de la home para un diseño más limpio */}

        {/* Secciones técnicas y checklist retiradas de la home */}

        {!onlySearch && (
          <footer className="page-footer">
            © {new Date().getFullYear()} Pediatrack. Uso demostrativo; no sustituye documentos oficiales.
          </footer>
        )}
      </div>
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
            onClick={() => {
              try {
                const key = 'pt.telemetry';
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                arr.push({ t: Date.now(), type: 'open_protocol', id: p.id });
                localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
              } catch {}
            }}
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
