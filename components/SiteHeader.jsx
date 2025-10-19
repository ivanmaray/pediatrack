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
    document.documentElement.classList.toggle("dark-mode", saved);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", next ? "true" : "false");
    document.documentElement.classList.toggle("dark-mode", next);
  };

  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand" aria-label="Pediatrack inicio">
          <span className="site-header__wordmark">
            <Image
              src="/logo-pediatrack.avif"
              alt="Pediatrack"
              width={220}
              height={64}
              className="site-header__logo"
              style={{ width: 'auto', height: 64 }}
              priority
            />
          </span>
        </Link>
        <div className="site-header__controls">
          <nav className="site-header__nav site-header__nav--inline" aria-label="Principal">
            <Link href="/search" className="site-header__link">
              Buscar protocolos
            </Link>
          </nav>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="mode-toggle"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
  );
}

