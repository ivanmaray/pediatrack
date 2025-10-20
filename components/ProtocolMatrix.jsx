"use client";
import React, { useMemo, useState } from "react";
import { protocolPlatinos } from "../lib/protocolChecks";

export default function ProtocolMatrix({ data, selectedStratId }) {
  // RT helpers and local state are defined inside the component
  const { rows, totalWeeks, laneDetails } = useMemo(() => {
    const versiones = Array.isArray(data.versiones) ? data.versiones : [];
    const base = versiones[0] || {};
    const qtx = base.quimioterapia || {};
    const rt = base.radioterapia || {};
  const evals = Array.isArray(base.evaluacion) ? base.evaluacion : [];
    const inmuno = base.inmunoterapia || {};
    const txp = base.trasplante || {};
    const soporte = base.soporte || {};
    const prof = base.profilaxis || {};
    const seg = base.seguimiento || {};
    const induccionInterval = Number(qtx.induccion_intervalo_semanas || 2);
    // Helper to filter items by selected stratification
    const matchesStrat = (obj) => {
      const sel = (selectedStratId || '').toLowerCase();
      if (!obj || typeof obj !== 'object') return true;
      const only = (obj.only_strats || obj.estratos || obj.strats);
      if (Array.isArray(only) && only.length) {
        return only.map(String).map(s=>s.toLowerCase()).includes(sel);
      }
      const exclude = obj.exclude_strats;
      if (Array.isArray(exclude) && exclude.length) {
        return !exclude.map(String).map(s=>s.toLowerCase()).includes(sel);
      }
      return true;
    };
    const induccion = (Array.isArray(qtx.induccion) ? qtx.induccion : []).filter(matchesStrat);
    const consArr = (Array.isArray(qtx.consolidacion) ? qtx.consolidacion : (qtx.consolidacion ? [qtx.consolidacion] : [])).filter(matchesStrat);
    const mtto = base.mantenimiento || {};
    const pickStratKey = () => {
      const planes = qtx.planes || {};
      const keys = Object.keys(planes).map(k => k.toLowerCase());
      const sel = (selectedStratId || '').toLowerCase();
      if (sel && keys.includes(sel)) return sel;
      if (sel.startsWith('lr') && keys.includes('lr')) return 'lr';
      if (sel.startsWith('sr') && keys.includes('sr')) return 'sr';
      if (keys.includes('sr')) return 'sr';
      return keys[0] || '';
    };
    const stratKey = pickStratKey();
    const stratGroup = (() => {
      const sel = (selectedStratId || '').toLowerCase();
      if (sel.startsWith('lr')) return 'lr';
      if (sel.startsWith('sr')) return 'sr';
      if (sel.startsWith('ir')) return 'ir';
      if (sel.startsWith('ar')) return 'ar';
      if (sel.startsWith('t')) return 't';
      return sel || '';
    })();
    const plannedOrden = qtx.planes && stratKey && qtx.planes[stratKey] && Array.isArray(qtx.planes[stratKey].orden) ? qtx.planes[stratKey].orden : null;
    const mttoOrden = plannedOrden || (Array.isArray(mtto.orden) ? mtto.orden : []);

    const resolve = (when) => {
      if (!when) return 0;
      if (typeof when === 'number') return when;
      if (typeof when === 'object') {
        // Support arrays of when: try alternatives
        if (Array.isArray(when)) {
          for (const w of when) {
            const r = resolve(w);
            if (r !== null && typeof r !== 'undefined') return r;
          }
          return 0;
        }
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
          if (opt) {
            const start = resolve(opt.when);
            const dur = Number(opt.duracion_semanas || 0);
            return Math.max(0, Math.round(start + dur)) + off;
          }
          return off;
        }
        if (when.anchor === 'mtto_cycle_index') {
          const baseStart = qtx.inicio_relativo ? resolve(qtx.inicio_relativo) : resolve({ anchor: 'rt_end', offset_weeks: 0 });
          const mttoInterval = Number((qtx.planes && stratKey && qtx.planes[stratKey] && qtx.planes[stratKey].intervalo_semanas) ?? qtx.mantenimiento_intervalo_semanas ?? 6);
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(baseStart + idx * mttoInterval)) + off;
        }
        return off;
      }
      return 0;
    };

    const maxWeeks = [];

    const gridRow = (label, color, weeksMarked) => ({ label, color, weeksMarked });

    // Quimioterapia (inducción por ciclos)
    const chemoWeeks = new Map(); // week -> tooltip
    induccion.forEach((c) => {
      const w = Math.round(resolve(c.when));
      const tip = Array.isArray(c.drogas) ? c.drogas.filter(d => d.nombre).map(d => `${d.nombre}${d.dosis ? ` — ${d.dosis}` : ''}`).join('\n') : (c.descripcion || '');
      chemoWeeks.set(w, tip);
      maxWeeks.push(w + 1);
    });
    // Quimioterapia (mantenimiento PNET5)
    if (mttoOrden.length) {
      mttoOrden.forEach((letter, idx) => {
        const w = Math.round(resolve({ anchor: 'mtto_cycle_index', cycle_index: idx }));
        const def = (mtto.ciclos && mtto.ciclos[letter]) || {};
        const tip = Array.isArray(def.farmacos) ? `Mto ${idx + 1} (${letter})\n` + def.farmacos.join('\n') : `Mto ${idx + 1} (${letter})`;
        chemoWeeks.set(w, tip);
        maxWeeks.push(w + 1);
      });
    }

    // RT
    const rtWeeks = new Map(); // week -> label
    const pickRt = () => {
      const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
      if (!opts.length) return null;
      const exact = opts.find(o => o.id === selectedStratId);
      if (exact) return exact;
      const byGroup = opts.find(o => (o.id || '').toLowerCase().includes(stratGroup));
      return byGroup || opts[0];
    };
    const opt = pickRt();
    if (opt) {
      const s = resolve(opt.when);
      const d = Number(opt.duracion_semanas || 2);
      for (let i = 0; i < d; i++) {
        const wk = Math.round(s + i);
        rtWeeks.set(wk, i === 0 ? `RT (${d} sem)` : '');
        // Si la opción es RT + Carboplatino, marcar la quimioterapia concomitante en la fila de quimio
        if ((opt.id || '').toLowerCase().includes('carbo')) {
          const nota = typeof opt.nota === 'string' ? opt.nota : 'Carboplatino 35 mg/m² 5d/sem (concomitante)';
          const tip = (chemoWeeks.get(wk) ? chemoWeeks.get(wk) + '\n' : '') + (nota.startsWith('RT +') ? 'Carboplatino 35 mg/m² 5d/sem (concomitante)' : nota);
          chemoWeeks.set(wk, tip);
        }
      }
      maxWeeks.push(s + d);
    }

    // Cirugía
    const surgWeeks = new Set();
    if (base.cirugia?.when) {
      const s = resolve(base.cirugia.when);
      surgWeeks.add(Math.round(s));
      maxWeeks.push(s + 1);
    }

    // Inmunoterapia
    const inmWeeks = new Set();
    const imm = (Array.isArray(inmuno.eventos) ? inmuno.eventos : []).filter(matchesStrat);
    imm.forEach(e => { const w = resolve(e.when); inmWeeks.add(Math.round(w)); maxWeeks.push(w + 1); });

    // Evaluaciones
  const evalWeeks = new Set();
  evals.filter(matchesStrat).forEach(ev => { const w = resolve(ev.when); evalWeeks.add(Math.round(w)); maxWeeks.push(w + 0.5); });

    const totalWeeks = Math.max(12, ...maxWeeks, induccion.length * induccionInterval + 2);

    // Build laneDetails so we can show expanded info on hover/click
    const laneDetails = {};
    laneDetails['Quimioterapia'] = {
      items: [],
      note: qtx?.descripcion || qtx?.nota || null,
    };
    // induction items
    induccion.forEach((c, idx) => {
      const w = Math.round(resolve(c.when));
      laneDetails['Quimioterapia'].items.push({
        week: w,
        title: c.titulo || `Inducción ${idx + 1}`,
        details: Array.isArray(c.drogas) ? c.drogas.map(d => `${d.nombre || ''}${d.dosis ? ` · ${d.dosis}` : ''}`.trim()) : [],
        body: c.descripcion || c.resumen || null,
      });
    });
    // maintenance cycles
    if (mttoOrden.length) {
      mttoOrden.forEach((letter, idx) => {
        const w = Math.round(resolve({ anchor: 'mtto_cycle_index', cycle_index: idx }));
        const def = (mtto.ciclos && mtto.ciclos[letter]) || {};
        laneDetails['Quimioterapia'].items.push({
          week: w,
          title: `Mantenimiento ${idx + 1} (${letter})`,
          details: Array.isArray(def.farmacos) ? def.farmacos : (Array.isArray(def.drogas) ? def.drogas : []),
          body: def.descripcion || def.resumen || null,
        });
      });
    }

    laneDetails['Radioterapia'] = { items: [], note: rt?.nota || null };
    // RT options
    const rtOpts = Array.isArray(rt.opciones) ? rt.opciones : [];
    rtOpts.forEach((o) => {
      const s = resolve(o.when);
      const d = Number(o.duracion_semanas || o.duracion || 0);
      laneDetails['Radioterapia'].items.push({ week: Math.round(s), title: o.label || o.id || 'Radioterapia', body: o.nota || o.descripcion || null, span: d });
    });

    laneDetails['Cirugía'] = { items: [], note: base.cirugia?.descripcion || null };
    if (base.cirugia) {
      const s = resolve(base.cirugia.when);
      laneDetails['Cirugía'].items.push({ week: Math.round(s), title: base.cirugia.procedimiento || 'Procedimiento', body: base.cirugia.notas || base.cirugia.descripcion || null });
    }

    laneDetails['Inmunoterapia'] = { items: [], note: inmuno?.descripcion || inmuno?.nota || null };
    imm.forEach((e, i) => {
      const w = Math.round(resolve(e.when));
      laneDetails['Inmunoterapia'].items.push({ week: w, title: e.titulo || e.nombre || `Inmuno ${i+1}`, body: e.descripcion || e.detalle || null, cond: e.cond || null });
    });

    laneDetails['Evaluaciones'] = { items: [], note: null };
    evals.filter(matchesStrat).forEach((ev, i) => {
      const w = Math.round(resolve(ev.when));
      laneDetails['Evaluaciones'].items.push({ week: w, title: ev.titulo || ev.momento || `Evaluación ${i+1}`, body: ev.descripcion || ev.objetivo || null });
    });

    laneDetails['Trasplante'] = { items: [], note: txp?.descripcion || null };
    if (txp) {
      const eventos = (Array.isArray(txp.eventos) ? txp.eventos : (Array.isArray(txp.ciclos) ? txp.ciclos : [])).filter(matchesStrat);
      eventos.forEach((ev, i) => {
        const w = Math.round(resolve(ev.when));
        laneDetails['Trasplante'].items.push({ week: w, title: ev.titulo || ev.nombre || `Trasplante ${i+1}`, body: ev.descripcion || ev.detalle || null, cond: ev.cond || null });
      });
    }

    laneDetails['Soporte / Profilaxis'] = { items: [], note: soporte?.descripcion || prof?.descripcion || null };
    const soporteItems = ((soporte?.medidas || soporte?.items) || (prof?.items || prof?.medidas) || []);
    (Array.isArray(soporteItems) ? soporteItems : []).filter(matchesStrat).forEach((it, i) => laneDetails['Soporte / Profilaxis'].items.push({ week: null, title: it.titulo || it.nombre || `Soporte ${i+1}`, body: it.descripcion || it.articulacion || null }));

    laneDetails['Seguimiento'] = { items: [], note: seg?.descripcion || null };
    const segItems = (Array.isArray(seg?.eventos) ? seg.eventos : (Array.isArray(seg?.ciclos) ? seg.ciclos : [])).filter(matchesStrat);
    (segItems || []).forEach((it, i) => { const w = it.when ? Math.round(resolve(it.when)) : null; laneDetails['Seguimiento'].items.push({ week: w, title: it.titulo || it.nombre || `Seguimiento ${i+1}`, body: it.descripcion || it.detalle || null }); });

    // Ensure default lanes exist (even if empty) so user can click/hover them
    const expected = ['Quimioterapia','Radioterapia','Cirugía','Inmunoterapia','Evaluaciones','Trasplante','Soporte / Profilaxis','Seguimiento'];
    const rowsMap = new Map();
    // fill with available data
    rowsMap.set('Quimioterapia', gridRow('Quimioterapia', '#9a83f5', chemoWeeks));
    rowsMap.set('Radioterapia', gridRow('Radioterapia', '#5078d9', rtWeeks));
    rowsMap.set('Cirugía', gridRow('Cirugía', '#7a8592', surgWeeks));
    rowsMap.set('Inmunoterapia', gridRow('Inmunoterapia', '#3db18a', inmWeeks));
    rowsMap.set('Evaluaciones', gridRow('Evaluaciones', '#7b99eb', evalWeeks));
    // add missing expected lanes with empty marks
    expected.forEach(label => {
      if (!rowsMap.has(label)) {
        rowsMap.set(label, gridRow(label, '#eef3ff', new Set()));
      }
    });

    // Only keep rows that have marks or laneDetails items/notes
    const rows = Array.from(rowsMap.values()).filter((r) => {
      const hasMarks = (r.weeksMarked instanceof Map && r.weeksMarked.size > 0) || (r.weeksMarked instanceof Set && r.weeksMarked.size > 0);
      const details = laneDetails && laneDetails[r.label];
      const hasDetails = details && Array.isArray(details.items) && details.items.length > 0;
      const hasNote = details && Boolean(details.note);
      return hasMarks || hasDetails || hasNote;
    });

    return { rows, totalWeeks, laneDetails };
  }, [data, selectedStratId]);

  const weeks = Array.from({ length: Math.ceil(totalWeeks) + 1 }, (_, i) => i);
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, text: '' });
  const [hovered, setHovered] = useState(null); // { lane, week }
  const [pinned, setPinned] = useState(null); // { lane, week }
  // note: laneDetails is returned from the memo; but React useMemo return is destructured below - adjust to read from memo result
  // we'll instead retrieve laneDetails from the memo call above
  // replace tip text behavior to include lane info
  const hideTip = () => setTip(t => ({ ...t, show: false }));
  const showTip = (e, text, lane = null, week = null) => {
    if (!text && !lane) return;
    setTip({ show: true, x: e.clientX + 10, y: e.clientY + 10, text: text || (lane ? lane : '') });
    setHovered(lane ? { lane, week } : null);
  };

  // detect platinos at protocol level
  const plat = protocolPlatinos(data);

  return (
    <div style={{ overflow: 'auto', border: '1px solid #cdd8ef', borderRadius: 12, padding: 12, position: 'relative', background: '#fbfcff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${weeks.length}, 26px)`, gap: 6, alignItems: 'center' }}>
        {/* Header weeks (sticky top) */}
        <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 5, background: '#fbfcff', borderBottom: '1px solid #e3ebfa', borderRight: '1px solid #e3ebfa', height: 24 }} />
        {weeks.map(w => (
          <div
            key={w}
            style={{ position: 'sticky', top: 0, zIndex: 4, background: '#fbfcff', fontSize: 11, color: '#334155', textAlign: 'center', borderBottom: '1px solid #e3ebfa' }}
          >
            S{w}
          </div>
        ))}
        {/* Rows */}
        {rows.map((row, idx) => (
          <React.Fragment key={idx}>
            <div style={{ position: 'sticky', left: 0, zIndex: 3, background: '#fbfcff', fontSize: 12, color: '#334155', textTransform: 'uppercase', letterSpacing: '.06em', borderRight: '1px solid #e3ebfa', paddingRight: 6 }}>
              {row.label}
            </div>
            {weeks.map((w) => {
              const isMap = row.weeksMarked instanceof Map;
              const isSet = row.weeksMarked instanceof Set;
              const active = isMap ? row.weeksMarked.has(w) : (isSet ? row.weeksMarked.has(w) : false);
              const title = isMap ? (row.weeksMarked.get(w) || '') : '';
              const cellText = isMap && title && title.startsWith('RT') ? 'RT' : '';
              const tipText = isMap ? title : (isSet && active ? row.label : '');
              // If there are laneDetails items without assigned week, show a placeholder at week 0
              const details = laneDetails && laneDetails[row.label];
              const hasUnscheduled = details && Array.isArray(details.items) && details.items.some(it => it.week == null);
              // show platino icon when chemo row has platino drugs in maintenance or when RT week has concomitant carboplatin
              const showPlatIcon = false; // badges removed per user request
              const platIcon = '';
              return (
                <div
                  key={w}
                  onMouseEnter={(e) => showTip(e, tipText, row.label, active ? w : null)}
                  onMouseMove={(e) => showTip(e, tipText, row.label, active ? w : null)}
                  onMouseLeave={() => { hideTip(); setHovered(null); }}
                  onClick={(e) => {
                    // toggle pinned panel for this lane/week
                    const payload = { lane: row.label, week: active ? w : null };
                    if (pinned && pinned.lane === payload.lane && pinned.week === payload.week) {
                      setPinned(null);
                    } else {
                      setPinned(payload);
                    }
                  }}
                  style={{ width: 26, height: 20, borderRadius: 5, background: active ? row.color : '#eef3ff', border: '1px solid #dbe6fb', display: 'grid', placeItems: 'center', color: active ? '#ffffff' : '#44536b', fontSize: 10, fontWeight: 600, cursor: active ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {cellText}
                    {showPlatIcon && active ? (<span title={plat.cisplatin ? 'Cisplatino presente — revisar GFR' : 'Carboplatino presente — audiometría requerida'} style={{ fontSize: 11, background: '#fde68a', color: '#92400e', padding: '2px 6px', borderRadius: 6 }}>{platIcon}</span>) : null}
                    {!active && w === 0 && hasUnscheduled ? (
                      <span title="Eventos sin semana asignada" style={{ width: 8, height: 8, display: 'inline-block', background: '#ffb020', borderRadius: 8 }} />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {tip.show && (
        <div role="tooltip" style={{ position: 'fixed', left: tip.x, top: tip.y, background: '#0e1220', color: '#fff', padding: '8px 10px', borderRadius: 8, fontSize: 13, maxWidth: 420, boxShadow: '0 8px 18px rgba(0,0,0,.3)', zIndex: 50, pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>{hovered?.lane || ''}{hovered?.week != null ? ` — S${hovered.week}` : ''}</strong>
          <div>{tip.text}</div>
        </div>
      )}

      {/* Pinned detail panel */}
      {pinned && (
        <aside aria-live="polite" style={{ position: 'fixed', right: 12, top: 72, width: 360, maxHeight: '70vh', overflow: 'auto', background: '#fff', border: '1px solid #e3ebfa', borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(20,30,60,.12)', zIndex: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{pinned.lane}{pinned.week != null ? ` — Semana ${pinned.week}` : ''}</strong>
            <button onClick={() => setPinned(null)} aria-label="Cerrar detalles" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: '#4a5970' }}>
            {(laneDetails && laneDetails[pinned.lane] && laneDetails[pinned.lane].note) ? <p style={{ marginTop: 0 }}>{laneDetails[pinned.lane].note}</p> : <p style={{ marginTop: 0, color: '#6b7280' }}>No hay descripción estructurada para esta sección.</p>}
            <div style={{ marginTop: 8 }}>
              {(laneDetails && laneDetails[pinned.lane] && laneDetails[pinned.lane].items?.length) ? (
                laneDetails[pinned.lane].items.filter(it => pinned.week == null ? true : it.week === pinned.week).map((it, idx) => (
                  <article key={idx} style={{ padding: 8, borderRadius: 8, border: '1px solid #eef3ff', marginBottom: 8 }}>
                    <h4 style={{ margin: '0 0 6px' }}>{it.title}{it.span ? ` · ${it.span} sem` : ''} {it.cond ? <span title={it.cond} style={{ fontSize: 11, color: '#7c3aed', background: '#f4e8ff', border: '1px solid #e1caff', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Condicional</span> : null}</h4>
                    {it.details && it.details.length ? (<ul style={{ margin: '6px 0' }}>{it.details.map((d,i)=> <li key={i} style={{ fontSize: 13 }}>{d}</li>)}</ul>) : null}
                    {it.body ? <p style={{ margin: 0, color: '#374151' }}>{it.body}</p> : null}
                  </article>
                ))
              ) : (
                <p style={{ color: '#6b7280' }}>No hay eventos programados para esta vista.</p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
