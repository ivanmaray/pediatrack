"use client";

import { useMemo } from "react";

const titleCase = (str) =>
  (str || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ANCHOR_LABELS = {
  treatment_start: "Inicio de tratamiento",
  rt_start: "Inicio radioterapia",
  rt_end: "Fin radioterapia",
  mtto_start: "Inicio mantenimiento",
  treatment_end: "Fin de tratamiento",
  absolute_week: "Semana específica",
};

const SPAN_LABELS = {
  induction_cycle_span: "Inducción RAPID COJEC",
  treatment_span: "Plan terapéutico completo",
  rt_span: "Ventana de radioterapia"
};

const parseWeeksRange = (str) => {
  if (!str) return { start: 0, end: 0, span: 0 };
  const match = String(str).match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) return { start: 0, end: 0, span: 0 };
  const start = Number(match[1] || 0);
  const end = Number(match[2] || start);
  return { start, end, span: Math.max(0, end - start) };
};

const parseWeekFromString = (value) => {
  if (!value) return null;
  const str = String(value);
  const weekMatch = str.match(/sem(?:\.|ana)?\s*(\d+)/i);
  if (weekMatch) return Number(weekMatch[1]);
  const rangeMatch = str.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (rangeMatch) {
    const { start } = parseWeeksRange(str);
    return start;
  }
  const dayMatch = str.match(/d[ií]a[s]?\s*(\d+)/i);
  if (dayMatch) return Number(dayMatch[1]) / 7;
  return null;
};

const normalizeRtMode = (id = "LR") => {
  const lower = String(id).toLowerCase();
  if (lower.includes("carbo")) return "SR_carbo";
  if (lower.includes("sr")) return "SR_sola";
  return "LR";
};

const buildMttoDurations = (quimio = {}, legacy = {}) => {
  const source =
    quimio?.mantenimiento?.duraciones ||
    quimio?.duraciones ||
    legacy?.duraciones ||
    {};
  const result = {};
  Object.entries(source).forEach(([key, value]) => {
    const num = Number(value);
    if (!Number.isNaN(num)) result[key] = num;
  });
  if (!Object.keys(result).length) {
    result.A = 6;
    result.B = 3;
  }
  return result;
};

const buildMttoOrden = (quimio = {}, legacy = {}, rtMode = "LR") => {
  const planes = quimio?.planes || {};
  if (rtMode === "LR" && Array.isArray(planes.lr?.orden)) return planes.lr.orden;
  if (rtMode !== "LR" && Array.isArray(planes.sr?.orden)) return planes.sr.orden;
  if (rtMode === "LR" && Array.isArray(quimio?.LR?.orden)) return quimio.LR.orden;
  if (rtMode !== "LR" && Array.isArray(quimio?.SR?.orden)) return quimio.SR.orden;
  if (Array.isArray(quimio?.mantenimiento?.orden)) return quimio.mantenimiento.orden;
  if (Array.isArray(legacy?.orden)) return legacy.orden;
  return [];
};

const findDefaultStrat = (version, fallbackVersion) => {
  const strat =
    (Array.isArray(version?.estratificacion) && version.estratificacion) ||
    (Array.isArray(fallbackVersion?.estratificacion) && fallbackVersion.estratificacion) ||
    [];
  return strat.find((s) => s?.default) || strat[0] || null;
};

