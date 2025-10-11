import data from "@/data/index.json";
import HomeClient from "@/components/HomeClient.jsx";

export const revalidate = 60;

export async function generateMetadata() {
  const total = Array.isArray(data) ? data.length : 0;
  return {
    title: `Pediatrack · ${total} protocolo${total === 1 ? "" : "s"}`,
    description: "Explora mapas terapéuticos interactivos para oncología pediátrica.",
  };
}

export default function Home() {
  return <HomeClient initialData={Array.isArray(data) ? data : []} />;
}
