"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ProtocolTimeline from "./ProtocolTimeline.jsx";

const ProtocolMap = dynamic(() => import("./ProtocolMap.jsx"), { ssr: false });

const VIEWS = [
  { id: "timeline", label: "Ruta clínica" },
  { id: "map", label: "Mapa interactivo" },
];

export default function ProtocolViewer({ data }) {
  const [view, setView] = useState("timeline");

  return (
    <div className="viewer-shell">
      <div className="viewer-tabs" role="tablist" aria-label="Selector de vista del protocolo">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="viewer-tab"
            role="tab"
            aria-pressed={view === option.id}
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "timeline" ? (
        <ProtocolTimeline data={data} />
      ) : (
        <div className="protocol-map-shell">
          <ProtocolMap data={data} showHeader={true} showLegend={true} />
        </div>
      )}
    </div>
  );
}