const createTimelineContext = (protocolo, version) => {
  const baseVersion = Array.isArray(protocolo.versiones) ? protocolo.versiones[0] || {} : {};
  const radioterapia = version.radioterapia ?? baseVersion.radioterapia ?? protocolo.radioterapia ?? {};
  const quimio = version.quimioterapia ?? baseVersion.quimioterapia ?? protocolo.quimioterapia ?? {};
  const legacyMtto = version.mantenimiento ?? baseVersion.mantenimiento ?? protocolo.mantenimiento ?? {};

  const defaultStrat = findDefaultStrat(version, baseVersion);
  const rtMode = normalizeRtMode(defaultStrat?.id);

  const options = Array.isArray(radioterapia?.opciones) ? radioterapia.opciones : [];
  const optionMap = Object.fromEntries(options.map((opt) => [normalizeRtMode(opt.id), opt]));
  const rtOption = optionMap[rtMode];
  const rtBlock = rtMode === "LR" ? radioterapia?.LR : radioterapia?.SR;
  const induction = Array.isArray(quimio.induccion) ? quimio.induccion : [];
  const inductionIntervalWeeks = Number(quimio.induccion_intervalo_semanas) || 3;
  const inductionStartWeek = (() => {
    if (!induction.length) return 0;
    const firstWhen = induction[0]?.when;
    if (typeof firstWhen === "object") {
      if (typeof firstWhen.offset_weeks === "number" && firstWhen.anchor === "treatment_start") {
        return Number(firstWhen.offset_weeks);
      }
      if (typeof firstWhen.week === "number") return Number(firstWhen.week);
    }
    const wk = parseWeekFromString(firstWhen);
    return wk ?? 0;
  })();

  const pickWhen = rtOption?.when || rtBlock?.when;
  const computeStaticWeek = (when) => {
    if (!when) return null;
    if (typeof when === "number") return when;
    if (typeof when === "string") return parseWeekFromString(when);
    if (Array.isArray(when)) {
      for (const entry of when) {
        const week = computeStaticWeek(entry);
        if (week != null) return week;
      }
      return null;
    }
    const offset = Number(when.offset_weeks || 0);
    switch (when.anchor) {
      case "treatment_start":
        return offset;
      case "absolute_week":
        return Number(when.week || 0) + offset;
      default:
        return null;
    }
  };

  const rtStartWeek = computeStaticWeek(pickWhen) ?? 4;

  const spanFromBlock = (block) => {
    if (!block) return 0;
    if (typeof block.duracion_semanas === "number") return block.duracion_semanas;
    if (block.semanas) return parseWeeksRange(block.semanas).span || 6;
    return 6;
  };
  const rtSpan =
    (typeof rtOption?.duracion_semanas === "number" && rtOption.duracion_semanas) ||
    spanFromBlock(rtBlock) ||
    6;

  const mttoDurations = buildMttoDurations(quimio, legacyMtto);
  const mttoOrden = buildMttoOrden(quimio, legacyMtto, rtMode);
  const durationFor = (symbol) => {
    if (symbol == null) return 6;
    const key = String(symbol).trim();
    const val = mttoDurations[key];
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (key.toUpperCase() === "B") return 3;
    if (key.toUpperCase() === "C") return 4;
    return 6;
  };
  const sumDurationsBefore = (index) => {
    if (!Array.isArray(mttoOrden) || !mttoOrden.length) return 0;
    let sum = 0;
    for (let i = 0; i < index && i < mttoOrden.length; i += 1) {
      sum += durationFor(mttoOrden[i]);
    }
    return sum;
  };

  const rel = quimio?.inicio_relativo;
  const mttoStartOffset = (() => {
    if (!rel) return rtStartWeek + rtSpan + 2;
    const offset = Number(rel.offset_weeks || 0);
    switch (rel.anchor) {
      case "rt_end":
        return rtStartWeek + rtSpan + offset;
      case "rt_start":
        return rtStartWeek + offset;
      case "treatment_start":
        return offset;
      case "absolute_week":
        return Number(rel.week || 0) + offset;
      default:
        return rtStartWeek + rtSpan + offset;
    }
  })();

  const totalMttoWeeks = mttoOrden.length ? sumDurationsBefore(mttoOrden.length) : 0;
  const treatmentEndWeek =
    mttoOrden.length > 0 ? mttoStartOffset + totalMttoWeeks : rtStartWeek + rtSpan;

  const resolveWhenWeek = (when) => {
    if (!when) return null;
    if (Array.isArray(when)) {
      for (const entry of when) {
        const resolved = resolveWhenWeek(entry);
        if (resolved != null) return resolved;
      }
      return null;
    }
    if (typeof when === "number") return when;
    if (typeof when === "string") return parseWeekFromString(when);
    if (typeof when !== "object") return null;

    if (typeof when.week === "number") {
      return Number(when.week) + Number(when.offset_weeks || 0);
    }

    const offset = Number(when.offset_weeks || 0);
    switch (when.anchor) {
      case "treatment_start":
        return offset;
      case "absolute_week":
        return Number(when.week || 0) + offset;
      case "rt_start":
        return rtStartWeek + offset;
      case "rt_end":
        return rtStartWeek + rtSpan + offset;
      case "induction_cycle_index": {
        const idx = Number(when.cycle_index || 0);
        return inductionStartWeek + idx * inductionIntervalWeeks + offset;
      }
      case "induction_cycle_span": {
        const startIndex = Number(when.start_index || 0);
        return inductionStartWeek + startIndex * inductionIntervalWeeks + offset;
      }
      case "mtto_start":
        return mttoStartOffset + offset;
      case "mtto_cycle_index": {
        const idx = Number(when.cycle_index || 0);
        return mttoStartOffset + sumDurationsBefore(idx) + offset;
      }
      case "treatment_span":
        return offset;
      case "treatment_end":
        return treatmentEndWeek + offset;
      default:
        return null;
    }
  };

  return {
    resolveWhenWeek,
    resolveSpan: (when) => {
      if (!when || typeof when !== "object") return null;
      switch (when.anchor) {
        case "induction_cycle_span": {
          const startIndex = Number(when.start_index || 0);
          const endIndex = Number(when.end_index ?? startIndex);
          const startWeek = inductionStartWeek + startIndex * inductionIntervalWeeks;
          const endWeek = inductionStartWeek + (endIndex + 1) * inductionIntervalWeeks;
          return { startWeek, endWeek };
        }
        case "treatment_span": {
          const offset = Number(when.offset_weeks || 0);
          return { startWeek: offset, endWeek: treatmentEndWeek + offset };
        }
        case "rt_span": {
          return { startWeek: rtStartWeek, endWeek: rtStartWeek + rtSpan };
        }
        default: {
          if (typeof when.span_weeks === "number") {
            const baseAnchor = when.anchor?.replace(/_span$/, "") || when.anchor;
            const baseStart = baseAnchor
              ? resolveWhenWeek({ anchor: baseAnchor, offset_weeks: when.offset_weeks || 0 })
              : resolveWhenWeek({ anchor: "treatment_start", offset_weeks: when.offset_weeks || 0 });
            if (baseStart != null) {
              return { startWeek: baseStart, endWeek: baseStart + Number(when.span_weeks) };
            }
          }
          return null;
        }
      }
    },
    mttoOrden,
    mttoStartOffset,
    durationFor,
    quimio,
    legacyMtto,
  };
};

