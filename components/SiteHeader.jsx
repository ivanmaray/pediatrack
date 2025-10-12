"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("darkMode") === "true";
    setDarkMode(saved);
    document.body.classList.toggle("dark-mode", saved);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", newMode ? "true" : "false");
    document.body.classList.toggle("dark-mode", newMode);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-light: #ffffff;
          --text-light: #0e1220;
          --bg-dark: #1a1a1a;
          --text-dark: #e0e0e0;
        }
        body {
          background: var(--bg-light);
          color: var(--text-light);
          transition: background 0.3s, color 0.3s;
        }
        .dark-mode {
          --bg-light: var(--bg-dark);
          --text-light: var(--text-dark);
        }
        .dark-mode body {
          background: var(--bg-dark);
          color: var(--text-dark);
        }
        .site-header {
          background: var(--bg-light);
          border-bottom: 1px solid #d8e1f1;
          transition: background 0.3s;
        }
        .dark-mode .site-header {
          background: #2a2a2a;
          border-bottom-color: #444;
        }
        .mode-toggle, .viewer-tab, .export-btn, .protocol-card, .timeline-phase {
          background: var(--bg-light);
          border: 1px solid #d8e1f1;
          color: var(--text-light);
          transition: all 0.3s;
        }
        .dark-mode .mode-toggle, .dark-mode .viewer-tab, .dark-mode .export-btn, .dark-mode .protocol-card, .dark-mode .timeline-phase {
          background: var(--bg-dark);
          border-color: #444;
          color: var(--text-dark);
        }
        .site-header__controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .site-header__nav--inline {
          margin: 0;
        }
        .hero-card, .insight-card {
          background: var(--bg-light);
          color: var(--text-light);
          border: 1px solid #d8e1f1;
          transition: background 0.3s, color 0.3s;
        }
        .dark-mode .hero-card, .dark-mode .insight-card {
          background: #2a2a2a;
          color: var(--text-dark);
          border-color: #444;
        }
      `}} />
      <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          <span className="site-header__wordmark">
            <Image
              src="/logo-pediatrack.avif"
              alt=""
              width={220}
              height={64}
              className="site-header__logo"
              priority
            />
            <span className="sr-only">Pediatrack</span>
          </span>
        </Link>
        <div className="site-header__controls">
          <nav className="site-header__nav site-header__nav--inline" aria-label="Principal">
            <Link href="/search" className="site-header__link">
              Diagnósticos y Protocolos
            </Link>
          </nav>
          <button
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Modo claro" : "Modo oscuro"}
            className="mode-toggle"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
