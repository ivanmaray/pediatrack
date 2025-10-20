"use client";
import { useEffect, useState } from 'react';

export function Toasts() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      // custom event detail: { text, level }
      const { text, level } = e.detail || {};
      const id = Date.now() + Math.random();
      setMessages((s) => [...s, { id, text, level }]);
      setTimeout(() => {
        setMessages((s) => s.filter((m) => m.id !== id));
      }, 4500);
    };
    window.addEventListener('pediatrack:toast', handler);
    return () => window.removeEventListener('pediatrack:toast', handler);
  }, []);

  if (!messages.length) return null;
  return (
    <div aria-live="polite" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 10000 }}>
      {messages.map((m) => (
        <div key={m.id} role="status" style={{ background: '#111', color: '#fff', padding: '8px 12px', marginTop: 8, borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.2)', minWidth: 200 }}>
          {m.text}
        </div>
      ))}
    </div>
  );
}

export function pushToast(text, level = 'info') {
  try {
    window.dispatchEvent(new CustomEvent('pediatrack:toast', { detail: { text, level } }));
  } catch {}
}