const formatWeekValue = (week) => {
  if (week == null) return "Secuencia clínica";
  if (week <= 0.1) return "Semana 0";
  if (Number.isInteger(week)) return `Semana ${week}`;
  return `Semana ${week.toFixed(1)}`;
};

const formatSpanRange = (span) => {
  if (!span) return null;
  const fmt = (value) => {
    if (value == null) return "—";
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };
  return `Semanas ${fmt(span.startWeek)} – ${fmt(span.endWeek)}`;
};

const formatWhenLabel = (when, week, span = null) => {
  if (span) {
    const anchor = typeof when === "object" ? when.anchor : null;
    const label =
      (anchor && SPAN_LABELS[anchor]) ||
      (anchor ? titleCase(anchor.replace(/_span$/, "")) : null);
    return label || formatWeekValue(week);
  }
  if (!when && week != null) return formatWeekValue(week);
  if (!when) return null;
  if (typeof when === "string") return when;
  if (Array.isArray(when)) {
    const first = when.find(Boolean);
    return first ? formatWhenLabel(first, week) : null;
  }
  if (typeof when === "object") {
    if (typeof when.week === "number") return `Semana ${when.week}`;
    const anchor = ANCHOR_LABELS[when.anchor] || titleCase(when.anchor);
    const offset = when.offset_weeks ? ` + ${when.offset_weeks} sem` : "";
    return `${anchor}${offset}`;
  }
  return null;
};

const normalizeItems = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

const PHASE_LANE_LABELS = {
  evaluacion: "Evaluaciones",
  cirugia: "Cirugía",
  radioterapia: "Radioterapia",
  inmunoterapia: "Inmunoterapia",
  profilaxis: "Soporte / Profilaxis",
  soporte: "Soporte / Profilaxis",
  trasplante: "Trasplante / ASCR",
  seguimiento: "Seguimiento"
};

const inferLaneFromPhaseId = (phaseId, fallback = "Otros") => {
  if (!phaseId) return fallback;
  if (phaseId.startsWith("quimio")) return "Quimioterapia";
  if (phaseId.startsWith("profilaxis")) return PHASE_LANE_LABELS.profilaxis;
  if (phaseId.startsWith("soporte")) return PHASE_LANE_LABELS.soporte;
  if (phaseId.startsWith("inmuno")) return PHASE_LANE_LABELS.inmunoterapia;
  if (phaseId.startsWith("trasplante")) return PHASE_LANE_LABELS.trasplante;
  if (phaseId.startsWith("seguimiento")) return PHASE_LANE_LABELS.seguimiento;
  return PHASE_LANE_LABELS[phaseId] || fallback;
};

