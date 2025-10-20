const fs = require('fs');
const path = require('path');

function readJSON(p) { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); }

const p = readJSON('data/pnet5.json');
const version = Array.isArray(p.versiones) ? p.versiones[0] : (p.versiones || {});
const base = version || {};

// Build minimal resolver following ProtocolTimeline logic
const quimio = version.quimioterapia ?? p.quimioterapia ?? {};
const radioterapia = version.radioterapia ?? p.radioterapia ?? {};

function parseWeekFromString(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

const induction = Array.isArray(quimio.induccion) ? quimio.induccion : [];
const inductionIntervalWeeks = Number(quimio.induccion_intervalo_semanas) || 3;
const firstWhen = induction[0]?.when;
function computeInductionStart() {
  if (!induction.length) return 0;
  if (typeof firstWhen === 'object') {
    if (typeof firstWhen.offset_weeks === 'number' && firstWhen.anchor === 'treatment_start') return Number(firstWhen.offset_weeks);
    if (typeof firstWhen.week === 'number') return Number(firstWhen.week);
  }
  const wk = parseWeekFromString(firstWhen);
  return wk ?? 0;
}
const inductionStartWeek = computeInductionStart();

const options = Array.isArray(radioterapia.opciones) ? radioterapia.opciones : [];
function computeStaticWeek(when) {
  if (!when) return null;
  if (typeof when === 'number') return when;
  if (typeof when === 'string') return parseWeekFromString(when);
  if (Array.isArray(when)) {
    for (const entry of when) {
      const week = computeStaticWeek(entry);
      if (week != null) return week;
    }
    return null;
  }
  const offset = Number(when.offset_weeks || 0);
  switch (when.anchor) {
    case 'treatment_start': return offset;
    case 'absolute_week': return Number(when.week || 0) + offset;
    default: return null;
  }
}

const pickWhen = (options.length ? options[0] : null) ? (options[0].when || null) : (radioterapia.LR?.when || radioterapia.SR?.when || null);
const rtStartWeek = computeStaticWeek(pickWhen) ?? 4;
function spanFromBlock(block) {
  if (!block) return 0;
  if (typeof block.duracion_semanas === 'number') return block.duracion_semanas;
  if (block.semanas) {
    const m = String(block.semanas).match(/(\d+)[^\d]+(\d+)/);
    if (m) return Math.max(1, Number(m[2]) - Number(m[1]));
  }
  return 6;
}
const rtBlock = rtStartWeek ? (version.radioterapia ?? p.radioterapia) : null;
const rtSpan = (typeof options[0]?.duracion_semanas === 'number' ? options[0].duracion_semanas : (rtBlock?.duracion_semanas || 6));

// mtto order and durations
function buildMttoOrden(q) {
  if (!q) return [];
  if (q.planes) {
    const k = Object.keys(q.planes)[0];
    if (q.planes[k] && Array.isArray(q.planes[k].orden)) return q.planes[k].orden;
  }
  if (q.mantenimiento && Array.isArray(q.mantenimiento.orden)) return q.mantenimiento.orden;
  return [];
}
function buildMttoDur(q) {
  const out = {};
  const m = q.mantenimiento?.ciclos || {};
  for (const k of Object.keys(m)) {
    if (k === 'A') out.A = 6;
    if (k === 'B') out.B = 3;
    // best-effort: if farmacos include long infusions, keep defaults
  }
  if (!out.A) out.A = 6;
  if (!out.B) out.B = 3;
  return out;
}
const mttoOrden = buildMttoOrden(quimio);
const mttoDur = buildMttoDur(version);

// mttoStartOffset: follow ProtocolTimeline logic
const rel = quimio?.inicio_relativo;
function computeMttoStartOffset() {
  if (!rel) return rtStartWeek + rtSpan + 2;
  const offset = Number(rel.offset_weeks || 0);
  switch (rel.anchor) {
    case 'rt_end': return rtStartWeek + rtSpan + offset;
    case 'rt_start': return rtStartWeek + offset;
    case 'treatment_start': return offset;
    case 'absolute_week': return Number(rel.week || 0) + offset;
    default: return rtStartWeek + rtSpan + offset;
  }
}
const mttoStartOffset = computeMttoStartOffset();

function sumCyclesUntil(ord, dur, idx) {
  let s = 0;
  for (let i = 0; i < idx && i < ord.length; i++) {
    const c = ord[i];
    s += (dur[c] || (c.toUpperCase()==='A'?6:3));
  }
  return s;
}

function resolveWhenWeek(when) {
  if (!when) return null;
  if (Array.isArray(when)) {
    for (const w of when) {
      const r = resolveWhenWeek(w);
      if (r != null) return r;
    }
    return null;
  }
  if (typeof when === 'number') return when;
  if (typeof when === 'string') return parseWeekFromString(when);
  if (typeof when !== 'object') return null;
  if (typeof when.week === 'number') return Number(when.week) + Number(when.offset_weeks || 0);
  const offset = Number(when.offset_weeks || 0);
  switch (when.anchor) {
    case 'treatment_start': return offset;
    case 'absolute_week': return Number(when.week || 0) + offset;
    case 'rt_start': return rtStartWeek + offset;
    case 'rt_end': return rtStartWeek + rtSpan + offset;
    case 'induction_cycle_index': {
      const idx = Number(when.cycle_index || 0);
      return inductionStartWeek + idx * inductionIntervalWeeks + offset;
    }
    case 'mtto_start': return mttoStartOffset + offset;
    case 'mtto_cycle_index': {
      const idx = Number(when.cycle_index || 0);
      return mttoStartOffset + sumCyclesUntil(mttoOrden, mttoDur, idx) + offset;
    }
    case 'treatment_end': {
      const total = mttoOrden.length ? (mttoStartOffset + mttoOrden.reduce((a,c,i)=>a + (mttoDur[c] || (c.toUpperCase()==='A'?6:3)),0)) : (rtStartWeek + rtSpan);
      return total + offset;
    }
    default: return null;
  }
}

// Print evaluations
const evals = version.evaluacion || p.evaluacion || [];
console.log('rtStartWeek', rtStartWeek, 'rtSpan', rtSpan, 'mttoStartOffset', mttoStartOffset);
evals.forEach(ev => {
  const w = resolveWhenWeek(ev.when);
  console.log('-', ev.id || ev.titulo || ev.momento || '-', ev.momento || '', '=>', w, 'label:', ev.momento || ev.titulo || '');
});

// Also print mtto cycles
console.log('\nMaintenance cycles (orden & durations):', mttoOrden);
for (let i=0;i<mttoOrden.length;i++){
  const start = mttoStartOffset + sumCyclesUntil(mttoOrden, mttoDur, i);
  const dur = mttoDur[mttoOrden[i]] || (mttoOrden[i].toUpperCase()==='A'?6:3);
  console.log(` mtto #${i} (${mttoOrden[i]}) start ${start} dur ${dur} end ${start+dur}`);
}

console.log('\nDone.');
