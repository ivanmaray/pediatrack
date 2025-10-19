"use client";
import React, { useMemo, useState } from "react";
import { requiresAudiometry, requiresGFR, protocolPlatinos, carboplatinConcomitantWeeks } from "../lib/protocolChecks";

// Vista rápida: barras por fases principales
export default function ProtocolQuickBars({ data, selectedStratId }) {
  const { phases, totalWeeks, marks } = useMemo(() => {
    const versiones = Array.isArray(data.versiones) ? data.versiones : [];
    const base = versiones[0] || {};
    const qtx = base.quimioterapia || {};
    const rt = base.radioterapia || {};
    const txp = base.trasplante || null;
    const inmuno = base.inmunoterapia || null;
    const evals = Array.isArray(base.evaluacion) ? base.evaluacion : [];

    const induccionInterval = Number(qtx.induccion_intervalo_semanas || 2);
    const induccion = Array.isArray(qtx.induccion) ? qtx.induccion : [];
    const mtto = base.mantenimiento || {};
    const stratGroup = selectedStratId && selectedStratId.toLowerCase().startsWith('lr') ? 'lr' : 'sr';
    const plannedOrden = qtx.planes && qtx.planes[stratGroup] && Array.isArray(qtx.planes[stratGroup].orden) ? qtx.planes[stratGroup].orden : null;
    const mttoOrden = plannedOrden || (Array.isArray(mtto.orden) ? mtto.orden : []);

    const resolve = (when) => {
      // Support arrays of when objects: return first resolvable
      if (Array.isArray(when)) {
          for (const w of when) {
              const r = resolve(w);
              if (r !== null && typeof r !== 'undefined') return r;
          }
          return 0;
      }
      if (!when) return 0;
      if (typeof when === 'number') return when;
      if (typeof when === 'object') {
        const off = Number(when.offset_weeks || 0);
        if (when.anchor === 'treatment_start') return off;
        if (when.anchor === 'absolute_week') return Number(when.week || 0) + off;
        if (when.anchor === 'induction_cycle_index') {
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(idx * induccionInterval)) + off;
        }
        if (when.anchor === 'rt_end') {
          const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
          const exact = opts.find(o => o.id === selectedStratId) || null;
          const opt = exact || (opts.find(o => (o.id || '').toLowerCase().includes(stratGroup)) || opts[0]);
          const rs = resolve(opt?.when) || 0;
          const span = Number(opt?.duracion_semanas || 2);
          return rs + span + off;
        }
        if (when.anchor === 'mtto_cycle_index') {
          const baseStart = qtx.inicio_relativo ? resolve(qtx.inicio_relativo) : resolve({ anchor: 'rt_end', offset_weeks: 0 });
          const mttoInterval = Number((qtx.planes && qtx.planes[stratGroup] && qtx.planes[stratGroup].intervalo_semanas) ?? qtx.mantenimiento_intervalo_semanas ?? 6);
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(baseStart + idx * mttoInterval)) + off;
        }
        return off;
      }
      return 0;
    };

  const bars = [];
    // Inducción
    if (induccion.length) {
      const start = resolve({ anchor: 'induction_cycle_index', cycle_index: 0 });
      const end = resolve({ anchor: 'induction_cycle_index', cycle_index: induccion.length - 1 }) + 1;
      bars.push({ id: 'induccion', label: 'Inducción', start, end, color: '#8a71f1' });
    }
    // Cirugía (si definida)
    if (base.cirugia) {
      const cstart = resolve(base.cirugia.when) || resolve({ anchor: 'induction_cycle_index', cycle_index: 7, offset_weeks: 1 });
      bars.push({ id: 'cirugia', label: 'Cirugía', start: cstart, end: cstart + 1, color: '#7a8592' });
    }
    // RT (por estrato si hay match)
    const pickRtOption = () => {
      const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
      if (!opts.length) return null;
      const exact = opts.find(o => o.id === selectedStratId);
      if (exact) return exact;
      const byGroup = opts.find(o => (o.id || '').toLowerCase().includes(stratGroup));
      return byGroup || opts[0];
    };
    const rtOpt = pickRtOption();
    if (rtOpt) {
      const rts = resolve(rtOpt.when);
      const rte = rts + Number(rtOpt.duracion_semanas || 2);
      const tip = `RT ${Number(rtOpt.duracion_semanas || 2)} sem` + (rtOpt.nota ? ` — ${rtOpt.nota}` : '');
      bars.push({ id: 'rt', label: 'Radioterapia', start: rts, end: rte, color: '#5078d9', tooltip: tip });
    }
    // Consolidación (span entre primera y última si hay varias)
    const consArr = Array.isArray(qtx.consolidacion) ? qtx.consolidacion : (qtx.consolidacion ? [qtx.consolidacion] : []);
    if (consArr.length) {
      const ws = consArr.map(c => resolve(c.when)).filter(n => Number.isFinite(n));
      if (ws.length) {
        const cs = Math.min(...ws);
        const ce = Math.max(...ws) + 1;
        bars.push({ id: 'consolidacion', label: 'Consolidación', start: cs, end: ce, color: '#815fe6', tooltip: 'Consolidación' });
      }
    }
    // Trasplante
    if (txp?.when) {
      const ts = resolve(txp.when);
      bars.push({ id: 'trasplante', label: 'Trasplante', start: ts, end: ts + 1, color: '#ea8567', tooltip: 'Trasplante' });
    }
    // Inmunoterapia (rango entre primer y último evento)
    const inmunoE = Array.isArray(inmuno?.eventos) ? inmuno.eventos : [];
    if (inmunoE.length) {
      const starts = inmunoE.map((e) => resolve(e.when));
      const minS = Math.min(...starts);
      const maxS = Math.max(...starts);
      bars.push({ id: 'inmuno', label: 'Inmunoterapia', start: minS, end: maxS + 2, color: '#3db18a', tooltip: 'Inmunoterapia' });
    }
    // Mantenimiento (PNET5 u otros con plan definido)
    if (mttoOrden.length) {
      const mttoStart = resolve(qtx.inicio_relativo || { anchor: 'rt_end', offset_weeks: 0 });
      const mttoInterval = Number((qtx.planes && qtx.planes[stratGroup] && qtx.planes[stratGroup].intervalo_semanas) ?? qtx.mantenimiento_intervalo_semanas ?? 6);
      const mttoEnd = mttoStart + mttoInterval * mttoOrden.length;
      const ciclosDef = mtto.ciclos || {};
      const tip = mttoOrden.map((letter, idx) => {
        const def = ciclosDef[letter] || {};
        const meds = Array.isArray(def.farmacos) ? def.farmacos.join(' · ') : '';
        return `Mto ${idx + 1} (${letter})${meds ? ` — ${meds}` : ''}`;
      }).join('\n');
      bars.push({ id: 'mantenimiento', label: 'Mantenimiento', start: mttoStart, end: mttoEnd, color: '#9a83f5', tooltip: tip });
    }

  const maxEnd = Math.max(12, ...bars.map(b => b.end));

    const marks = [];
    evals.forEach((ev, i) => {
      const w = resolve(ev.when);
      marks.push({ id: `ev-${i}`, title: ev.titulo || 'Evaluación', week: w });
    });

    // protocol-level checks
    const plat = protocolPlatinos(data);
    const needAudio = requiresAudiometry(data);
    const needGfr = requiresGFR(data);
    return { phases: bars, totalWeeks: maxEnd, marks, needAudio, needGfr, plat, carbWeeks: carboplatinConcomitantWeeks(data, selectedStratId) };
  }, [data, selectedStratId]);

  const pct = (weeks) => `${(weeks / totalWeeks) * 100}%`;
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, text: '' });
  const hideTip = () => setTip(t => ({ ...t, show: false }));
  const showTip = (e, text) => {
    if (!text) return;
    setTip({ show: true, x: e.clientX + 10, y: e.clientY + 10, text });
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ position: 'relative', paddingTop: 8 }}>
        {/* Marca de semanas */}
        <div style={{ position: 'relative', height: 18, borderBottom: '1px dashed #b3c1d9' }}>
          {[...Array(Math.ceil(totalWeeks)+1)].map((_, i) => (
            <span key={i} style={{ position: 'absolute', left: pct(i), transform: 'translateX(-50%)', fontSize: 11, color: '#4a5970' }}>S{i}</span>
          ))}
        </div>
        {/* Marks de evaluaciones */}
        {marks.map(m => (
          <div key={m.id} title={m.title} style={{ position: 'absolute', left: pct(m.week), top: 0, transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: 999, background: '#7b99eb', boxShadow: '0 0 0 3px rgba(123,153,235,.25)' }} />
        ))}
      </div>
      {/* Barras */}
      <div style={{ display: 'grid', gap: 8 }}>
        {phases.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#4a5970', textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.label}</div>
            <div style={{ position: 'relative', height: 18, background: '#eef3ff', border: '1px solid #d8e1f1', borderRadius: 999 }}>
              <div
                onMouseEnter={(e) => showTip(e, p.tooltip || p.label)}
                onMouseMove={(e) => showTip(e, p.tooltip || p.label)}
                onMouseLeave={hideTip}
                onClick={(e) => showTip(e, p.tooltip || p.label)}
                style={{ position: 'absolute', left: pct(p.start), width: pct(p.end - p.start), top: -1, bottom: -1, background: p.color, borderRadius: 999, boxShadow: '0 8px 18px rgba(0,0,0,.12)', cursor: 'pointer' }}
              />
              {/* Protocol-level badges: show audiometry/GFR badges on bars that include platinos */}
              {/* Removed GFR/Audi badges as requested — keep UI clean */}
              {/* Carboplatino badge on RT retained if needed */}
              {p.id === 'rt' && (plat.carboplatin) && (carbWeeks && carbWeeks.size) ? (
                <div style={{ position: 'absolute', left: pct(p.start), top: -18 }} title="Carboplatino concomitante durante RT">
                  <span style={{ background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 11 }}>Carboplatino</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {tip.show && (
        <div role="tooltip" style={{ position: 'fixed', left: tip.x, top: tip.y, background: '#0e1220', color: '#fff', padding: '6px 8px', borderRadius: 8, fontSize: 12, maxWidth: 480, boxShadow: '0 8px 18px rgba(0,0,0,.3)', zIndex: 50, pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
