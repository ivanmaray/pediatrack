// UNIVERSAL PROTOCOL MAP SYSTEM
"use client";
import { useMemo, useState, useEffect } from "react";
import React from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

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
const sumCyclesUntil = (orden, durations, indexIncl) => {
  let sum = 0;
  for (let i = 0; i <= indexIncl && i < orden.length; i++) {
    const c = orden[i];
    sum += durations[c] || 0;
  }
  return sum;
};

// ---- Lane packing (avoid overlap on same lane) ----
const LANE_ROW_HEIGHT = 120;

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
  textMuted: "#55627a",
  grid: "#e6ecf7",
  gridStrong: "#c9d6ee",
};

const PALETTE = {
  evaluacion: { grad: "linear-gradient(135deg, #8fb3ff, #638cff)", border: "#547cf0" },
  imagen:     { grad: "linear-gradient(135deg, #89d2ff, #59b7f9)", border: "#4aa7ea" },
  cirugia:    { grad: "linear-gradient(135deg, #8e9aa7, #667180)", border: "#7b8797" },
  radioterapia:{grad: "linear-gradient(135deg, #6aa2ff, #3a6ed8)", border: "#4f7fe0" },
  rt_sola:    { grad: "linear-gradient(135deg, #7ca7d9, #4e77ad)", border: "#5a87bf" },
  rt_carbo:   { grad: "linear-gradient(135deg, #56d6d1, #2ca2a0)", border: "#35b9b6" },
  quimioterapia:{grad:"linear-gradient(135deg, #b491ff, #8b65f6)", border: "#a17cfb" },
  q_induccion:{ grad: "linear-gradient(135deg, #a387ff, #7c5df0)", border: "#8f70f5" },
  q_consolidacion:{grad:"linear-gradient(135deg, #9c7cff, #6f53e6)", border: "#8468f0" },
  q_mantenimiento:{grad:"linear-gradient(135deg, #8d6eff, #5c3fdc)", border: "#7b5aef" },
  q_reinduccion:{ grad: "linear-gradient(135deg, #7e5fff, #4d32d2)", border: "#6a4ae7" },
  inmunoterapia:{ grad: "linear-gradient(135deg, #5bd0a8, #2aa87e)", border: "#30b58a" },
  trasplante: { grad: "linear-gradient(135deg, #ff9b7e, #e46d47)", border: "#f08764" },
  profilaxis:  { grad: "linear-gradient(135deg, #64ccd6, #2aa6b2)", border: "#36b8c4" },
  soporte:     { grad: "linear-gradient(135deg, #d1b45f, #a9872b)", border: "#c19b43" },
  seguimiento: { grad: "linear-gradient(135deg, #9bc2ff, #6b95e6)", border: "#7da6f0" }
};

