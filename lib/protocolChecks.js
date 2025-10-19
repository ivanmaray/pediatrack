// Small helpers to derive protocol-level checks from a protocol JSON
export function requiresAudiometry(protocol) {
  const versiones = Array.isArray(protocol.versiones) ? protocol.versiones : [];
  const base = versiones[0] || {};
  const inv = base.investigaciones || {};
  // If audiometria object exists or text mentions audiometría, require it for platinos
  if (inv.audiometria) return true;
  const antes = Array.isArray(inv.antes_de_cada_curso) ? inv.antes_de_cada_curso.join(' ').toLowerCase() : '';
  if (antes.includes('audiometr') || antes.includes('pure-tone')) return true;
  return false;
}

export function requiresGFR(protocol) {
  const versiones = Array.isArray(protocol.versiones) ? protocol.versiones : [];
  const base = versiones[0] || {};
  const inv = base.investigaciones || {};
  if (inv.gfr_thresholds) return true;
  const antes = Array.isArray(inv.antes_de_cada_curso) ? inv.antes_de_cada_curso.join(' ').toLowerCase() : '';
  if (antes.includes('gfr') || antes.includes('glomerular')) return true;
  return false;
}

export function carboplatinConcomitantWeeks(protocol, selectedStratId) {
  // Return a set of week numbers where carboplatin is given concomitantly with RT (if protocol defines it under radioterapia options)
  const versiones = Array.isArray(protocol.versiones) ? protocol.versiones : [];
  const base = versiones[0] || {};
  const rt = base.radioterapia || {};
  const qtx = base.quimioterapia || {};
  const stratGroup = selectedStratId && selectedStratId.toLowerCase().startsWith('lr') ? 'lr' : 'sr';
  const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
  const pick = opts.find(o => o.id === selectedStratId) || opts.find(o => (o.id || '').toLowerCase().includes(stratGroup)) || opts[0];
  const weeks = new Set();
  if (!pick) return weeks;
  const start = (() => {
    const when = pick.when || (rt[ (stratGroup==='lr') ? 'LR' : 'SR' ] && rt[ (stratGroup==='lr') ? 'LR' : 'SR' ].when) || null;
    if (!when) return 0;
    if (typeof when === 'number') return when;
    if (when.anchor === 'treatment_start') return Number(when.offset_weeks || 0);
    if (when.anchor === 'absolute_week') return Number(when.week || 0) + Number(when.offset_weeks || 0);
    return Number(when.offset_weeks || 0);
  })();
  const dur = Number(pick.duracion_semanas || pick.duracion || 0);
  if ((pick.id || '').toLowerCase().includes('carbo') || (pick.nota || '').toLowerCase().includes('carboplat')) {
    for (let i = 0; i < dur; i++) weeks.add(start + i);
  }
  return weeks;
}

export function protocolPlatinos(protocol) {
  // Return which platino drugs are used in maintenance cycles (cisplatin or carboplatin)
  const versiones = Array.isArray(protocol.versiones) ? protocol.versiones : [];
  const base = versiones[0] || {};
  const mtto = base.mantenimiento || base.quimioterapia?.mantenimiento || {};
  const ciclos = mtto.ciclos || (base.quimioterapia && base.quimioterapia.ciclos) || {};
  const found = { cisplatin: false, carboplatin: false };
  Object.values(ciclos).forEach(c => {
    const meds = Array.isArray(c.farmacos) ? c.farmacos.join(' ').toLowerCase() : (Array.isArray(c.drogas) ? c.drogas.join(' ').toLowerCase() : '');
    if (meds.includes('cisplat')) found.cisplatin = true;
    if (meds.includes('carboplat')) found.carboplatin = true;
  });
  // also check radiotherapy concomitant carboplatin
  const rt = base.radioterapia || {};
  const opts = Array.isArray(rt.opciones) ? rt.opciones : [];
  if (opts.some(o => (o.nota || '').toLowerCase().includes('carboplat') || (o.id || '').toLowerCase().includes('carbo'))) found.carboplatin = true;
  return found;
}

export default { requiresAudiometry, requiresGFR, carboplatinConcomitantWeeks, protocolPlatinos };
