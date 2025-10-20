"use client";
import React, { useMemo, useState } from "react";

// Calendario de ciclos (quimioterapia)
export default function ProtocolCycleCalendar({ data, selectedStratId }) {
  const [showInd, setShowInd] = useState(true);
  const [showCons, setShowCons] = useState(true);
  const [showImm, setShowImm] = useState(true);
  const [showMtto, setShowMtto] = useState(true);
  const { cycles } = useMemo(() => {
    const versiones = Array.isArray(data.versiones) ? data.versiones : [];
    const base = versiones[0] || {};
    const qtx = base.quimioterapia || {};
    // Stratification filter helper
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
    const consolidacion = (Array.isArray(qtx.consolidacion) ? qtx.consolidacion : []).filter(matchesStrat);
  // mantenimiento: preferir planes por estrato si existen (sr/ir/ar/t/lr)
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
  const planned = qtx.planes && stratKey ? qtx.planes[stratKey] : null;
  const mttoOrden = planned && Array.isArray(planned.orden) ? planned.orden : (Array.isArray(qtx.mantenimiento?.orden) ? qtx.mantenimiento.orden : []);
  const mttoInterval = Number((planned && planned.intervalo_semanas) ?? qtx.mantenimiento_intervalo_semanas ?? 6);
  const inmuno = (Array.isArray(base.inmunoterapia?.eventos) ? base.inmunoterapia.eventos : []).filter(matchesStrat);
  const interval = Number(qtx.induccion_intervalo_semanas || 2);

    const resolve = (when) => {
      if (!when) return 0;
      if (typeof when === 'number') return when;
      if (typeof when === 'object') {
        // Support arrays of when: pick first resolvable
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
          return Math.max(0, Math.round(idx * interval)) + off;
        }
        if (when.anchor === 'mtto_cycle_index') {
          const baseStart = qtx.inicio_relativo ? resolve(qtx.inicio_relativo) : resolve({ anchor: 'rt_end', offset_weeks: 0 });
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(baseStart + idx * mttoInterval)) + off;
        }
        return off;
      }
      return 0;
    };

    const list = [];

    // Inducción
    for (let i = 0; i < induccion.length; i++) {
      const c = induccion[i];
      const week = resolve(c.when);
      const drugs = Array.isArray(c.drogas)
        ? c.drogas.map(d => `${d.nombre}${d.dosis ? ` — ${d.dosis}` : ''}${Array.isArray(d.dias) ? ` (días ${d.dias.join(', ')})` : ''}`)
        : [];
      list.push({ id: c.id || `ind_${i}_${week}` , title: c.titulo || 'Ciclo', week, descr: c.descripcion || '', drugs, kind: 'induccion' });
    }

    // Consolidación (p.ej., BuMel)
    for (let k = 0; k < consolidacion.length; k++) {
      const c = consolidacion[k];
      const week = resolve(c.when);
      const drugs = Array.isArray(c.drogas)
        ? c.drogas.map(d => `${d.nombre}${d.dosis ? ` — ${d.dosis}` : ''}${Array.isArray(d.dias) ? ` (días ${d.dias.join(', ')})` : ''}`)
        : [];
      list.push({ id: c.id || `cons_${k}_${week}`, title: c.titulo || 'Consolidación', week, descr: c.descripcion || '', drugs, kind: 'consolidacion' });
    }

    // Inmunoterapia (ciclos)
    for (let j = 0; j < inmuno.length; j++) {
      const e = inmuno[j];
      const week = resolve(e.when);
      // algunos eventos no tienen esquema de drogas: mostramos descripción; incluir condicional si existe
      list.push({ id: e.id || `immuno_${j}_${week}`, title: e.titulo || 'Inmunoterapia', week, descr: e.descripcion || '', drugs: [], kind: 'inmunoterapia', cond: e.cond || null });
    }

    // Mantenimiento (si está definido en planes o en mantenimiento)
    if (Array.isArray(mttoOrden) && mttoOrden.length) {
      const ciclosDef = qtx.ciclos || qtx.mantenimiento?.ciclos || (base.mantenimiento && base.mantenimiento.ciclos) || {};
      for (let m = 0; m < mttoOrden.length; m++) {
        const letter = mttoOrden[m];
        const week = resolve({ anchor: 'mtto_cycle_index', cycle_index: m });
        const def = ciclosDef[letter] || {};
        const drugs = Array.isArray(def.farmacos) ? def.farmacos : (Array.isArray(def.drogas) ? def.drogas : []);
        list.push({ id: `mtto_${m}_${week}`, title: `Mantenimiento ${m + 1} (${letter})`, week, descr: def.descripcion || def.resumen || '', drugs, kind: 'mantenimiento' });
      }
    }

    list.sort((a, b) => a.week - b.week);

    return { cycles: list };
  }, [data, selectedStratId]);

  const onFocus = (id) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('focus', id);
      window.history.replaceState({}, '', url);
    } catch {}
  };

  const visible = cycles.filter(c =>
    (c.kind === 'induccion' && showInd) ||
    (c.kind === 'consolidacion' && showCons) ||
    (c.kind === 'inmunoterapia' && showImm)
    // Add condition for showMtto
    || (c.kind === 'mantenimiento' && showMtto)
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, position: 'relative' }}>
      {/* Sticky subheader with legend */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, gridColumn: '1 / -1', background: 'linear-gradient(0deg, rgba(255,255,255,0.9), #fff)', padding: '6px 4px', borderBottom: '1px solid #e3ebfa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#4a5970' }}>Calendario de ciclos (incluye inducción, consolidación, inmunoterapia y mantenimiento) — clic en “Sx” para centrar el foco</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label="Filtros de tipo de ciclo">
          <button onClick={() => setShowInd(v => !v)} aria-pressed={showInd} title="Mostrar/ocultar Inducción" style={{ fontSize: 11, border: '1px solid #cfe0ff', background: showInd ? '#eaf3ff' : '#f6f8fc', color: '#2d4b7b', borderRadius: 999, padding: '2px 8px' }}>Inducción</button>
          <button onClick={() => setShowCons(v => !v)} aria-pressed={showCons} title="Mostrar/ocultar Consolidación" style={{ fontSize: 11, border: '1px solid #ffe0bd', background: showCons ? '#fff3e6' : '#fef9f0', color: '#7a4f19', borderRadius: 999, padding: '2px 8px' }}>Consolidación</button>
          <button onClick={() => setShowImm(v => !v)} aria-pressed={showImm} title="Mostrar/ocultar Inmunoterapia" style={{ fontSize: 11, border: '1px solid #c6f3e2', background: showImm ? '#e8fff6' : '#f6fffb', color: '#1a6a55', borderRadius: 999, padding: '2px 8px' }}>Inmunoterapia</button>
          <button onClick={() => setShowMtto(v => !v)} aria-pressed={showMtto} title="Mostrar/ocultar Mantenimiento" style={{ fontSize: 11, border: '1px solid #c6f3e2', background: showMtto ? '#e8fff6' : '#f6fffb', color: '#1a6a55', borderRadius: 999, padding: '2px 8px' }}>Mantenimiento</button>
        </div>
      </div>
      {visible.map((c) => (
        <article key={c.id} style={{ border: '1px solid #d8e1f1', borderRadius: 12, padding: 12, background: '#fff', boxShadow: '0 10px 24px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ color: '#0e1220' }}>{c.title}</strong>
            <button onClick={() => onFocus(c.id)} title="Fijar foco" style={{ border: '1px solid #cfe0ff', background: '#eef3ff', color: '#3d5a9a', borderRadius: 8, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>S{c.week}</button>
          </div>
          <div style={{ margin: '4px 0 6px' }}>
            {c.kind === 'induccion' && <span style={{ fontSize: 11, color: '#2d4b7b', background: '#eaf3ff', border: '1px solid #cfe0ff', padding: '2px 6px', borderRadius: 999 }}>Inducción</span>}
            {c.kind === 'consolidacion' && <span style={{ fontSize: 11, color: '#7a4f19', background: '#fff3e6', border: '1px solid #ffe0bd', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Consolidación</span>}
            {c.kind === 'inmunoterapia' && <span style={{ fontSize: 11, color: '#1a6a55', background: '#e8fff6', border: '1px solid #c6f3e2', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Inmunoterapia</span>}
            {c.kind === 'mantenimiento' && <span style={{ fontSize: 11, color: '#1a6a55', background: '#e8fff6', border: '1px solid #c6f3e2', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Mantenimiento</span>}
            {c.cond && <span title={c.cond} style={{ fontSize: 11, color: '#7c3aed', background: '#f4e8ff', border: '1px solid #e1caff', padding: '2px 6px', borderRadius: 999, marginLeft: 6 }}>Condicional</span>}
          </div>
          {c.descr && <p style={{ margin: '6px 0 8px', color: '#4a5970', fontSize: 13 }}>{c.descr}</p>}
          {c.drugs.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, color: '#0e1220', fontSize: 13 }}>
              {c.drugs.map((d, i) => (<li key={i}>{d}</li>))}
            </ul>
          )}
        </article>
      ))}
      {cycles.length === 0 && (
        <p style={{ color: '#4a5970', fontSize: 13 }}>Este protocolo no tiene definición de ciclos de inducción. Añade quimioterapia.induccion para ver el calendario aquí.</p>
      )}
    </div>
  );
}