const buildQuimioPhases = (quimio = {}, context, createItem) => {
  const phases = [];
  const lane = "Quimioterapia";
  const order = [
    ["induccion", "Inducción"],
    ["consolidacion", "Consolidación"],
    ["reinduccion", "Reinducción"],
    ["intensificacion", "Intensificación"],
    ["mantenimiento", "Mantenimiento"],
  ];

  order.forEach(([key, label]) => {
    const itemsRaw = normalizeItems(quimio[key]);
    if (key !== "mantenimiento" && !itemsRaw.length) return;

    if (key !== "mantenimiento") {
      phases.push({
        id: `quimio-${key}`,
        lane,
        title: `Quimioterapia · ${label}`,
        badge: `${itemsRaw.length} bloque${itemsRaw.length === 1 ? "" : "s"}`,
        items: itemsRaw.map((item, index) =>
          createItem(lane, {
            title: item.titulo || `${label} ${index + 1}`,
            meta: item.tipo ? titleCase(item.tipo.replace(/^q_/, "")) : null,
            when: item.when,
            body: item.descripcion,
            detalles: normalizeItems(item.drogas)?.map(
              (drug) => `${drug.nombre || ""} ${drug.dosis ? `· ${drug.dosis}` : ""}`.trim()
            ),
          })
        ),
      });
      return;
    }

    if (itemsRaw.length) {
      phases.push({
        id: "quimio-mantenimiento",
        lane,
        title: `Quimioterapia · ${label}`,
        badge: `${itemsRaw.length} bloque${itemsRaw.length === 1 ? "" : "s"}`,
        items: itemsRaw.map((item, index) =>
          createItem(lane, {
            title: item.titulo || `${label} ${index + 1}`,
            meta: item.tipo ? titleCase(item.tipo.replace(/^q_/, "")) : null,
            when: item.when,
            body: item.descripcion || item.detalle,
          })
        ),
      });
      return;
    }

    if (context.mttoOrden.length) {
      const ciclos = context.quimio?.mantenimiento?.ciclos || context.legacyMtto?.ciclos || {};
      phases.push({
        id: "quimio-mantenimiento",
        lane,
        title: "Mantenimiento secuencial",
        badge: `${context.mttoOrden.length} ciclo${context.mttoOrden.length === 1 ? "" : "s"}`,
        items: context.mttoOrden.map((simbolo, idx) => {
          const ciclo = ciclos?.[simbolo] || {};
          const farmacos = normalizeItems(ciclo.farmacos || ciclo.drogas);
          const toxicidades = normalizeItems(ciclo.toxicidades);
          const detalles = [];
          if (farmacos.length) detalles.push(...farmacos);
          if (toxicidades.length) detalles.push(`Toxicidades: ${toxicidades.join("; ")}`);

          return createItem(lane, {
            title: `Ciclo ${idx + 1} · ${simbolo}`,
            meta: ciclo.nombre || `Subciclo ${simbolo}`,
            when: { anchor: "mtto_cycle_index", cycle_index: idx },
            body: ciclo.descripcion || ciclo.resumen || ciclo.detalle || null,
            detalles: detalles.length ? detalles : undefined,
          });
        }),
      });
    }
  });

  return phases;
};