const styleFor = (kind, wide = false, pxRef = 40) => {
  const p = PALETTE[kind] || { grad: COLORS[kind] || "#34567e", border: "rgba(255,255,255,.18)" };
  return {
    background: p.grad,
    color: THEME.text,
    borderRadius: 14,
    padding: 12,
    border: `1px solid ${p.border}`,
    whiteSpace: "pre-line",
    minWidth: pxRef < 40 ? (wide ? 220 : 180) : (wide ? 260 : 200),
    boxShadow: "0 14px 24px rgba(0,0,0,.35)",
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.25,
    transition: "transform .15s ease, box-shadow .15s ease",
    cursor: kind === "q_mantenimiento" ? "pointer" : "default",
    ...(kind === "timeline" ? {
      background: "transparent",
      color: THEME.textMuted,
      border: "none",
      boxShadow: "none",
      minWidth: 1,
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
export default function ProtocolMap({ data, showHeader = true, showLegend = true }) {
  const [pxPerWeek, setPxPerWeek] = useState(40);
  useEffect(() => {
    const onResize = () => setPxPerWeek(typeof window !== 'undefined' && window.innerWidth < 768 ? 28 : 40);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [versionId, setVersionId] = useState(data.versiones[0].id);
  const [detail, setDetail] = useState(null); // { title, subt, items[] }
  const base = data.versiones[0];
  const version = data.versiones.find((v) => v.id === versionId) ?? base;

  /** Normalización de fuentes de datos (versión activa con fallback a base) */
  const rt = (version.radioterapia ?? base.radioterapia) || null;
  const qx = (version.cirugia ?? base.cirugia) || null;
  const evals = (version.evaluacion ?? base.evaluacion) || null;
  const qtx = (version.quimioterapia ?? base.quimioterapia) || null;
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

    // RT span (prefer duracion_semanas; fallback to parsed range; default 6)
    const rtSpan = (() => {
      const durSR = rt?.SR?.duracion_semanas;
      const durLR = rt?.LR?.duracion_semanas;
      if (typeof durSR === "number") return durSR;
      if (typeof durLR === "number") return durLR;
      if (rt?.SR?.semanas) return parseWeeksRange(rt.SR.semanas).span;
      if (rt?.LR?.semanas) return parseWeeksRange(rt.LR.semanas).span;
      return 6;
    })();

    // RT start week (from RT.when). We expect anchors like treatment_start + offset.
    const rtStartWeek = (() => {
      const w = rt?.SR?.when || rt?.LR?.when;
      if (!w) return 0;
      const off = Number(w.offset_weeks || 0);
      if (w.anchor === "treatment_start") return 0 + off;      // e.g., offset 4 → week 4
      if (w.anchor === "absolute_week") return Number(w.week || 0) + off;
      // Other anchors not expected here → fallback 0 + off
      return 0 + off;
    })();

    // Mantenimiento: orden y duraciones
    const mttoOrden = buildMttoOrden(version, base);     // e.g., ["A","B","A","B",...]
    const mttoDur = buildMttoDurations(version, base);   // {A:6, B:3}

    // Inicio de mantenimiento (gap tras RT) si está definido
    const mttoStartOffset = (() => {
      const q = version.quimioterapia ?? base.quimioterapia;
      const rel = q?.inicio_relativo;
      if (rel?.anchor === "rt_end") return (rtSpan + Number(rel.offset_weeks || 0));
      return (rtSpan + 6); // fallback habitual PNET5
    })();

    // Tratamiento total en semanas (aprox): fin de mantenimiento
    const totalMttoWeeks = mttoOrden.reduce((acc, c) => acc + (mttoDur[c] || 0), 0);
    const treatmentEndWeek = mttoStartOffset + totalMttoWeeks;

    // Anchors resolver (when → absolute week)
    const resolveWhenWeek = (when) => {
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

    const pushNode = ({ id, yKey, label, kind, wide, posX, meta }) => {
      const xTarget = posX != null ? posX : x;
      const yTarget = posX != null ? placeInLane(yKey, xTarget, !!wide) : Y[yKey];
      nodes.push({
        id,
        position: { x: xTarget, y: yTarget },
        data: { label, kind, lane: yKey, ...(meta ? { meta } : {}) },
        style: styleFor(kind, !!wide, pxPerWeek),
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
      pushNode({
        id,
        yKey: "cirugia",
        kind: "cirugia",
        label: mkLabel("Cirugía", qx.descripcion || "", qx.criterios || ""),
        posX: weekToX(0),
      });
      if (lastId) link(lastId, id);
      lastId = id;
      // x += 190; // eliminado: ya no se mueve x aquí
    }

    /** Radioterapia (LR + SR con ramas) */
    let rtAnchorId = null;
    if (rt) {
      // LR
      if (rt.LR) {
        const id = "rt-lr";
        pushNode({
          id,
          yKey: "radioterapia",
          kind: "radioterapia",
          label: mkLabel(
            `RT LR${rt.LR.rama ? ` · ${rt.LR.rama}` : ""}`,
            (rt.LR.nota || "").trim()
          ),
          posX: weekToX(rtStartWeek),
        });
        if (lastId) link(lastId, id);
        rtAnchorId = id;
        lastId = id;
        // x += 190; // eliminado: ya no se mueve x aquí
      }
      // SR ramas
      if (rt.SR) {
        const sr0 = rt.SR.ramas?.[0];
        if (sr0) {
          const id = "rt-sr-sola";
          pushNode({
            id,
            yKey: "radioterapia",
            kind: "rt_sola",
            label: mkLabel(`RT SR${sr0.label ? ` · ${sr0.label}` : ""}`.trim(), (sr0.nota || "").trim()),
            posX: weekToX(rtStartWeek),
          });
          if (rtAnchorId) link(rtAnchorId, id);
          else if (lastId) link(lastId, id);
          lastId = id;
          // x += 190; // eliminado: ya no se mueve x aquí
        }
        const sr1 = rt.SR.ramas?.[1];
        if (sr1) {
          const id = "rt-sr-carbo";
          pushNode({
            id,
            yKey: "radioterapia",
            kind: "rt_carbo",
            label: mkLabel(`RT SR · RT + Quimioterapia`, (sr1.nota || "").trim()),
            posX: weekToX(rtStartWeek),
          });
          // Conectar en paralelo desde el ancla LR o desde eval/cx si no hay LR
          if (rtAnchorId) link(rtAnchorId, id);
          else if (nodes.length) link(nodes[0].id, id, { animated: false });
        }
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

    /** Quimioterapia: subfases estándar */
    const addQSub = (sub, key, title, kind) => {
      if (!sub) return null;
      const id = `q-${key}`;
      const label = mkLabel(
        `Quimioterapia · ${title}`,
        sub.duracion ? `Duración: ${sub.duracion}` : "",
        sub.modalidad ? `Modalidad: ${sub.modalidad}` : "",
        Array.isArray(sub.farmacos) ? `Fármacos: ${sub.farmacos.join(", ")}` : "",
        Array.isArray(sub.ciclos) ? `Ciclos: ${sub.ciclos.map((c) => c.id || "").filter(Boolean).join(", ")}` : ""
      );
      pushNode({ id, yKey: "quimioterapia", kind, label, wide: true });
      if (lastId) link(lastId, id);
      lastId = id;
      x += 190;
      return id;
    };

    // 1) Subfases estructuradas si existen
    if (qtx) {
      addQSub(qtx.induccion, "induccion", "Inducción", "q_induccion");
      addQSub(qtx.consolidacion, "consolidacion", "Consolidación", "q_consolidacion");
      if (qtx.mantenimiento) {
        addQSub(qtx.mantenimiento, "mantenimiento", "Mantenimiento", "q_mantenimiento");
      }
      addQSub(qtx.reinduccion, "reinduccion", "Reinducción/Rescate", "q_reinduccion");
    }

    // 2) Ciclos legado A/B: SIEMPRE que existan (independiente de quimioterapia.mantenimiento)
    if (legadoMtto && Array.isArray(legadoMtto.orden) && legadoMtto.orden.length) {
      const ord = legadoMtto.orden || [];
      ord.forEach((c, i) => {
        const isA = c === "A";
        const reg = isA ? legadoMtto.ciclos?.A : legadoMtto.ciclos?.B;
        // Calcular inicio del ciclo por semanas reales
        const startWeek = mttoStartOffset + sumCyclesUntil(ord, mttoDur, i - 1);
        const posX = weekToX(startWeek);
        const id = `mtto-${i}`;
        pushNode({
          id,
          yKey: "quimioterapia",
          kind: "q_mantenimiento",
          label: mkLabel(
            `Mantenimiento · Ciclo ${c}`,
            reg?.vcr || "",
            ...(Array.isArray(reg?.farmacos) ? reg.farmacos : [])
          ),
          wide: true,
          posX,
          // meta para onClick
          meta: { ciclo: c, regimen: reg || {} }
        });
        if (lastId) link(lastId, id);
        lastId = id;
        // Evaluaciones intermedias: si traen when, respetar su posición exacta
        if (evalIntermedia.length) {
          const pending = [...evalIntermedia];
          for (let k = 0; k < pending.length; k++) {
            const evInt = pending[k];
            const wk = resolveWhenWeek(evInt.when);
            if (wk != null) {
              const posXEval = weekToX(wk);
              pushNode({
                id: `eval-intermedia-${k}`,
                yKey: "evaluacion",
                kind: "evaluacion",
                label: evalLabel(evInt),
                wide: true,
                posX: posXEval
              });
              if (lastId) link(lastId, `eval-intermedia-${k}`);
              lastId = `eval-intermedia-${k}`;
              x = Math.max(x, posXEval) + 190;
            }
          }
          // Limpiar para no duplicar
          evalIntermedia.length = 0;
        }
        // x += 190; // eliminado: ya no se mueve x aquí
      });
    }

    /** Inmunoterapia, Trasplante, Profilaxis, Soporte, Seguimiento */
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
    addSimple(inmuno, "inmuno", "Inmunoterapia / Biológicos", "inmunoterapia", "inmunoterapia");
    addSimple(txp, "txp", "Trasplante / Altas dosis", "trasplante", "trasplante");
    addSimple(prof, "profilaxis", "Profilaxis / Intratecal / Sistémica", "profilaxis", "profilaxis");
    addSimple(soporte, "soporte", "Soporte / Cuidados", "soporte", "soporte");
    addSimple(seg, "seguimiento", "Seguimiento", "seguimiento", "seguimiento");

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
        type: "default",
        animated: false,
      });
    }


    return { nodes, edges };
  }, [versionId, rt, qx, evals, qtx, inmuno, txp, prof, soporte, seg, legadoMtto, pxPerWeek]);

  return (
    <div style={{ position: "relative", height: "calc(100vh - 160px)", minHeight: 560, width: "100%", background: THEME.appBg, borderRadius: 16, padding: 10, border: `1px solid ${THEME.panelBorder}` }}>
      {showHeader && (
        <div style={{
          position: "relative",
          marginBottom: 6,
          padding: "16px 16px",
          borderRadius: 16,
          background: `linear-gradient(135deg, #eaf1ff, #f7f2ff)`,
          border: `1px solid ${THEME.panelBorder}`,
          boxShadow: "0 10px 30px rgba(0,0,0,.06)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
            <div>
              <div style={{ color: THEME.textMuted, fontSize: 12, letterSpacing: .2 }}>{data.area} · {data.grupo}</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 24, color: THEME.text }}>{data.titulo}</h1>
              <div style={{ color: THEME.textMuted, fontSize: 13 }}>Mapa terapéutico — <strong style={{ color: THEME.text }}>{version.nombre}</strong></div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
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
            </div>
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
          ].map(([label, key]) => (
            <span key={key} style={{
              background: THEME.panelBg,
              border: `1px solid ${THEME.panelBorder}`,
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
          ))}
        </div>
      )}

      {/* Ruler timeline (single line) */}
      <div style={{
        position: "relative",
        height: 26,
        margin: "0 0 6px",
        background: THEME.panelBg,
        border: `1px solid ${THEME.panelBorder}`,
        borderRadius: 10,
        overflow: "hidden"
      }}>
        {(() => {
          const marks = [];
          const totalWeeks = Math.max(12, Math.ceil((() => {
            // same calc as inside useMemo: rtStartWeek + rtSpan + mttoStartOffset & durations
            const q = version.quimioterapia ?? base.quimioterapia;
            const rel = q?.inicio_relativo;
            const rtDur = (() => {
              const durSR = rt?.SR?.duracion_semanas; const durLR = rt?.LR?.duracion_semanas;
              if (typeof durSR === "number") return durSR;
              if (typeof durLR === "number") return durLR;
              if (rt?.SR?.semanas) return parseWeeksRange(rt.SR.semanas).span;
              if (rt?.LR?.semanas) return parseWeeksRange(rt.LR.semanas).span;
              return 6;
            })();
            const rtStart = (() => {
              const w = rt?.SR?.when || rt?.LR?.when; if (!w) return 0; const off = Number(w.offset_weeks || 0);
              if (w.anchor === "treatment_start") return off; if (w.anchor === "absolute_week") return Number(w.week||0)+off; return off;
            })();
            const mttoOrdenLocal = buildMttoOrden(version, base);
            const mttoDurLocal = buildMttoDurations(version, base);
            const mttoStartOff = (rel?.anchor === "rt_end") ? (rtDur + Number(rel.offset_weeks||0)) : (rtDur + 6);
            const totalMtto = mttoOrdenLocal.reduce((acc,c)=> acc + (mttoDurLocal[c]||0), 0);
            return rtStart + mttoStartOff + totalMtto; })()) + 2);
          const X0 = 60;
          // Baseline horizontal
          marks.push(
            <div key="ruler-baseline" style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1, background: THEME.gridStrong }} />
          );
          for (let w = 0; w <= totalWeeks; w++) {
            const left = X0 + w * pxPerWeek;
            const major = true; // label every week per your request
            // Tick
            marks.push(
              <div key={`ruler-${w}`} style={{ position: "absolute", left, top: 6, height: 14, width: 1, background: THEME.gridStrong }} />
            );
            // Label under the baseline
            marks.push(
              <div key={`ruler-label-${w}`} style={{ position: "absolute", left: left + 4, top: 16, fontSize: 11, color: THEME.textMuted }}>
                {`S${w}`}
              </div>
            );
          }
          return marks;
        })()}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        onNodeClick={(_, node) => {
          if (node?.data?.kind === "q_mantenimiento") {
            const ciclo = node.data?.meta?.ciclo || "?";
            const reg = node.data?.meta?.regimen || {};
            const tox = reg.toxicidades || reg.toxicidades_tipicas || [];
            const items = Array.isArray(tox) ? tox : [];
            setDetail({
              title: `Toxicidades típicas — Ciclo ${ciclo}`,
              subt: Array.isArray(reg.farmacos) ? `Fármacos: ${reg.farmacos.join(" · ")}` : "",
              items: items.length ? items : ["Añade \"toxicidades\" en data.versiones[].mantenimiento.ciclos." + ciclo + ".toxicidades para mostrar aquí."]
            });
          } else {
            setDetail(null);
          }
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