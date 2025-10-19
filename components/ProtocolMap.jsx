// UNIVERSAL PROTOCOL MAP SYSTEM
"use client";
import { useMemo, useState, useEffect } from "react";
import React from "react";
import ReactFlow, { Background, Controls, MiniMap, Position } from "reactflow";
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import "reactflow/dist/style.css";

const CustomNode = ({ data, ...props }) => {
  // Tooltip nativo con el contenido o un tooltip provisto
  const title = data?.tooltip || (typeof data?.label === 'string' ? data.label.replace(/\n/g, ' ') : undefined);
  return (
    <div style={data.style} title={title}>
      {data.label}
    </div>
  );
};

/** Helpers **/
const mkLabel = (...lines) => lines.filter(Boolean).join("\n");
const baseStyle = (bg, wide = false) => ({
  background: bg,
  color: "white",
  borderRadius: 12,
  padding: 12,
  border: "1px solid rgba(255,255,255,.12)",
  whiteSpace: "pre-line",
  minWidth: wide ? 230 : 180,
  boxShadow: "0 10px 28px rgba(0,0,0,.35)",
  fontSize: 13,
  lineHeight: 1.25,
});
const toTitle = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const evalLabel = (ev) => mkLabel(
  ev.titulo || `Evaluación · ${toTitle(ev.momento)}`,
  ev.descripcion || "",
  ev.objetivo ? `Objetivo: ${ev.objetivo}` : "",
  ev.notas || ""
);

// ---- Timeline helpers (weeks → x) ----
const parseWeeksRange = (str) => {
  if (!str) return { start: 1, end: 6, span: 6 };
  const m = String(str).match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return { start: 1, end: 6, span: 6 };
  const s = parseInt(m[1], 10);
  const e = parseInt(m[2], 10);
  return { start: s, end: e, span: Math.max(1, e - s + 1) };
};
const buildMttoDurations = (version, base) => {
  const q = version.quimioterapia ?? base.quimioterapia ?? {};
  const dur = q?.mantenimiento?.duraciones || { A: 6, B: 3 };
  return { A: Number(dur.A || 6), B: Number(dur.B || 3) };
};
const buildMttoOrden = (version, base) => {
  const q = version.quimioterapia ?? base.quimioterapia;
  if (q && q.LR?.orden) return q.LR.orden;
  if (q && q.SR?.orden) return q.SR.orden;
  // fallback a legado
  if (version.mantenimiento?.orden) return version.mantenimiento.orden;
  if (base.mantenimiento?.orden) return base.mantenimiento.orden;
  return [];
};
// Corrige el cálculo para que el primer ciclo empiece en la semana de inicio y los siguientes sumen la duración correcta
const sumCyclesUntil = (orden, durations, indexIncl) => {
  if (indexIncl < 0) return 0;
  let sum = 0;
  for (let i = 0; i <= indexIncl && i < orden.length; i++) {
    sum += durations[orden[i]] || 0;
  }
  return sum;
};

// ---- Lane packing (avoid overlap on same lane) ----
// Compactar altura vertical entre lanes para ver más contenido sin scroll
const LANE_ROW_HEIGHT = 96;

/** Color por tipo genérico **/
const COLORS = {
  evaluacion: "#7b95b4",
  cirugia: "#4f5963",
  radioterapia: "#223e82",
  rt_sola: "#2b476f",
  rt_carbo: "#0f6a78",
  quimioterapia: "#6e48c7",
  q_induccion: "#5e3dbc",
  q_consolidacion: "#5534b0",
  q_mantenimiento: "#4b2ea3",
  q_reinduccion: "#432796",
  inmunoterapia: "#1a7b62",
  trasplante: "#b7542f",
  profilaxis: "#106f7c",
  soporte: "#7a6517",
  seguimiento: "#466d92",
  timeline: "#6b7ba6",
};

/** Modern theme & palette **/
const THEME = {
  appBg: "#f6f8fc",
  panelBg: "#ffffff",
  panelBorder: "#d8e1f1",
  text: "#0e1220",
  textMuted: "#4a5970",
  grid: "#e8eef9",
  gridStrong: "#d2dcf1",
};

const PALETTE = {
  evaluacion:      { grad: "linear-gradient(135deg, #a9c2ff, #7b99eb)", border: "#6d8be0" },
  imagen:          { grad: "linear-gradient(135deg, #9ee0ff, #6fc0f6)", border: "#5ab0ea" },
  cirugia:         { grad: "linear-gradient(135deg, #a3adb9, #7a8592)", border: "#8c97a6" },
  radioterapia:    { grad: "linear-gradient(135deg, #81b0ff, #5078d9)", border: "#5d86e0" },
  rt_sola:         { grad: "linear-gradient(135deg, #8ab3dd, #587eaf)", border: "#6790c2" },
  rt_carbo:        { grad: "linear-gradient(135deg, #73ded9, #3aaea9)", border: "#46c3bd" },
  quimioterapia:   { grad: "linear-gradient(135deg, #c2adff, #9a83f5)", border: "#ad97fb" },
  q_induccion:     { grad: "linear-gradient(135deg, #b9a2ff, #8a71f1)", border: "#9b83f6" },
  q_consolidacion: { grad: "linear-gradient(135deg, #b197ff, #815fe6)", border: "#9577f0" },
  q_mantenimiento: { grad: "linear-gradient(135deg, #a485ff, #6d4ee0)", border: "#8a6aef" },
  q_reinduccion:   { grad: "linear-gradient(135deg, #9874ff, #5a3bd6)", border: "#7755e7" },
  inmunoterapia:   { grad: "linear-gradient(135deg, #74dbba, #3db18a)", border: "#46be96" },
  trasplante:      { grad: "linear-gradient(135deg, #ffb6a3, #ea8567)", border: "#f2967a" },
  profilaxis:      { grad: "linear-gradient(135deg, #7ad7df, #3cb2be)", border: "#4cc6d0" },
  soporte:         { grad: "linear-gradient(135deg, #e1ca7a, #b7923f)", border: "#c6a452" },
  seguimiento:     { grad: "linear-gradient(135deg, #afc8ff, #809fe6)", border: "#90aef0" },
};

const styleFor = (kind, wide = false, pxRef = 40) => {
  const p = PALETTE[kind] || { grad: COLORS[kind] || "#34567e", border: "rgba(255,255,255,.18)" };
  const baseWidth = pxRef < 40 ? 160 : 180;
  const nodeWidth = wide ? baseWidth + 40 : baseWidth;
  
  return {
    background: p.grad,
    color: kind === "radioterapia" || kind === "rt_sola" || kind === "rt_carbo" || kind === "a" || kind === "b" ? "#fff" : THEME.text,
    borderRadius: 18,
    padding: "14px 14px 10px 14px",
    border: `1.5px solid ${p.border}`,
    whiteSpace: "pre-line",
    width: nodeWidth,
    boxShadow: "0 8px 32px rgba(43,106,214,0.10)",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: ".01em",
    transition: "transform .18s cubic-bezier(.4,2,.3,1), box-shadow .18s cubic-bezier(.4,2,.3,1)",
    cursor: kind === "q_mantenimiento" ? "pointer" : "default",
    backdropFilter: "blur(1.5px)",
    ...(kind === "timeline" ? {
      background: "transparent",
      color: THEME.textMuted,
      border: "none",
      boxShadow: "none",
      width: "auto",
      padding: 0,
      fontSize: 11
    } : {}),
  };
};

/**
 * ProtocolMap universal:
 * - Detecta fases por presencia en JSON y genera nodos/edges dinámicos
 * - Soporta: evaluacion[], cirugia, radioterapia (LR/SR con ramas), quimioterapia.{induccion,consolidacion,mantenimiento,reinduccion},
 *            inmunoterapia, trasplante, profilaxis, soporte, seguimiento
 * - Mantiene compatibilidad con el campo histórico "mantenimiento" (A/B) si existe.
 */