const buildPhaseSet = (version, protocolo, context) => {
  const phases = [];
  let order = 0;

  const getWhenDetails = (when, overrideLabel) => {
    const span = context.resolveSpan ? context.resolveSpan(when) : null;
    const week = context.resolveWhenWeek(when);
    const anchor = typeof when === "object" ? when.anchor : null;
    const whenLabel = overrideLabel ?? formatWhenLabel(when, week, span);
    return { week, whenLabel, span, anchor };
  };

  const createItem = (lane, raw = {}) => {
    const currentOrder = order++;
    const details = getWhenDetails(raw.when, raw.whenLabel);
    return {
      ...raw,
      order: currentOrder,
      week: details.week,
      whenLabel: details.whenLabel,
      span: details.span,
      anchor: details.anchor,
      lane,
    };
  };

  const pushPhase = ({ id, lane, items = [], ...phase }) => {
    const normalizedItems = normalizeItems(items);
    if (!normalizedItems.length && !phase.note) return;
    const resolvedLane = lane || inferLaneFromPhaseId(id);
    phases.push({
      id,
      lane: resolvedLane,
      ...phase,
      items: normalizedItems,
    });
  };

  const evaluacion = normalizeItems(version.evaluacion || protocolo.evaluacion);
  if (evaluacion.length) {
    pushPhase({
      id: "evaluacion",
      lane: PHASE_LANE_LABELS.evaluacion,
      title: "Evaluaciones clave",
      badge: `${evaluacion.length} hito${evaluacion.length === 1 ? "" : "s"}`,
      items: evaluacion.map((ev, idx) =>
        createItem(PHASE_LANE_LABELS.evaluacion, {
          title: ev.titulo || `${titleCase(ev.momento) || "Evaluación"} ${idx + 1}`,
          meta: ev.momento ? titleCase(ev.momento) : null,
          when: ev.when,
          body: ev.descripcion || ev.objetivo,
        })
      ),
    });
  }

  if (version.cirugia || protocolo.cirugia) {
    const cirugia = version.cirugia || protocolo.cirugia;
    pushPhase({
      id: "cirugia",
      lane: PHASE_LANE_LABELS.cirugia,
      title: "Cirugía",
      badge: cirugia.tipo ? titleCase(cirugia.tipo) : "Resección",
      note: cirugia.descripcion,
      items: [
        createItem(PHASE_LANE_LABELS.cirugia, {
          title: cirugia.procedimiento || "Procedimiento quirúrgico",
          when: cirugia.when,
          body: cirugia.notas || cirugia.objetivo,
        }),
      ],
    });
  }

  if (version.radioterapia || protocolo.radioterapia) {
    const rt = version.radioterapia || protocolo.radioterapia;
    const opciones = normalizeItems(rt.opciones);
    const detail =
      opciones.length > 0
        ? opciones.map((opt) =>
            createItem(PHASE_LANE_LABELS.radioterapia, {
              title: opt.label || titleCase(opt.id) || "Rama",
              when: opt.when,
              body: opt.nota || opt.descripcion,
              meta: opt.dosis || opt.dosis_total,
            })
          )
        : ["LR", "SR"]
            .map((key) => {
              const rama = rt[key];
              if (!rama) return null;
              return createItem(PHASE_LANE_LABELS.radioterapia, {
                title: `Rama ${key}`,
                when: rama.when || rama.semanas,
                body: rama.nota || rama.descripcion,
                meta: rama.dosis_total || rama.dosis || rama.rama,
              });
            })
            .filter(Boolean);

    pushPhase({
      id: "radioterapia",
      lane: PHASE_LANE_LABELS.radioterapia,
      title: "Radioterapia",
      badge: `${detail.length} escenario${detail.length === 1 ? "" : "s"}`,
      items: detail,
    });
  }

  buildQuimioPhases(context.quimio, context, createItem).forEach((phase) => pushPhase(phase));

  const soporte = version.soporte || protocolo.soporte;
  if (soporte) {
    const medidas = normalizeItems(soporte.medidas || soporte.items);
    pushPhase({
      id: "soporte",
      lane: PHASE_LANE_LABELS.soporte,
      title: "Soporte integral",
      badge: `${medidas.length || 1} intervenció${medidas.length === 1 ? "n" : "nes"}`,
      note: soporte.descripcion || soporte.objetivo,
      items:
        medidas.length > 0
          ? medidas.map((item, idx) =>
              createItem(PHASE_LANE_LABELS.soporte, {
                title: item.titulo || item.nombre || `Medida ${idx + 1}`,
                body: item.descripcion || item.articulacion,
                meta: item.tipo || null,
                whenLabel: item.cuando || null,
                when: item.when,
              })
            )
          : [
              createItem(PHASE_LANE_LABELS.soporte, {
                title: soporte.titulo || "Recomendaciones",
                body: soporte.descripcion || soporte.objetivo,
                when: soporte.when,
              }),
            ],
    });
  }

  ["profilaxis", "inmunoterapia", "trasplante", "seguimiento"].forEach((key) => {
    const block = version[key] || protocolo[key];
    if (!block) return;
    const eventos = normalizeItems(block.eventos || block.ciclos || block.fases || block.items);
    const laneLabel = key === "profilaxis" ? PHASE_LANE_LABELS.profilaxis : inferLaneFromPhaseId(key);
    pushPhase({
      id: key,
      lane: laneLabel,
      title: titleCase(key),
      badge: `${eventos.length || 1} paso${eventos.length === 1 ? "" : "s"}`,
      note: block.descripcion || block.objetivo,
      items:
        eventos.length > 0
          ? eventos.map((item, idx) =>
              createItem(laneLabel, {
                title: item.titulo || item.nombre || `${titleCase(key)} ${idx + 1}`,
                when: item.when,
                body: item.descripcion || item.detalle,
                detalles: normalizeItems(item.componentes || item.tratamientos)?.map((t) => t.titulo || t),
              })
            )
          : [
              createItem(laneLabel, {
                title: block.titulo || titleCase(key),
                body: block.descripcion || block.objetivo,
                when: block.when,
              }),
            ],
    });
  });

  return phases;
};

