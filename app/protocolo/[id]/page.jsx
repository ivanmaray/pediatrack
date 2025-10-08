import ProtocolMap from "@/components/ProtocolMap.jsx";
import { getProtocol } from "@/lib/loadProtocol.js";

export default async function Page({ params }) {
  const protocolo = await getProtocol(params.id);
  if (!protocolo) return <div>Protocolo no encontrado.</div>;

  return <ProtocolMap data={protocolo} showHeader={true} showLegend={true} />;
}
