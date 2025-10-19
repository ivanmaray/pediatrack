import Link from "next/link";
import data from "@/data/index.json";
import HomeClient from "@/components/HomeClient.jsx";
import { Suspense } from "react";

export const revalidate = 60;

export const metadata = {
  title: "Explorar protocolos | Pediatrack",
  description: "Busca y filtra protocolos oncológicos pediátricos por diagnóstico, grupo cooperativo o ID.",
};

export default function SearchPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .intro-banner {
          padding: 1.5rem 2rem 1rem 2rem;
          text-align: center;
          background: #f8f9fa;
          color: #495057;
          border-radius: 12px;
          margin-bottom: 0.5rem;
          border: 1px solid #e9ecef;
        }
        .intro-banner h1 {
          font-size: 1.8rem;
          font-weight: 600;
          margin: 0 0 0.3rem 0;
        }
        .intro-banner p {
          font-size: 1rem;
          margin: 0;
          opacity: 0.8;
        }

        .domain-preview {
          margin-bottom: 3rem;
        }
        .domain-preview__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 0 auto;
          max-width: 900px;
        }
        @media (max-width: 768px) {
          .domain-preview__grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }
        .domain-card {
          display: block;
          background: #fff;
          border: 2px solid #f0f0f0;
          border-radius: 12px;
          padding: 2rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.3s ease;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .domain-card:hover {
          border-color: #667eea;
          box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
          transform: translateY(-5px);
        }
        .dark-mode .domain-card {
          background: #2a2a2a;
          border-color: #444;
          color: #e0e0e0;
        }
        .dark-mode .domain-card:hover {
          border-color: #667eea;
        }
        .domain-card__icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: block;
        }
        .domain-card__title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          color: #333;
        }
        .dark-mode .domain-card__title {
          color: #e0e0e0;
        }
        .domain-card__desc {
          margin: 0;
          color: #666;
          line-height: 1.5;
        }
        .dark-mode .domain-card__desc {
          color: #b0b0b0;
        }
      `}} />
      <main className="container page-shell">
        <div className="home">
          <section className="intro-banner" role="banner">
            <h1>Consulta de protocolos</h1>
            <p>Sistema de búsqueda y filtrado para protocolos oncológicos pediátricos. Accede a información estructurada por diagnóstico y especialidad.</p>
          </section>

          <Suspense fallback={<div className="container"><p>Cargando buscador…</p></div>}>
            <HomeClient initialData={data && Array.isArray(data) ? data : []} onlySearch={true} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