const buildTimeline = (phases) => {
  const items = [];
  phases.forEach((phase) => {
    (phase.items || []).forEach((item) => {
      items.push({
        id: `${phase.id || phase.title}-${item.order}`,
        phaseTitle: phase.title,
        phaseBadge: phase.badge,
        ...item,
      });
    });
  });

  items.sort((a, b) => {
    const hasA = a.week != null;
    const hasB = b.week != null;
    if (hasA && hasB) {
      if (a.week !== b.week) return a.week - b.week;
      return a.order - b.order;
    }
    if (hasA) return -1;
    if (hasB) return 1;
    return a.order - b.order;
  });

  return items.map((item, index) => ({ ...item, sequence: index + 1 }));
};

const buildLaneTracks = (phases) => {
  const MIN_DURATION = 0.6;
  const events = [];

  phases.forEach((phase) => {
    const lane = phase.lane || inferLaneFromPhaseId(phase.id);
    (phase.items || []).forEach((item) => {
      const startWeek = item.span?.startWeek ?? item.week;
      if (startWeek == null) return;
      const endWeekRaw = item.span?.endWeek ?? startWeek + MIN_DURATION;
      const endWeek = endWeekRaw > startWeek ? endWeekRaw : startWeek + MIN_DURATION;
      events.push({
        id: `${phase.id || phase.title}-${item.order}`,
        lane,
        phaseId: phase.id,
        phaseTitle: phase.title,
        phaseBadge: phase.badge,
        startWeek,
        endWeek,
        title: item.title,
        meta: item.meta,
        whenLabel: item.whenLabel,
        spanLabel: item.span ? formatSpanRange(item.span) : null,
        body: item.body,
      });
    });
  });

  const laneMap = new Map();
  let maxWeek = 0;

  events.forEach((event) => {
    maxWeek = Math.max(maxWeek, event.endWeek ?? event.startWeek ?? maxWeek);
    if (!laneMap.has(event.lane)) laneMap.set(event.lane, []);
    laneMap.get(event.lane).push(event);
  });

  const lanes = Array.from(laneMap.entries()).map(([lane, laneEvents]) => ({
    id: slugify(lane),
    label: lane,
    events: laneEvents.sort((a, b) => a.startWeek - b.startWeek),
  }));

  return { lanes, maxWeek };
};