export default function ProtocolMap({ data, showHeader = true, showLegend = true, selectedStratId }) {
  const [pxPerWeek, setPxPerWeek] = useState(60);
  const [autoScale, setAutoScale] = useState(true);
  useEffect(() => {
    const onResize = () => setPxPerWeek(typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 60);
    if (autoScale) {
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [autoScale]);
  const [versionId, setVersionId] = useState(data.versiones[0].id);
  const mapRef = React.useRef(null);
  // Modos de RT para clarificar opciones
  const hasLR = !!((data.versiones?.[0]?.radioterapia?.LR) || (data.versiones?.find(Boolean)?.radioterapia?.LR));
  const hasSR = !!((data.versiones?.[0]?.radioterapia?.SR) || (data.versiones?.find(Boolean)?.radioterapia?.SR));
  // rtMode: "LR" | "SR_sola" | "SR_carbo" | "ALL"
  const defaultRtMode = hasSR ? "SR_sola" : "LR";
  const [rtMode, setRtMode] = useState(selectedStratId ? (selectedStratId === 'lr' ? 'LR' : selectedStratId === 'sr_rt_sola' ? 'SR_sola' : selectedStratId === 'sr_rt_carbo' ? 'SR_carbo' : defaultRtMode) : defaultRtMode);

  useEffect(() => {
    if (selectedStratId) {
      const newMode = selectedStratId === 'lr' ? 'LR' : selectedStratId === 'sr_rt_sola' ? 'SR_sola' : selectedStratId === 'sr_rt_carbo' ? 'SR_carbo' : defaultRtMode;
      setRtMode(newMode);
    }
  }, [selectedStratId, defaultRtMode]);
  const [detail, setDetail] = useState(null); // { title, subt, items[] }
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const base = data.versiones[0];
  const version = data.versiones.find((v) => v.id === versionId) ?? base;
  const strat = Array.isArray(version.estratificacion) ? version.estratificacion : [];

  /** Normalización de fuentes de datos (versión activa con fallback a base) */
  const rt = (version.radioterapia ?? base.radioterapia) || null;
  const rtOptions = Array.isArray(rt?.opciones) ? rt.opciones : [];
  const qx = (version.cirugia ?? base.cirugia) || null;
  const evals = (version.evaluacion ?? base.evaluacion) || null;
  const qtx = (version.quimioterapia ?? base.quimioterapia) || null;
  const induccionIntervalWeeks = Number(qtx?.induccion_intervalo_semanas || 2);
  const inmuno = (version.inmunoterapia ?? base.inmunoterapia) || null;
  const txp = (version.trasplante ?? base.trasplante) || null;
  const prof = (version.profilaxis ?? base.profilaxis) || null;
  const soporte = (version.soporte ?? base.soporte) || null;
  const seg = (version.seguimiento ?? base.seguimiento) || null;

  /** Compatibilidad con "mantenimiento" (A/B) legado */
  const legadoMtto = version.mantenimiento || base.mantenimiento || null;

  /**
   * Construcción de nodos: organizamos "carriles" (lanes) verticales por familia de fase.
   * El eje X avanza en el tiempo; cada nodo incrementa X. Subfases de quimioterapia se encadenan.
   */
  const { nodes, edges } = useMemo(() => {
    const nodes = [];
    const edges = [];
    let x = 60; // cursor horizontal
    // Timeline scale (weeks → pixels)
    const X0 = 60;           // left margin
    const weekToX = (w) => X0 + Math.max(0, w) * pxPerWeek;

    // Duraciones por grupo para cálculos globales
    const rtSpanLR = (() => {
      if (!rt?.LR) return 0;
      if (typeof rt.LR.duracion_semanas === "number") return rt.LR.duracion_semanas;
      if (rt.LR.semanas) return parseWeeksRange(rt.LR.semanas).span;
      return 6;
    })();
    const rtSpanSR = (() => {
      if (!rt?.SR) return 0;
      if (typeof rt.SR.duracion_semanas === "number") return rt.SR.duracion_semanas;
      if (rt.SR.semanas) return parseWeeksRange(rt.SR.semanas).span;
      return 6;
    })();
    const rtSpan = (() => {
      if (!rt) return 6;
      if (rtMode === "LR") return rtSpanLR || 6;
      if (rtMode === "SR_sola" || rtMode === "SR_carbo") return rtSpanSR || 6;
      // ALL → usar lo máximo para que mtto empiece tras el bloque más largo
      return Math.max(rtSpanLR || 0, rtSpanSR || 0) || 6;
    })();

    // RT start week (from RT.when). We expect anchors like treatment_start + offset.
    const rtStartWeek = (() => {
      if (!rt) return 0;
      // Preferir opciones declaradas en radioterapia.opciones
      const optId = rtMode === "LR" ? "lr" : (rtMode === "SR_sola" ? "sr_rt_sola" : (rtMode === "SR_carbo" ? "sr_rt_carbo" : null));
      const opt = optId ? rtOptions.find(o => o.id === optId) : null;
      const wOpt = opt?.when;
      const wLR = rt?.LR?.when;
      const wSR = rt?.SR?.when;
      const pick = wOpt || (rtMode === "LR" ? wLR : (rtMode === "SR_sola" || rtMode === "SR_carbo" ? wSR : (wSR || wLR)));
      const w = pick || { anchor: "treatment_start", offset_weeks: 0 };
      const off = Number(w.offset_weeks || 0);
      if (w.anchor === "treatment_start") return off;
      if (w.anchor === "absolute_week") return Number(w.week || 0) + off;
      return off;
    })();

    // Mantenimiento: orden y duraciones
    // Orden de mantenimiento según riesgo seleccionado si hay configuraciones diferenciadas
    const mttoOrden = (() => {
      const q = version.quimioterapia ?? base.quimioterapia;
      // Primero planes declarativos
      const planes = q?.planes || {};
      if (rtMode === "LR" && Array.isArray(planes.lr?.orden)) return planes.lr.orden;
      if ((rtMode === "SR_sola" || rtMode === "SR_carbo" || rtMode === "ALL") && Array.isArray(planes.sr?.orden)) return planes.sr.orden;
      // Fallback a LR/SR legado
      if (rtMode === "LR" && q?.LR?.orden) return q.LR.orden;
      if ((rtMode === "SR_sola" || rtMode === "SR_carbo" || rtMode === "ALL") && q?.SR?.orden) return q.SR.orden;
      if (q?.LR?.orden) return q.LR.orden;
      return buildMttoOrden(version, base);
    })();
    const mttoDur = buildMttoDurations(version, base);   // {A:6, B:3}

    // Inicio de mantenimiento (gap tras RT) si está definido
    const mttoStartOffset = (() => {
      const q = version.quimioterapia ?? base.quimioterapia;
      const rel = q?.inicio_relativo;
      if (rel?.anchor === "rt_end") return (rtStartWeek + rtSpan + Number(rel.offset_weeks || 0));
      return (rtStartWeek + rtSpan + 6); // fallback habitual PNET5
    })();

    // Tratamiento total en semanas (aprox): fin de mantenimiento
    const totalMttoWeeks = mttoOrden.reduce((acc, c) => acc + (mttoDur[c] || 0), 0);
    const treatmentEndWeek = mttoStartOffset + totalMttoWeeks;

    // Anchors resolver (when → absolute week)
    const resolveWhenWeek = (when) => {
      // Support when as an array of alternative anchors: pick first resolvable
      if (Array.isArray(when)) {
        for (const w of when) {
          const r = resolveWhenWeek(w);
          if (r !== null && typeof r !== 'undefined') return r;
        }
        return null;
      }
      if (!when || !when.anchor) return null;
      const off = Number(when.offset_weeks || 0);
      switch (when.anchor) {
        case "treatment_start":
          return 0 + off;
        case "rt_start":
          return rtStartWeek + off;
        case "rt_end":
          return rtStartWeek + rtSpan + off;
        case "mtto_start":
          return mttoStartOffset + off;
        case "induction_cycle_index": {
          const idx = Number(when.cycle_index || 0);
          // Colocar ciclos de inducción según índice y un intervalo medio declarado
          return Math.max(0, Math.round(idx * induccionIntervalWeeks)) + off;
        }
        case "mtto_cycle_index": {
          const idx = Number(when.cycle_index || 0);
          const w = mttoStartOffset + sumCyclesUntil(mttoOrden, mttoDur, idx);
          return w + off;
        }
        case "treatment_end":
          return treatmentEndWeek + off;
        case "absolute_week":
          return Number(when.week || 0) + off;
        default:
          return null;
      }
    };

    // Lane rows registry for collision-avoidance per lane
    const laneRows = {
      evaluacion: [], imagen: [], cirugia: [], radioterapia: [], quimioterapia: [],
      inmunoterapia: [], trasplante: [], profilaxis: [], soporte: [], seguimiento: []
    };
    const approxWidth = (wide) => (pxPerWeek < 40 ? (wide ? 220 : 180) : (wide ? 260 : 200));
    const placeInLane = (laneKey, posX, wide = false) => {
      const rows = laneRows[laneKey];
      const w = approxWidth(wide);
      let row = 0;
      while (true) {
        // Check overlap with items already in this row
        const conflict = rows.some((it) => it.row === row && !(posX + w < it.x || it.x + it.w < posX));
        if (!conflict) {
          rows.push({ x: posX, w, row });
          return Y[laneKey] + row * LANE_ROW_HEIGHT;
        }
        row += 1;
      }
    };

    const Y = {
      evaluacion: 60,
      imagen: 160,
      cirugia: 260,
      radioterapia: 360,
      quimioterapia: 500,
      inmunoterapia: 640,
      trasplante: 640,
      profilaxis: 640,
      soporte: 640,
      seguimiento: 760,
    };

    const pushNode = ({ id, yKey, label, kind, wide, posX, meta, duration }) => {
      const xTarget = posX != null ? posX : x;
      const yTarget = posX != null ? placeInLane(yKey, xTarget, !!wide) : Y[yKey];
      nodes.push({
        id,
        type: 'customNode',
        position: { x: xTarget, y: yTarget },
        data: { 
          label,
          style: styleFor(kind, !!wide, pxPerWeek, duration),
          kind, 
          lane: yKey, 
          ...(meta ? { meta } : {}) 
        },
        style: { padding: 0 },
      });
    };
    const link = (a, b, opt = {}) => {
      edges.push({
        id: `e-${a}-${b}`,
        source: a,
        target: b,
        type: opt.type || "smoothstep",
        animated: opt.animated ?? true,
      });
    };

    let lastId = null;

    /** Evaluación: clasificar por momento para posicionar correctamente */
    const _evals = Array.isArray(evals) ? evals : [];
    const evalInicial = _evals.filter((e) => String(e.momento || "").toLowerCase().includes("inicial"));
    const evalAntesMtto = _evals.filter((e) => String(e.momento || "").toLowerCase().includes("antes"));
    const evalIntermedia = _evals.filter((e) => String(e.momento || "").toLowerCase().includes("inter"));
    const evalFinal = _evals.filter((e) => String(e.momento || "").toLowerCase().includes("final"));

    // Renderizar SOLO las evaluaciones iniciales aquí (al principio de la línea temporal)
    if (evalInicial.length) {
      evalInicial.forEach((ev, i) => {
        const id = `eval-inicial-${i}`;
        const wk = resolveWhenWeek(ev.when);
        const posX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "evaluacion",
          kind: "evaluacion",
          label: evalLabel(ev),
          wide: true,
          posX
        });
        if (lastId) link(lastId, id);
        lastId = id;
        x = Math.max(x, posX) + 190;
      });
    }

    /** Imagen: eventos con pruebas por momento (usar when si existe) */
    const imagenEventos = version?.investigaciones?.imagen?.eventos ?? base?.investigaciones?.imagen?.eventos ?? [];
    if (Array.isArray(imagenEventos) && imagenEventos.length) {
      imagenEventos.forEach((evt, i) => {
        const id = `img-${i}`;
        const pruebas = Array.isArray(evt.pruebas)
          ? evt.pruebas.map((p) => {
              const t = [p.tipo, p.subtipo, p.region].filter(Boolean).join(" · ");
              return p.nota ? `${t} — ${p.nota}` : t;
            })
          : [];
        const label = mkLabel(`Imagen: ${String(evt.momento || i + 1).replace(/_/g, " ")}`, ...pruebas);
        const wk = resolveWhenWeek(evt.when);
        const posX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "imagen",
          kind: "imagen",
          label,
          wide: true,
          posX
        });
        if (lastId) link(lastId, id);
        lastId = id;
        x = Math.max(x, posX) + 190;
      });
    }

    /** Cirugía */
    if (qx) {
      const id = "cirugia-0";
      // La cirugía dura 1 semana aproximadamente
      pushNode({
        id,
        yKey: "cirugia",
        kind: "cirugia",
        label: mkLabel(`Semana de inicio: S0`, "Cirugía", qx.descripcion || "", qx.criterios || ""),
        posX: weekToX(0),
        duration: 1,
        meta: { type: 'cirugia', ...qx }
      });
      if (lastId) link(lastId, id);
      lastId = id;
    }

    /** Radioterapia (LR + SR con ramas) */
    let rtAnchorId = null;
    if (rt) {
      if ((rtMode === "LR" || rtMode === "ALL") && rt.LR) {
        const id = "rt-lr";
        const startW = rtStartWeek;
        const endW = startW + (rtSpanLR || 0);
        pushNode({
          id,
          yKey: "radioterapia",
          kind: "radioterapia",
          label: mkLabel(
            `Semana de inicio: S${startW}`,
            rtMode === "ALL" ? "◉ LR" : null,
            `RT LR${rt.LR.rama ? ` · ${rt.LR.rama}` : ""}`,
            `Semanas: S${startW}–S${endW}`,
            (rt.LR.nota || "").trim()
          ),
          posX: weekToX(rtStartWeek),
          duration: rtSpanLR,
          meta: { type: 'rt', riesgo: 'LR', semanas: { inicio: startW, fin: endW }, nota: rt.LR.nota || '' }
        });
        if (lastId) link(lastId, id);
        lastId = id;
      }
  if ((rtMode === "SR_sola" || rtMode === "ALL") && rt.SR) {
        const ramas = rt.SR?.ramas || [];
        const chosen = ramas.find(r => (r.id || "").includes("rt_sola")) || ramas[0];
        if (chosen) {
          const id = "rt-sr-sola";
          const startW = rtStartWeek;
          const endW = startW + (rtSpanSR || 0);
          pushNode({
            id,
            yKey: "radioterapia",
            kind: "rt_sola",
            label: mkLabel(
              `Semana de inicio: S${startW}`,
              rtMode === "ALL" ? "◉ SR" : null,
              `RT SR${chosen.label ? ` · ${chosen.label}` : ""}`.trim(),
              `Semanas: S${startW}–S${endW}`,
              (chosen.nota || rtOptions.find(o=>o.id==="sr_rt_sola")?.nota || "").trim()
            ),
            posX: weekToX(rtStartWeek),
            meta: { type: 'rt', riesgo: 'SR', rama: 'rt_sola', semanas: { inicio: startW, fin: endW }, nota: (chosen.nota || rtOptions.find(o=>o.id==="sr_rt_sola")?.nota || '') }
          });
          if (lastId) link(lastId, id);
          lastId = id;
        }
      }
  if ((rtMode === "SR_carbo" || rtMode === "ALL") && rt.SR) {
        const ramas = rt.SR?.ramas || [];
        const chosen = ramas.find(r => (r.id || "").includes("carbo"));
        if (chosen) {
          const id = "rt-sr-carbo";
          const startW = rtStartWeek;
          const endW = startW + (rtSpanSR || 0);
          pushNode({
            id,
            yKey: "radioterapia",
            kind: "rt_carbo",
            label: mkLabel(
              `Semana de inicio: S${startW}`,
              rtMode === "ALL" ? "◉ SR" : null,
              `RT SR${chosen.label ? ` · ${chosen.label}` : ""}`.trim(),
              `Semanas: S${startW}–S${endW}`,
              (chosen.nota || rtOptions.find(o=>o.id==="sr_rt_carbo")?.nota || "").trim()
            ),
            posX: weekToX(rtStartWeek),
            meta: { type: 'rt', riesgo: 'SR', rama: 'rt_carbo', semanas: { inicio: startW, fin: endW }, nota: (chosen.nota || rtOptions.find(o=>o.id==="sr_rt_carbo")?.nota || '') }
          });
          if (lastId) link(lastId, id);
          lastId = id;
        }
      }
      // Fallback: si no hay estructura LR/SR pero existen radioterapia.opciones simples
      if (!rt.LR && !rt.SR && Array.isArray(rtOptions) && rtOptions.length > 0) {
        rtOptions.forEach((opt, i) => {
          const id = `rt-opt-${i}`;
          const w = opt.when || { anchor: 'treatment_start', offset_weeks: 0 };
          const startW = resolveWhenWeek(w) ?? 0;
          const endW = startW + Number(opt.duracion_semanas || 2);
          pushNode({
            id,
            yKey: 'radioterapia',
            kind: 'radioterapia',
            label: mkLabel(
              `Semana de inicio: S${startW}`,
              opt.label || 'Radioterapia',
              `Semanas: S${startW}–S${endW}`,
              (opt.nota || '').trim()
            ),
            posX: weekToX(startW),
            duration: Number(opt.duracion_semanas || 2),
            meta: { type: 'rt', opcion: opt, semanas: { inicio: startW, fin: endW }, nota: opt.nota || '' }
          });
          if (lastId) link(lastId, id);
          lastId = id;
        });
      }
    }

    /** Evaluación: antes de mantenimiento (después de RT) */
    if (evalAntesMtto.length) {
      evalAntesMtto.forEach((ev, i) => {
        const id = `eval-antes-${i}`;
        const wk = resolveWhenWeek(ev.when);
        const posX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "evaluacion",
          kind: "evaluacion",
          label: evalLabel(ev),
          wide: true,
          posX
        });
        if (lastId) link(lastId, id);
        lastId = id;
        x = Math.max(x, posX) + 190;
      });
    }

    // 1) Ciclos individuales de inducción RAPID COJEC si existen
    if (qtx?.induccion && Array.isArray(qtx.induccion) && qtx.induccion.length > 0) {
      qtx.induccion.forEach((ciclo, idx) => {
        const id = `q-induccion-${idx}`;
        const wk = resolveWhenWeek(ciclo.when);
        const posX = wk != null ? weekToX(wk) : x;
        const label = mkLabel(
          ciclo.titulo || "RAPID COJEC",
          ciclo.descripcion || "",
          Array.isArray(ciclo.drogas) ? `Medicación:\n${ciclo.drogas.filter(d => d.nombre).map(d => `- ${d.nombre}: ${d.dosis}`).join('\n')}` : ""
        );
        pushNode({ id, yKey: "quimioterapia", kind: "q_induccion", label, wide: true, posX, meta: { type: 'induccion', ciclo } });
        if (idx === 0 && lastId) link(lastId, id); // Primer ciclo
        else if (idx > 0) link(`q-induccion-${idx - 1}`, id); // Entre ciclos consecutivos
        lastId = id;
        x = Math.max(x, posX) + 190;
      });
    } else if (qtx?.induccion) {
      // Fallback si no es array
      const wk = resolveWhenWeek({ anchor: "treatment_start", offset_weeks: 0 });
      const targetX = wk != null ? weekToX(wk) : x;
      const label = mkLabel(
        `Quimioterapia · Inducción`,
        qtx.induccion.duracion ? `Duración: ${qtx.induccion.duracion}` : "",
        Array.isArray(qtx.induccion.farmacos) ? `Fármacos: ${qtx.induccion.farmacos.join(", ")}` : ""
      );
      pushNode({ id: "q-induccion", yKey: "quimioterapia", kind: "q_induccion", label, wide: true, posX: targetX });
      if (lastId) link(lastId, "q-induccion");
      lastId = "q-induccion";
      x = Math.max(x, targetX) + 190;
    }

    // 2) Consolidación (en semana 16-17, antes del trasplante en semana 20)
    if (qtx?.consolidacion) {
      const id = `q-consolidacion`;
      const wk = resolveWhenWeek({ anchor: "induction_cycle_index", cycle_index: 7 });
      const targetX = wk != null ? weekToX(wk) : x;
      const label = Array.isArray(qtx.consolidacion) ?
        mkLabel(
          `Consolidación`,
          qtx.consolidacion[0]?.titulo || "",
          qtx.consolidacion[0]?.drogas?.filter(d => d.nombre).map(d => `- ${d.nombre}: ${d.dosis || ""}`).join('\n') || "",
          qtx.consolidacion[0]?.descripcion || ""
        ) :
        mkLabel(
          `Consolidación`,
          qtx.consolidacion.duracion ? `Duración: ${qtx.consolidacion.duracion}` : "",
          Array.isArray(qtx.consolidacion.farmacos) ? `Fármacos: ${qtx.consolidacion.farmacos.join(", ")}` : ""
        );
      const metaCons = Array.isArray(qtx.consolidacion) ? { type: 'consolidacion', evento: qtx.consolidacion[0] } : { type: 'consolidacion', evento: qtx.consolidacion };
      pushNode({ id, yKey: "quimioterapia", kind: "q_consolidacion", label, wide: true, posX: targetX, meta: metaCons });
      if (lastId) link(lastId, id);
      lastId = id;
      x = Math.max(x, targetX) + 190;
    }

    // 3) Mantenimiento si existe
    if (qtx?.mantenimiento) {
      const mttoStartWeeks = Array.isArray(mttoOrden) && mttoOrden.length ? mttoStartOffset : 26;
      const id = `q-mantenimiento`;
      const wk = resolveWhenWeek({ anchor: "treatment_start", offset_weeks: mttoStartWeeks });
      const targetX = wk != null ? weekToX(wk) : x;
      const label = mkLabel(
        `Mantenimiento`,
        qtx.mantenimiento.duracion ? `Duración: ${qtx.mantenimiento.duracion}` : "",
        Array.isArray(qtx.mantenimiento.farmacos) ? `Fármacos: ${qtx.mantenimiento.farmacos.join(", ")}` : ""
      );
      pushNode({ id, yKey: "quimioterapia", kind: "q_mantenimiento", label, wide: true, posX: targetX });
      if (lastId) link(lastId, id);
      lastId = id;
      x = Math.max(x, targetX) + 190;
    }

    // 4) Reinducción si existe
    if (qtx?.reinduccion) {
      const id = `q-reinduccion`;
      const label = mkLabel(
        `Reinducción/Rescate`,
        qtx.reinduccion.duracion ? `Duración: ${qtx.reinduccion.duracion}` : "",
        Array.isArray(qtx.reinduccion.farmacos) ? `Fármacos: ${qtx.reinduccion.farmacos.join(", ")}` : ""
      );
      pushNode({ id, yKey: "quimioterapia", kind: "q_reinduccion", label, wide: true });
      if (lastId) link(lastId, id);
      lastId = id;
      x += 190;
    }

    // 2) Línea temporal de mantenimiento A/B conectada en secuencia
    if (Array.isArray(mttoOrden) && mttoOrden.length) {
      const ord = mttoOrden;
      const ciclosDef = (version.mantenimiento?.ciclos || base.mantenimiento?.ciclos || {});
      for (let i = 0; i < ord.length; i++) {
        const c = ord[i];
        const isA = c === "A";
        const reg = isA ? ciclosDef?.A : ciclosDef?.B;
        const startWeek = mttoStartOffset + sumCyclesUntil(ord, mttoDur, i - 1);
        const duration = isA ? mttoDur.A : mttoDur.B;
        const posX = weekToX(startWeek);
        const endWeek = startWeek + duration;
        const id = `mtto-${i}`;
        const label = mkLabel(
          `Semana de inicio: S${startWeek}`,
          `Mantenimiento · Ciclo ${c}`,
          reg?.vcr || "",
          ...(Array.isArray(reg?.farmacos) ? reg.farmacos : [])
        );
        pushNode({
          id,
          yKey: "quimioterapia",
          kind: "q_mantenimiento",
          label,
          wide: true,
          posX,
          duration,
          meta: { ciclo: c, regimen: reg || {} }
        });
        // Conectar el primero al último id (RT o evaluación)
        if (i === 0 && lastId) link(lastId, id);
        // Entre ciclos consecutivos
        if (i > 0) {
          const prevId = `mtto-${i - 1}`;
          link(prevId, id);
        }
        lastId = id;
      }
    }

    // Trasplante justo después de quimioterapia
    if (txp) {
      const id = `txp-0`;
      const wk = resolveWhenWeek(txp.when);
      const targetX = wk != null ? weekToX(wk) : x;
      pushNode({
        id,
        yKey: "trasplante",
        kind: "trasplante",
        label: mkLabel(
          "Trasplante / Altas dosis",
          txp.descripcion || "",
          txp.via ? `Vía: ${txp.via}` : "",
          txp.condicionamiento ? `Acond.: ${Array.isArray(txp.condicionamiento) ? txp.condicionamiento.join(", ") : txp.condicionamiento}` : "",
          txp.detalles ? txp.detalles.join(", ") : ""
        ),
        meta: { type: 'trasplante', ...txp }
      });
      if (lastId) link(lastId, id);
      lastId = id;
      x = Math.max(x, targetX) + 190;
    }

    // Inmunoterapia: ciclos individuales conectados en secuencia
    if (inmuno?.eventos && Array.isArray(inmuno.eventos) && inmuno.eventos.length > 0) {
      inmuno.eventos.forEach((ciclo, idx) => {
        const id = `inmuno-${idx}`;
        const wk = resolveWhenWeek(ciclo.when);
        const targetX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "inmunoterapia",
          kind: "inmunoterapia",
          label: mkLabel(
            ciclo.titulo || "Inmunoterapia",
            ciclo.descripcion || ""
          ),
          wide: true,
          meta: { type: 'inmunoterapia', ciclo }
        });
        if (idx === 0 && lastId) link(lastId, id); // Conectar primer ciclo al trasplante
        else if (idx > 0) link(`inmuno-${idx - 1}`, id); // Entre ciclos consecutivos
        lastId = id;
        x = Math.max(x, targetX) + 190;
      });
    } else if (inmuno) {
      // Fallback si no tiene eventos
      const id = `inmuno-0`;
      pushNode({
        id,
        yKey: "inmunoterapia",
        kind: "inmunoterapia",
        label: mkLabel(
          "Inmunoterapia / Biológicos",
          inmuno.descripcion || "",
          inmuno.via ? `Vía: ${inmuno.via}` : "",
          Array.isArray(inmuno.farmacos) ? `Fármacos: ${inmuno.farmacos.join(", ")}` : "",
          Array.isArray(inmuno.antiinfecciosa) ? `Anti-infecciosa: ${inmuno.antiinfecciosa.join(", ")}` : ""
        ),
        meta: { type: 'inmunoterapia', ...inmuno }
      });
      if (lastId) link(lastId, id);
      lastId = id;
      x += 190;
    }

    // Luego los demás tratamientos
    const addSimple = (obj, key, title, kind, laneKey) => {
      if (!obj) return;
      const id = `${key}-0`;
      pushNode({
        id,
        yKey: laneKey,
        kind,
        label: mkLabel(
          title,
          obj.descripcion || "",
          obj.via ? `Vía: ${obj.via}` : "",
          Array.isArray(obj.farmacos) ? `Fármacos: ${obj.farmacos.join(", ")}` : "",
          Array.isArray(obj.antiinfecciosa) ? `Anti-infecciosa: ${obj.antiinfecciosa.join(", ")}` : "",
          obj.condicionamiento ? `Acond.: ${Array.isArray(obj.condicionamiento) ? obj.condicionamiento.join(", ") : obj.condicionamiento}` : ""
        ),
      });
      if (lastId) link(lastId, id);
      lastId = id;
      x += 190;
    };
    addSimple(prof, "profilaxis", "Profilaxis / Intratecal / Sistémica", "profilaxis", "profilaxis");
    addSimple(soporte, "soporte", "Soporte / Cuidados", "soporte", "soporte");

    // Seguimiento: fases individuales conectadas en secuencia
    if (seg?.eventos && Array.isArray(seg.eventos) && seg.eventos.length > 0) {
      seg.eventos.forEach((fase, idx) => {
        const id = `seguimiento-${idx}`;
        const wk = resolveWhenWeek(fase.when);
        const targetX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "seguimiento",
          kind: "seguimiento",
          label: mkLabel(
            fase.titulo || "Seguimiento",
            fase.descripcion || ""
          ),
          wide: true,
        });
        if (idx === 0 && lastId) link(lastId, id); // Conectar primer fase al último anterior
        else if (idx > 0) link(`seguimiento-${idx - 1}`, id); // Entre fases consecutivas
        lastId = id;
        x = Math.max(x, targetX) + 190;
      });
    } else if (seg) {
      // Fallback si no tiene eventos
      const id = `seguimiento-0`;
      pushNode({
        id,
        yKey: "seguimiento",
        kind: "seguimiento",
        label: mkLabel(
          "Seguimiento",
          seg.descripcion || "",
          seg.via ? `Vía: ${seg.via}` : "",
          Array.isArray(seg.farmacos) ? `Fármacos: ${seg.farmacos.join(", ")}` : "",
          Array.isArray(seg.antiinfecciosa) ? `Anti-infecciosa: ${seg.antiinfecciosa.join(", ")}` : ""
        ),
      });
      if (lastId) link(lastId, id);
      lastId = id;
      x += 190;
    }

    /** Evaluación final (al cierre del tratamiento) */
    if (evalFinal.length) {
      evalFinal.forEach((ev, i) => {
        const id = `eval-final-${i}`;
        const wk = resolveWhenWeek(ev.when);
        const posX = wk != null ? weekToX(wk) : x;
        pushNode({
          id,
          yKey: "evaluacion",
          kind: "evaluacion",
          label: evalLabel(ev),
          wide: true,
          posX
        });
        if (lastId) link(lastId, id);
        lastId = id;
        x = Math.max(x, posX) + 190;
      });
    }
    // Rehacer edges limpios: solo conectamos nodos del lane de quimioterapia (ciclos A/B en secuencia)
    edges.length = 0;
    const quimioNodes = nodes
      .filter(n => n.data?.lane === "quimioterapia")
      .sort((a, b) => a.position.x - b.position.x);

    for (let i = 1; i < quimioNodes.length; i++) {
      const a = quimioNodes[i - 1];
      const b = quimioNodes[i];
      edges.push({
        id: `e-q-${i - 1}-${i}`,
        source: a.id,
        target: b.id,
        type: "smoothstep",
        animated: false,
        style: {
          stroke: '#c9d6ee',
          strokeWidth: 2,
        },
        sourceHandle: null,
        targetHandle: null,
      });
    }


    return { nodes, edges };
  }, [versionId, rt, qx, evals, qtx, inmuno, txp, prof, soporte, seg, legadoMtto, pxPerWeek, rtMode]);

  // Deep link: focus node by query (?focus=node-id) on mount/update
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id = '';
    try {
      const url = new URL(window.location.href);
      id = url.searchParams.get('focus') || '';
    } catch {}
    if (!id) return;
    const node = nodes.find(n => n.id === id);
    if (node) {
      setViewport(v => ({ ...v, x: Math.max(0, node.position.x - 100), y: Math.max(0, node.position.y - 100), zoom: 1 }));
      // Simular click para abrir panel de detalle: buscamos el tipo y meta en data
      // Nota: ReactFlow no expone programático click fácil; dejamos el hash para compartir posición.
    }
  }, [nodes]);

  const handleExport = async () => {
    try {
      const node = mapRef.current;
      if (!node) return;
      const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: '#f6f8fc' });
      const link = document.createElement('a');
      link.download = `${(data?.id || 'mapa')}-${versionId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Exportación fallida', e);
      alert('No se pudo exportar la imagen.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const node = mapRef.current;
      if (!node) return;
      const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const imgWidth = 190; // mm (aprox A4 width minus margins)
      const imgHeight = img.height * (imgWidth / img.width);
      const pdf = new jsPDF({ orientation: imgWidth > imgHeight ? 'l' : 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let x = 10, y = 10, w = pageWidth - 20, h = img.height * (w / img.width);
      if (h <= pageHeight - 20) {
        pdf.addImage(dataUrl, 'PNG', x, y, w, h);
      } else {
        // Paginar si es más alto que una página
        let canvas = document.createElement('canvas');
        const scale = (img.width > 2000 ? 2000 / img.width : 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pageHpx = Math.floor((pageHeight - 20) * (canvas.width / (pageWidth - 20)));
        let offset = 0;
        while (offset < canvas.height) {
          const slice = ctx.getImageData(0, offset, canvas.width, Math.min(pageHpx, canvas.height - offset));
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = slice.height;
          sliceCanvas.getContext('2d').putImageData(slice, 0, 0);
          const sliceUrl = sliceCanvas.toDataURL('image/png');
          if (offset > 0) pdf.addPage();
          const sliceH_mm = (sliceCanvas.height / canvas.width) * (pageWidth - 20);
          pdf.addImage(sliceUrl, 'PNG', 10, 10, pageWidth - 20, sliceH_mm);
          offset += pageHpx;
        }
      }
      pdf.save(`${(data?.id || 'mapa')}-${versionId}.pdf`);
    } catch (e) {
      console.error('Exportación PDF fallida', e);
      alert('No se pudo exportar el PDF.');
    }
  };

  return (
  <div ref={mapRef} className="protocol-map" style={{ position: "relative", height: "calc(100vh - 160px)", minHeight: 560, width: "100%", background: "linear-gradient(135deg, #f6f8fc 80%, #eaf1ff 100%)", borderRadius: 24, padding: 18, border: `1.5px solid ${THEME.panelBorder}`, boxShadow: "0 8px 32px rgba(43,106,214,0.07)" }}>
      {showHeader && (
        <div className="protocol-map__header" style={{
          position: "relative",
          marginBottom: 6,
          padding: "16px 16px",
          borderRadius: 16,
          background: `linear-gradient(135deg, #eaf1ff, #f7f2ff)`,
          border: `1px solid ${THEME.panelBorder}`,
          boxShadow: "0 10px 30px rgba(0,0,0,.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: THEME.textMuted, fontSize: 12, letterSpacing: .2 }}>{data.area} · {data.grupo}</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 24, color: THEME.text }}>{data.titulo}</h1>
              <div style={{ color: THEME.textMuted, fontSize: 13 }}>Mapa terapéutico — <strong style={{ color: THEME.text }}>{version.nombre}</strong></div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 6 }}>Versión</label>
              <select
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
                style={{
                  background: THEME.panelBg,
                  color: THEME.text,
                  borderRadius: 10,
                  padding: "10px 12px",
                  border: `1px solid ${THEME.panelBorder}`,
                  minWidth: 180
                }}
              >
                {data.versiones.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
              {/* Escala del timeline */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 6 }}>Escala</span>
                <button onClick={() => setAutoScale(true)} style={{
                  border: `1px solid ${autoScale ? THEME.gridStrong : THEME.panelBorder}`,
                  background: autoScale ? "#eaf1ff" : THEME.panelBg,
                  color: THEME.text,
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: 'pointer'
                }}>Auto</button>
                <button onClick={() => { setAutoScale(false); setPxPerWeek(40); }} style={{
                  border: `1px solid ${!autoScale && pxPerWeek===40 ? THEME.gridStrong : THEME.panelBorder}`,
                  background: !autoScale && pxPerWeek===40 ? "#f7f2ff" : THEME.panelBg,
                  color: THEME.text,
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: 'pointer'
                }}>Compacto</button>
                <button onClick={() => { setAutoScale(false); setPxPerWeek(60); }} style={{
                  border: `1px solid ${!autoScale && pxPerWeek===60 ? THEME.gridStrong : THEME.panelBorder}`,
                  background: !autoScale && pxPerWeek===60 ? "#f7f2ff" : THEME.panelBg,
                  color: THEME.text,
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: 'pointer'
                }}>Medio</button>
                <button onClick={() => { setAutoScale(false); setPxPerWeek(80); }} style={{
                  border: `1px solid ${!autoScale && pxPerWeek===80 ? THEME.gridStrong : THEME.panelBorder}`,
                  background: !autoScale && pxPerWeek===80 ? "#f7f2ff" : THEME.panelBg,
                  color: THEME.text,
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: 'pointer'
                }}>Amplio</button>
              </div>
              {((strat && strat.length) || hasLR || hasSR) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 6 }}>RT</span>
                  {/* Render desde JSON declarativo si existe */}
                  {strat && strat.length ? (
                    <>
                      {strat.map(opt => (
                        <button key={opt.id} onClick={() => setRtMode(opt.id === 'lr' ? 'LR' : (opt.id === 'sr_rt_sola' ? 'SR_sola' : (opt.id === 'sr_rt_carbo' ? 'SR_carbo' : 'ALL')))} style={{
                          border: `1px solid ${((opt.id === 'lr' && rtMode==='LR') || (opt.id==='sr_rt_sola' && rtMode==='SR_sola') || (opt.id==='sr_rt_carbo' && rtMode==='SR_carbo')) ? THEME.gridStrong : THEME.panelBorder}`,
                          background: ((opt.id === 'lr' && rtMode==='LR') || (opt.id==='sr_rt_sola' && rtMode==='SR_sola') || (opt.id==='sr_rt_carbo' && rtMode==='SR_carbo')) ? "#eaf1ff" : THEME.panelBg,
                          color: THEME.text,
                          borderRadius: 10,
                          padding: "8px 12px",
                          cursor: "pointer"
                        }}>{opt.label}</button>
                      ))}
                      <button onClick={() => setRtMode('ALL')} style={{
                        border: `1px solid ${rtMode === 'ALL' ? THEME.gridStrong : THEME.panelBorder}`,
                        background: rtMode === 'ALL' ? "#f7f2ff" : THEME.panelBg,
                        color: THEME.text,
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}>Ver todas</button>
                    </>
                  ) : (
                    <>
                  {hasLR && (
                    <button onClick={() => setRtMode("LR")} style={{
                      border: `1px solid ${rtMode === "LR" ? THEME.gridStrong : THEME.panelBorder}`,
                      background: rtMode === "LR" ? "#eaf1ff" : THEME.panelBg,
                      color: THEME.text,
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer"
                    }}>LR</button>
                  )}
                  {hasSR && (
                    <>
                      <button onClick={() => setRtMode("SR_sola")} style={{
                        border: `1px solid ${rtMode === "SR_sola" ? THEME.gridStrong : THEME.panelBorder}`,
                        background: rtMode === "SR_sola" ? "#eaf1ff" : THEME.panelBg,
                        color: THEME.text,
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}>SR · RT sola</button>
                      <button onClick={() => setRtMode("SR_carbo")} style={{
                        border: `1px solid ${rtMode === "SR_carbo" ? THEME.gridStrong : THEME.panelBorder}`,
                        background: rtMode === "SR_carbo" ? "#eaf1ff" : THEME.panelBg,
                        color: THEME.text,
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}>SR · RT + Carbo</button>
                    </>
                  )}
                  {(hasLR || hasSR) && (
                    <button onClick={() => setRtMode("ALL")} style={{
                      border: `1px solid ${rtMode === "ALL" ? THEME.gridStrong : THEME.panelBorder}`,
                      background: rtMode === "ALL" ? "#f7f2ff" : THEME.panelBg,
                      color: THEME.text,
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer"
                    }}>Ver todas</button>
                  )}
                    </>
                  )}
                </div>
              )}
              </div>
              <button onClick={handleExport} title="Exportar PNG" style={{
                border: `1px solid ${THEME.panelBorder}`,
                background: THEME.panelBg,
                color: THEME.text,
                borderRadius: 10,
                padding: "8px 12px",
                cursor: 'pointer'
              }}>Exportar PNG</button>
              <button onClick={handleExportPDF} title="Exportar PDF" style={{
                border: `1px solid ${THEME.panelBorder}`,
                background: THEME.panelBg,
                color: THEME.text,
                borderRadius: 10,
                padding: "8px 12px",
                cursor: 'pointer'
              }}>Exportar PDF</button>
          </div>
        </div>
      )}

      {showLegend && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 4px 10px" }}>
          {[
            ["Evaluación", "evaluacion"],
            ["Imagen", "imagen"],
            ["RT", "radioterapia"],
            ["RT + Quimioterapia", "rt_carbo"],
            ["Quimioterapia", "quimioterapia"],
            ["Ciclo A/B", "q_mantenimiento"]
          ].map(([label, key]) => {
            const active = (
              (key === 'radioterapia' && (rtMode === 'LR' || rtMode === 'ALL')) ||
              (key === 'rt_carbo' && (rtMode === 'SR_carbo' || rtMode === 'ALL')) ||
              (key !== 'radioterapia' && key !== 'rt_carbo' ? true : false)
            );
            return (
              <span key={key} style={{
                background: active ? '#eef3ff' : THEME.panelBg,
                border: `1px solid ${active ? THEME.gridStrong : THEME.panelBorder}`,
                color: THEME.text,
                padding: "8px 12px",
                borderRadius: 12,
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 10
              }}>
                <i style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: 12,
                  background: (PALETTE[key]?.border) || COLORS[key] || "#34567e"
                }} />
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Ruler timeline (sticky, sync with viewport) */}
      <div style={{ position: "sticky", top: 8, zIndex: 15, margin: "0 0 6px" }}>
        <div style={{
          position: "relative",
          height: 26,
          background: THEME.panelBg,
          border: `1px solid ${THEME.panelBorder}`,
          borderRadius: 10,
          overflow: "hidden"
        }}>
          {(() => {
            const marks = [];
            const zoom = Number(viewport.zoom || 1);
            const tx = Number(viewport.x || 0);
            const worldX = (w) => 60 + w * pxPerWeek;
            const screenX = (w) => worldX(w) * zoom + tx;

            // Calculate RT span locally
            const rtSpanLocal = (() => {
              if (!rt) return 6;
              const rtSpanLR = (() => {
                if (!rt?.LR) return 0;
                if (typeof rt.LR.duracion_semanas === "number") return rt.LR.duracion_semanas;
                if (rt.LR.semanas) return parseWeeksRange(rt.LR.semanas).span;
                return 6;
              })();
              const rtSpanSR = (() => {
                if (!rt?.SR) return 0;
                if (typeof rt.SR.duracion_semanas === "number") return rt.SR.duracion_semanas;
                if (rt.SR.semanas) return parseWeeksRange(rt.SR.semanas).span;
                return 6;
              })();
              
              if (rtMode === "LR") return rtSpanLR || 6;
              if (rtMode === "SR_sola" || rtMode === "SR_carbo") return rtSpanSR || 6;
              return Math.max(rtSpanLR || 0, rtSpanSR || 0) || 6;
            })();

            // Get RT start week
            const startRT = (() => {
              if (!rt) return 0;
              const optId = rtMode === "LR" ? "lr" : (rtMode === "SR_sola" ? "sr_rt_sola" : (rtMode === "SR_carbo" ? "sr_rt_carbo" : null));
              const opt = optId ? rtOptions.find(o => o.id === optId) : null;
              const wOpt = opt?.when;
              const wLR = rt?.LR?.when;
              const wSR = rt?.SR?.when;
              const pick = wOpt || (rtMode === "LR" ? wLR : (rtMode === "SR_sola" || rtMode === "SR_carbo" ? wSR : (wSR || wLR)));
              const w = pick || { anchor: "treatment_start", offset_weeks: 0 };
              const off = Number(w.offset_weeks || 0);
              if (w.anchor === "treatment_start") return off;
              if (w.anchor === "absolute_week") return Number(w.week || 0) + off;
              return off;
            })();

            // Calculate maintenance start offset locally
            const mttoStartLocal = (() => {
              const q = version.quimioterapia ?? base.quimioterapia;
              const rel = q?.inicio_relativo;
              if (rel?.anchor === "rt_end") return (rtSpanLocal + Number(rel.offset_weeks || 0));
              return (rtSpanLocal + 6); // fallback habitual PNET5
            })();

            // Calculate maintenance order and durations
            const mttoLocal = (() => {
              const dur = buildMttoDurations(version, base);
              const orden = (() => {
                const q = version.quimioterapia ?? base.quimioterapia;
                // Primero planes declarativos
                const planes = q?.planes || {};
                if (rtMode === "LR" && Array.isArray(planes.lr?.orden)) return planes.lr.orden;
                if ((rtMode === "SR_sola" || rtMode === "SR_carbo" || rtMode === "ALL") && Array.isArray(planes.sr?.orden)) return planes.sr.orden;
                // Fallback a LR/SR legado
                if (rtMode === "LR" && q?.LR?.orden) return q.LR.orden;
                if ((rtMode === "SR_sola" || rtMode === "SR_carbo" || rtMode === "ALL") && q?.SR?.orden) return q.SR.orden;
                if (q?.LR?.orden) return q.LR.orden;
                return buildMttoOrden(version, base);
              })();
              return { orden, dur };
            })();

            // Calculate total treatment end week
            const treatmentEndLocal = (() => {
              const totalMttoWeeks = mttoLocal.orden.reduce((acc, c) => acc + (mttoLocal.dur[c] || 0), 0);
              return mttoStartLocal + totalMttoWeeks;
            })();

            // Local resolveWhenWeek implementation
            const resolveWhenWeekLocal = (when) => {
              if (!when || !when.anchor) return null;
              const off = Number(when.offset_weeks || 0);
              switch (when.anchor) {
                case "treatment_start":
                  return 0 + off;
                case "rt_start":
                  return startRT + off;
                case "rt_end":
                  return startRT + rtSpanLocal + off;
                case "mtto_start":
                  return mttoStartLocal + off;
                case "mtto_cycle_index": {
                  const idx = Number(when.cycle_index || 0);
                  const w = mttoStartLocal + sumCyclesUntil(mttoLocal.orden, mttoLocal.dur, idx);
                  return w + off;
                }
                case "treatment_end":
                  return treatmentEndLocal + off;
                case "absolute_week":
                  return Number(when.week || 0) + off;
                default:
                  return null;
              }
            };

            // Recolectar semanas importantes
            const importantWeeks = new Set([
              0, // Inicio
              startRT, // RT start
              startRT + rtSpanLocal, // RT end
              mttoStartLocal, // Inicio mantenimiento
            ]);

            // Añadir semanas de evaluación
            if (Array.isArray(evals)) {
              evals.forEach(ev => {
                const w = resolveWhenWeekLocal(ev.when);
                if (w != null) importantWeeks.add(w);
              });
            }

            // Añadir semanas de mantenimiento
            if (Array.isArray(mttoLocal.orden)) {
              let w = mttoStartLocal;
              mttoLocal.orden.forEach((c, i) => {
                importantWeeks.add(w);
                w += (c === 'A' ? mttoLocal.dur.A : mttoLocal.dur.B);
              });
              importantWeeks.add(w); // Semana final
            }

            // Baseline
            marks.push(
              <div key="ruler-baseline" style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1, background: THEME.gridStrong }} />
            );

            // Get all weeks in range
            const maxWeek = Math.max(...Array.from(importantWeeks));
            const allWeeks = Array.from({ length: maxWeek + 1 }, (_, i) => i);
            
            // Filter weeks to show (important weeks or every 4th week)
            const weeksToShow = allWeeks.filter(w => 
              importantWeeks.has(w) || w % 4 === 0
            );

            // Ordenar semanas y crear marcas
            weeksToShow.sort((a, b) => a - b).forEach(w => {
              const left = screenX(w);
              // Hacer las líneas más gruesas cuando el zoom es alto para mayor visibilidad
              const lineWidth = zoom > 2 ? Math.min(zoom * 0.5, 3) : 1;
              marks.push(
                <div key={`ruler-${w}`} style={{
                  position: "absolute",
                  left,
                  top: 6,
                  height: 14,
                  width: lineWidth,
                  background: THEME.gridStrong,
                  borderRadius: lineWidth > 1 ? `${lineWidth/2}px` : '0'
                }} />
              );
              marks.push(
                <div key={`ruler-label-${w}`} style={{
                  position: "absolute",
                  left: left + 4 + (lineWidth > 1 ? lineWidth : 0),
                  top: 16,
                  fontSize: 11,
                  color: THEME.textMuted,
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}>
                  {`S${w}`}
                </div>
              );
            });

            return marks;
          })()}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onMove={(_, vp) => setViewport(vp)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        snapToGrid={true}
        snapGrid={[20, 20]}
        nodeTypes={{ customNode: CustomNode }}
        defaultEdgeOptions={{
          style: { stroke: '#c9d6ee', strokeWidth: 2 },
          type: 'smoothstep',
          animated: false,
          sourceHandle: null,
          targetHandle: null,
        }}
        onNodeClick={(_, node) => {
          // Actualizar query param ?focus para deep link
          if (typeof window !== 'undefined' && node?.id) {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('focus', node.id);
              window.history.replaceState({}, '', url);
            } catch {}
          }
          const meta = node?.data?.meta || {};
          const kind = node?.data?.kind;
          if (kind === "q_mantenimiento") {
            const ciclo = meta?.ciclo || "?";
            const reg = meta?.regimen || {};
            const tox = reg.toxicidades || reg.toxicidades_tipicas || [];
            const items = Array.isArray(tox) ? tox : [];
            setDetail({
              title: `Toxicidades típicas — Ciclo ${ciclo}`,
              subt: Array.isArray(reg.farmacos) ? `Fármacos: ${reg.farmacos.join(" · ")}` : "",
              items: items.length ? items : ["Añade \"toxicidades\" en data.versiones[].mantenimiento.ciclos." + ciclo + ".toxicidades para mostrar aquí."]
            });
            return;
          }
          if (kind === 'q_induccion' && meta?.ciclo) {
            const c = meta.ciclo;
            const items = [];
            if (Array.isArray(c.drogas)) {
              items.push(...c.drogas.map(d => `${d.nombre}${d.dosis ? ` — ${d.dosis}` : ''}${Array.isArray(d.dias) ? ` (días ${d.dias.join(', ')})` : ''}`));
            }
            if (Array.isArray(c.toxicidades) && c.toxicidades.length) {
              items.push('— Toxicidades típicas —');
              items.push(...c.toxicidades);
            }
            setDetail({
              title: c.titulo || 'Ciclo de inducción',
              subt: c.descripcion || '',
              items: items.length ? items : ['Añade "drogas" con dosis y días para más detalle.']
            });
            return;
          }
          if (kind === 'q_consolidacion' && meta?.evento) {
            const e = meta.evento;
            const items = [];
            if (Array.isArray(e?.drogas)) items.push(...e.drogas.map(d => `${d.nombre}${d.dosis ? ` — ${d.dosis}` : ''}`));
            if (Array.isArray(e?.toxicidades) && e.toxicidades.length) {
              items.push('— Toxicidades típicas —');
              items.push(...e.toxicidades);
            }
            setDetail({
              title: e.titulo || 'Consolidación',
              subt: e.descripcion || '',
              items: items.length ? items : []
            });
            return;
          }
          if ((kind === 'radioterapia' || kind === 'rt_sola' || kind === 'rt_carbo') && meta) {
            const lines = [];
            if (meta.riesgo) lines.push(`Riesgo: ${meta.riesgo}${meta.rama ? ` · ${meta.rama}` : ''}`);
            if (meta.semanas) lines.push(`Semanas: S${meta.semanas.inicio}–S${meta.semanas.fin}`);
            if (meta.nota) lines.push(meta.nota);
            // Mostrar toxicidades si están definidas en opcion simple
            const tox = meta?.opcion?.toxicidades;
            if (Array.isArray(tox) && tox.length) {
              lines.push('— Toxicidades típicas —');
              lines.push(...tox);
            }
            setDetail({ title: 'Radioterapia', subt: '', items: lines });
            return;
          }
          if (kind === 'inmunoterapia' && meta) {
            const ciclo = meta.ciclo || meta;
            const items = [];
            if (Array.isArray(ciclo?.farmacos)) items.push(...ciclo.farmacos);
            if (Array.isArray(ciclo?.toxicidades) && ciclo.toxicidades.length) {
              items.push('— Toxicidades típicas —');
              items.push(...ciclo.toxicidades);
            }
            setDetail({ title: ciclo?.titulo || 'Inmunoterapia', subt: ciclo?.descripcion || '', items });
            return;
          }
          if (kind === 'trasplante' && meta) {
            const items = [];
            if (Array.isArray(meta.detalles)) items.push(...meta.detalles);
            setDetail({ title: 'Trasplante / Altas dosis', subt: meta.descripcion || '', items });
            return;
          }
          if (kind === 'cirugia' && meta) {
            setDetail({ title: 'Cirugía', subt: meta.descripcion || '', items: meta.criterios ? [meta.criterios] : [] });
            return;
          }
          setDetail(null);
        }}
      >
        <Background color={THEME.grid} gap={28} />
        <MiniMap
          nodeColor={(n) => {
            const k = n.data?.kind;
            return COLORS[k] || "#3b5aa8";
          }}
          pannable
          zoomable
        />
        <Controls position="top-right" showFitView />
      </ReactFlow>
      {detail && (
        <div style={{
          position: "absolute",
          right: 18,
          top: 18 + 56, // debajo del header
          width: 360,
          maxHeight: 520,
          overflow: "auto",
          background: THEME.panelBg,
          border: `1px solid ${THEME.panelBorder}`,
          borderRadius: 12,
          boxShadow: "0 10px 24px rgba(0,0,0,.15)",
          padding: 14
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ color: THEME.text }}>{detail.title}</strong>
            <button
              onClick={() => setDetail(null)}
              style={{ border: `1px solid ${THEME.panelBorder}`, background: THEME.panelBg, color: THEME.text, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}
            >Cerrar</button>
          </div>
          {detail.subt && <div style={{ color: THEME.textMuted, marginBottom: 8 }}>{detail.subt}</div>}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {detail.items.map((t, i) => (
              <li key={i} style={{ color: THEME.text, marginBottom: 6 }}>{t}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, fontSize: 12, color: THEME.textMuted }}>
            Consejo: puedes definir <code>toxicidades</code> por ciclo en <code>data.versiones[].mantenimiento.ciclos.A/B.toxicidades</code>.
          </div>
        </div>
      )}
    </div>
  );
}
