"use client";
import React, { useMemo, useState, useEffect } from "react";
import jsPDF from 'jspdf';

// Stepper de hitos clave
export default function ProtocolStepper({ data, selectedStratId }) {
  const defaultCats = ['Evaluación', 'Cirugía', 'Radioterapia', 'Consolidación', 'Trasplante', 'Inmunoterapia', 'Soporte', 'Profilaxis', 'Seguimiento', 'Inducción', 'Ciclos'];
  const [selectedCats, setSelectedCats] = useState(new Set(defaultCats));

  const { steps, categories } = useMemo(() => {
    const versiones = Array.isArray(data.versiones) ? data.versiones : [];
    const base = versiones[0] || {};
    const evals = Array.isArray(base.evaluacion) ? base.evaluacion : [];
    const cirugia = base.cirugia;
    const rt = base.radioterapia || {};
    const qtx = base.quimioterapia || {};
    const txp = base.trasplante;
    const inmuno = base.inmunoterapia || {};
    const soporte = base.soporte || {};
    const profilaxis = base.profilaxis || {};
    const seguimiento = base.seguimiento || {};

    const resolve = (when) => {
        // Support arrays of when: try alternatives
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
          const interval = Number(qtx.induccion_intervalo_semanas || 2);
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(idx * interval)) + off;
        }
        if (when.anchor === 'rt_end') {
          // Compute RT end = RT start + duration (from first option if available)
          const opt0 = Array.isArray(rt.opciones) ? rt.opciones[0] : null;
          if (opt0) {
            const start = resolve(opt0.when);
            const dur = Number(opt0.duracion_semanas || 0);
            return Math.max(0, Math.round(start + dur)) + off;
          }
          return off;
        }
        if (when.anchor === 'mtto_cycle_index') {
          const mttoInterval = Number(qtx.mantenimiento_intervalo_semanas || 6);
          // Base start: quimioterapia.inicio_relativo (p.ej. rt_end + 6)
          const baseStart = qtx.inicio_relativo ? resolve(qtx.inicio_relativo) : resolve({ anchor: 'rt_end', offset_weeks: 0 });
          const idx = Number(when.cycle_index || 0);
          return Math.max(0, Math.round(baseStart + idx * mttoInterval)) + off;
        }
        if (when.anchor === 'induction_cycle_span') {
          const interval = Number(qtx.induccion_intervalo_semanas || 2);
          const startIdx = Number(when.start_index ?? 0);
          const endIdx = Number(when.end_index ?? startIdx);
          return {
            start: Math.max(0, Math.round(startIdx * interval)) + off,
            end: Math.max(0, Math.round((endIdx + 0) * interval)) + off,
          };
        }
        return off;
      }
      return 0;
    };

    const items = [];
    const catsSet = new Set();
    const push = (title, descr, when, category, tag) => {
      if (category) catsSet.add(category);
      const r = resolve(when);
      if (typeof r === 'object' && r && typeof r.start === 'number') {
        items.push({ title: `${title} (inicio)`, descr, week: r.start, category, tag });
        if (typeof r.end === 'number') items.push({ title: `${title} (fin)`, descr, week: r.end, category, tag });
      } else {
        items.push({ title, descr, week: r, category, tag });
      }
    };

    // Evaluaciones importantes
  evals.forEach(ev => push(ev.titulo || 'Evaluación', ev.descripcion || '', ev.when, 'Evaluación'));
  if (cirugia) push('Cirugía', cirugia.descripcion || '', cirugia.when, 'Cirugía');

    // Elegir opción de RT en función del estrato si hay coincidencia
    const pickRtOption = () => {
      const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
      if (!opts.length) return null;
      // match exact id first
      const exact = opts.find(o => o.id === selectedStratId);
      if (exact) return exact;
      // map estrato a grupo amplio
      const group = selectedStratId && selectedStratId.toLowerCase().startsWith('lr') ? 'lr' : 'sr';
      const byGroup = opts.find(o => (o.id || '').toLowerCase().includes(group));
      return byGroup || opts[0];
    };
    const rtOpt = pickRtOption();
    if (rtOpt) {
      push('Inicio RT', rtOpt.nota || '', rtOpt.when, 'Radioterapia');
      if (rtOpt.duracion_semanas) {
        // Fin de RT aproximado (inicio + duración)
        const end = typeof rtOpt.when === 'object'
          ? { ...rtOpt.when, offset_weeks: (rtOpt.when.offset_weeks || 0) + Number(rtOpt.duracion_semanas || 0) }
          : (resolve(rtOpt.when) + Number(rtOpt.duracion_semanas || 0));
        push('Fin RT', rtOpt.nota || '', end, 'Radioterapia');
      }
    }

  const consArr = Array.isArray(qtx.consolidacion) ? qtx.consolidacion : (qtx.consolidacion ? [qtx.consolidacion] : []);
  consArr.forEach(cons => push(cons.titulo || 'Consolidación', cons.descripcion || '', cons.when, 'Consolidación'));

  if (txp) push('Trasplante', txp.descripcion || '', txp.when, 'Trasplante');

    // Inmunoterapia: añadir cada ciclo/evento
  const imm = Array.isArray(inmuno.eventos) ? inmuno.eventos : [];
  imm.forEach((ev, idx) => push(ev.titulo || (idx === 0 ? 'Inicio Inmunoterapia' : 'Inmunoterapia'), ev.descripcion || '', ev.when, 'Inmunoterapia'));

    // Soporte transversal
  const medidas = Array.isArray(soporte.medidas) ? soporte.medidas : [];
  medidas.forEach(m => push(m.titulo || 'Soporte', m.descripcion || '', m.when, 'Soporte', m.tipo));

    // Profilaxis
  const profEvents = Array.isArray(profilaxis.eventos) ? profilaxis.eventos : [];
  profEvents.forEach(p => push(p.titulo || 'Profilaxis', p.descripcion || '', p.when, 'Profilaxis'));

    // Seguimiento
  const segEvents = Array.isArray(seguimiento.eventos) ? seguimiento.eventos : [];
  segEvents.forEach(sg => push(sg.titulo || 'Seguimiento', sg.descripcion || '', sg.when, 'Seguimiento'));

    // Inducción: marcar inicio/fin a modo de hito
    const induccion = Array.isArray(qtx.induccion) ? qtx.induccion : [];
    if (induccion.length) {
      // Inicio inducción en ciclo 0
      push('Inicio de inducción', 'RAPID COJEC', { anchor: 'induction_cycle_index', cycle_index: 0 }, 'Inducción');
      // Fin de inducción aproximado usando último índice
      const lastIdx = induccion.reduce((max, c) => {
        const w = c.when;
        const idx = (w && typeof w === 'object' && w.anchor === 'induction_cycle_index') ? Number(w.cycle_index || 0) : max;
        return Math.max(max, idx);
      }, 0);
      push('Fin de inducción', 'Fin RAPID COJEC', { anchor: 'induction_cycle_index', cycle_index: lastIdx }, 'Inducción');

      // Mostrar cada ciclo de inducción como hito individual (Ciclos)
      induccion.forEach((c) => {
        const title = c.titulo || c.id || 'Ciclo de inducción';
        const descr = c.descripcion || '';
        push(title, descr, c.when, 'Ciclos');
      });
    }

    // Mantenimiento (PNET5): generar cursos A/B según orden y mostrar inicio de mantenimiento
    const mtto = base.mantenimiento || {};
    // Orden por estrato: usar quimioterapia.planes[lr|sr].orden si está disponible
    const stratGroup = selectedStratId && selectedStratId.toLowerCase().startsWith('lr') ? 'lr' : 'sr';
    const plannedOrden = qtx.planes && qtx.planes[stratGroup] && Array.isArray(qtx.planes[stratGroup].orden) ? qtx.planes[stratGroup].orden : null;
    const mttoOrden = plannedOrden || (Array.isArray(mtto.orden) ? mtto.orden : []);
    const ciclosDef = mtto.ciclos || {};
    if (mttoOrden.length) {
      const mttoInterval = Number((qtx.planes && qtx.planes[stratGroup] && qtx.planes[stratGroup].intervalo_semanas) ?? qtx.mantenimiento_intervalo_semanas ?? 6);
      const mttoStart = resolve(qtx.inicio_relativo || { anchor: 'rt_end', offset_weeks: 6 });
      push('Inicio de mantenimiento', 'Comienza quimioterapia de mantenimiento', mttoStart, 'Quimioterapia');
      mttoOrden.forEach((letter, idx) => {
        const def = ciclosDef[letter] || {};
        const drugs = Array.isArray(def.farmacos) ? def.farmacos.join(' · ') : '';
        const title = `Mantenimiento curso ${idx + 1} (${letter})`;
        const when = { anchor: 'mtto_cycle_index', cycle_index: idx };
        push(title, drugs, when, 'Ciclos', 'Mantenimiento');
      });
    }

    // Agrupar por semana para combinar múltiples hitos en la misma semana
    const grouped = items.reduce((acc, it) => {
      const w = Number(it.week) || 0;
      if (!acc[w]) acc[w] = [];
      // Generar id estable para deep-link: week + sanitized title
      const baseId = `${w}-${(it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
      acc[w].push({ id: baseId, title: it.title, descr: it.descr, category: it.category, tag: it.tag });
      return acc;
    }, {});

    const steps = Object.keys(grouped)
      .map(k => ({ week: Number(k), entries: grouped[Number(k)] }))
      .sort((a, b) => a.week - b.week);

    return { steps, categories: Array.from(catsSet) };
  }, [data, selectedStratId]);

  const [focusedId, setFocusedId] = useState('');

  const toggleCat = (cat) => {
    const next = new Set(selectedCats);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setSelectedCats(next);
  };

  const filtered = useMemo(() => steps.map(s => ({
    week: s.week,
    entries: s.entries.filter(e => selectedCats.has(e.category))
  })).filter(s => s.entries.length > 0), [steps, selectedCats]);

  // Export helpers
  const toFlat = () => {
    const rows = [];
    for (const s of filtered) {
      for (const e of s.entries) {
        rows.push({ week: s.week, category: e.category || '', tag: e.tag || '', title: e.title || '', descr: e.descr || '' });
      }
    }
    return rows;
  };

  const exportCSV = () => {
    try {
      const rows = toFlat();
      const header = ['Semana', 'Categoría', 'Subtipo', 'Título', 'Descripción'];
      const esc = (v) => {
        const s = String(v ?? '');
        if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const lines = [header.join(',')].concat(rows.map(r => [r.week, r.category, r.tag, r.title, r.descr].map(esc).join(',')));
      const csv = '\uFEFF' + lines.join('\n'); // UTF-8 BOM for Excel
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const name = (data?.id || 'hitos') + '-hitos.csv';
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export CSV error', e);
      alert('No se pudo exportar CSV.');
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 48;
      const title = `Hitos — ${data?.titulo || data?.nombre || data?.id || ''}`.trim();
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(title, marginX, y);
      y += 18;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      const lineH = 14;
      const maxY = doc.internal.pageSize.getHeight() - 40;
      const drawLine = (txt, bold = false) => {
        if (y > maxY) { doc.addPage(); y = 40; }
        if (bold) { doc.setFont('helvetica', 'bold'); } else { doc.setFont('helvetica', 'normal'); }
        const splitted = doc.splitTextToSize(txt, pageW - marginX * 2);
        splitted.forEach((ln) => {
          if (y > maxY) { doc.addPage(); y = 40; }
          doc.text(ln, marginX, y);
          y += lineH;
        });
      };
      for (const s of filtered) {
        drawLine(`Semana S${s.week}`, true);
        for (const e of s.entries) {
          drawLine(`• [${e.category}${e.tag ? ` · ${e.tag}` : ''}] ${e.title}`);
          if (e.descr) drawLine(`  ${e.descr}`);
        }
        y += 4;
      }
      doc.save(`${(data?.id || 'hitos')}-hitos.pdf`);
    } catch (e) {
      console.error('Export PDF error', e);
      alert('No se pudo exportar PDF.');
    }
  };

  // Initialize filters from URL (?cats=A,B,C) and keep URL in sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const catsParam = url.searchParams.get('cats');
      const focusParam = url.searchParams.get('focus');
      if (catsParam) {
        const fromUrl = catsParam.split(',').map(decodeURIComponent).filter(Boolean);
        if (fromUrl.length) setSelectedCats(new Set(fromUrl));
      }
      if (focusParam) setFocusedId(focusParam);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('cats', Array.from(selectedCats).map(encodeURIComponent).join(','));
      window.history.replaceState({}, '', url);
    } catch {}
  }, [selectedCats]);

  // Keep URL in sync for focus and scroll into view on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!focusedId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('focus', focusedId);
      window.history.replaceState({}, '', url);
      const el = document.querySelector(`[data-step-id="${CSS.escape(focusedId)}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }, [focusedId]);

  return (
    <>
      <div className="stepper-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {categories.map(cat => (
          <label key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid #d8e1f1', background: selectedCats.has(cat) ? '#eaf2ff' : '#fff', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={selectedCats.has(cat)} onChange={() => toggleCat(cat)} />
            {cat}
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={exportCSV} title="Exportar CSV" style={{ border: '1px solid #cfe0ff', background: '#eef3ff', color: '#3d5a9a', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>CSV</button>
        <button type="button" onClick={exportPDF} title="Exportar PDF" style={{ border: '1px solid #e8d7ff', background: '#f6f0ff', color: '#5a3bd6', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>PDF</button>
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
      {filtered.map((s, i) => (
        <li key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, alignItems: 'start' }}>
          <div style={{ fontSize: 11, color: '#4a5970', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>S{s.week}</div>
          <div style={{ border: '1px solid #d8e1f1', background: '#ffffff', borderRadius: 12, padding: 12, boxShadow: '0 10px 24px rgba(0,0,0,.06)', display: 'grid', gap: 8 }}>
            {s.entries.map((e, j) => (
              <div key={j} data-step-id={e.id} onClick={() => setFocusedId(e.id)} style={{ cursor: 'pointer', outline: focusedId === e.id ? '2px solid #7aa2ff' : 'none', borderRadius: 8, padding: focusedId === e.id ? 6 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#3d5a9a', background: '#e6eefc', border: '1px solid #cfe0ff', borderRadius: 6, padding: '2px 6px' }}>{e.category}{e.tag ? ` · ${e.tag}` : ''}</span>
                  <strong style={{ color: '#0e1220' }}>{e.title}</strong>
                </div>
                {e.descr && <p style={{ margin: '4px 0 0', color: '#4a5970', fontSize: 13 }}>{e.descr}</p>}
              </div>
            ))}
          </div>
        </li>
      ))}
      </ol>
    </>
  );
}
