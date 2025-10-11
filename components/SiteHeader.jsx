"use client";
import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
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
        <nav className="site-header__nav" aria-label="Principal">
          <a href="#protocolos" className="site-header__link">
            Protocolos
          </a>
          <a href="#telemetria" className="site-header__link">
            Datos
          </a>
          <a href="#pipeline" className="site-header__link">
            Pipeline clínico
          </a>
        </nav>
      </div>
    </header>
  );
}