export default function ProtocolTimeline({ data }) {
  const version = useMemo(() => {
    const versiones = Array.isArray(data.versiones) ? data.versiones : [];
    return versiones[0] || {};
  }, [data]);

  const context = useMemo(() => createTimelineContext(data, version), [data, version]);
  const phases = useMemo(() => buildPhaseSet(version, data, context), [version, data, context]);
  const timeline = useMemo(() => buildTimeline(phases), [phases]);
  const { lanes, maxWeek } = useMemo(() => buildLaneTracks(phases), [phases]);

  if (!timeline.length) {
    return (
      <div className="empty-state" role="status">
        <strong>No hay datos estructurados disponibles aún.</strong>
        <span>
          Añade bloques de evaluación, radioterapia o quimioterapia al JSON del protocolo para generar la línea de tiempo.
        </span>
      </div>
    );
  }

  return (
    <div className="timeline-wrapper">
      <section className="timeline-lanes" aria-label="Carriles terapéuticos">
        <h3 className="timeline-section__title">Mapa de carriles</h3>
        {lanes.length > 0 && (
          <div className="timeline-lanes__axis">
            {(() => {
              const effectiveMax = Math.max(maxWeek, 1);
              const marks = [0, effectiveMax / 2, effectiveMax];
              return marks.map((mark, idx) => (
                <span key={idx} style={{ left: `${(mark / effectiveMax) * 100}%` }}>
                  Semana {Math.round(mark)}
                </span>
              ));
            })()}
          </div>
        )}
        {lanes.map((lane) => {
          const effectiveMax = Math.max(maxWeek, 1);
          return (
            <div key={lane.id} className="timeline-lane">
              <div className="timeline-lane__label">{lane.label}</div>
              <div className="timeline-lane__track">
                {lane.events.map((event) => {
                  const startPercent = Math.min(
                    100,
                    Math.max(0, (event.startWeek / effectiveMax) * 100)
                  );
                  const rawWidth = ((event.endWeek - event.startWeek) / effectiveMax) * 100;
                  const widthPercent = Math.min(100 - startPercent, Math.max(rawWidth, 6));
                  const blockSlug = slugify(lane.label);
                  const blockClass = `timeline-block timeline-block--${blockSlug}`;
                  return (
                    <div
                      key={event.id}
                      className={blockClass}
                      style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                      title={`${event.phaseTitle}${event.title ? ` · ${event.title}` : ""}`}
                    >
                      <span className="timeline-block__title">
                        {event.title || event.phaseTitle}
                      </span>
                      {event.whenLabel && (
                        <span className="timeline-block__time">{event.whenLabel}</span>
                      )}
                      {event.spanLabel && (
                        <span className="timeline-block__span">{event.spanLabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="timeline-flow-wrapper" aria-label="Línea temporal clínica">
        <h3 className="timeline-section__title">Línea temporal</h3>
        <ul className="timeline-flow">
          {timeline.map((node) => (
            <li key={node.id} className="timeline-node">
              <div className="timeline-node__anchor">
                <span className="timeline-node__dot" />
                <span className="timeline-node__time">{formatWeekValue(node.week)}</span>
              </div>
              <div className="timeline-node__content">
                <div className="timeline-node__header">
                  <span className="timeline-node__phase">{node.phaseTitle}</span>
                  {node.phaseBadge && <span className="timeline-node__badge">{node.phaseBadge}</span>}
                </div>
                {node.title && <h4 className="timeline-node__title">{node.title}</h4>}
                {node.meta && <span className="timeline-node__meta">{node.meta}</span>}
                {node.whenLabel && <p className="timeline-node__when">{node.whenLabel}</p>}
                {node.span && <span className="timeline-node__span">{formatSpanRange(node.span)}</span>}
                {node.body && <p className="timeline-node__body">{node.body}</p>}
                {node.detalles?.length ? (
                  <ul className="timeline-node__list">
                    {node.detalles.map((detalle, idx) => (
                      <li key={idx}>{detalle}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="phase-summary" aria-label="Resumen por fase terapéutica">
        <h3 className="timeline-section__title">Desglose por fase</h3>
        <div className="timeline-grid">
          {phases.map((phase) => (
            <article key={phase.id || phase.title} className="timeline-phase">
              <header className="timeline-phase__header">
                <h4 className="timeline-phase__title">{phase.title}</h4>
                {phase.badge && <span className="timeline-phase__badge">{phase.badge}</span>}
              </header>
              {phase.note && <p className="timeline-phase__note">{phase.note}</p>}
              {phase.items?.length ? (
                <div className="timeline-items">
                  {phase.items.map((item) => (
                    <div key={`${phase.id || phase.title}-${item.order}`} className="timeline-item-card">
                      {item.meta && <span className="timeline-item-card__meta">{item.meta}</span>}
                      {item.title && <h5 className="timeline-item-card__title">{item.title}</h5>}
                      {item.whenLabel && <span className="timeline-item-card__when">{item.whenLabel}</span>}
                      {item.span && <span className="timeline-item-card__span">{formatSpanRange(item.span)}</span>}
                      {item.body && <p className="timeline-item-card__body">{item.body}</p>}
                      {item.detalles?.length ? (
                        <ul className="timeline-item-card__list">
                          {item.detalles.map((detalle, idx) => (
                            <li key={idx}>{detalle}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
