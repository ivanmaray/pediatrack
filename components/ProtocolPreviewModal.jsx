"use client";
import React from 'react';
import { pushToast } from './Toasts';

export default function ProtocolPreviewModal({ protocolo, onClose }) {
  if (!protocolo) return null;

  const versiones = Array.isArray(protocolo.versiones) ? protocolo.versiones : [];
  const version = versiones[0] || {};

  const has = (k) => Boolean(version[k] || protocolo[k] || (version.quimioterapia && version.quimioterapia[k]));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" role="document">
        <header className="modal__header">
          <h3>{protocolo.titulo || protocolo.nombre || protocolo.id}</h3>
          <button aria-label="Cerrar" className="btn" onClick={() => onClose?.()}>Cerrar</button>
        </header>
        <div className="modal__body">
          <p className="muted">Área: {protocolo.area || '—'} · ID: {protocolo.id}</p>
          <div className="preview-badges" style={{display: 'flex', gap: 8, marginTop: 8}}>
            {has('quimioterapia') && <span className="badge">Quimioterapia</span>}
            {has('radioterapia') && <span className="badge">Radioterapia</span>}
            {has('inmunoterapia') && <span className="badge">Inmunoterapia</span>}
            {has('trasplante') && <span className="badge">Trasplante</span>}
            {has('mantenimiento') && <span className="badge badge--secondary">Mantenimiento</span>}
          </div>

          <section style={{marginTop: 12}}>
            <h4 style={{margin: '8px 0'}}>Fases</h4>
            <ul>
              {has('quimioterapia') && <li>Esquemas de quimioterapia: inducción, consolidación y posibles ciclos de mantenimiento.</li>}
              {has('radioterapia') && <li>Radioterapia: incluye planificación y controles de calidad (QA).</li>}
              {has('inmunoterapia') && <li>Inmunoterapia: protocolo y calendario según versión.</li>}
              {!has('quimioterapia') && !has('radioterapia') && !has('inmunoterapia') && <li>Resumen no disponible para esta versión.</li>}
            </ul>
          </section>

          <section style={{marginTop: 12}}>
            <h4 style={{margin: '8px 0'}}>Evaluaciones</h4>
            <p className="muted">{(version.evaluacion && version.evaluacion.length) ? `${version.evaluacion.length} evaluaciones planificadas` : 'No hay evaluaciones listadas en esta versión'}</p>
          </section>
        </div>

        <footer className="modal__footer">
          <div style={{display: 'flex', gap: 8}}>
            <button className="btn" onClick={() => onClose?.()}>Cerrar</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
