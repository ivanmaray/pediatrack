import { getProtocol } from "@/lib/loadProtocol.js";

export async function GET(request, { params }) {
  const id = params.id;
  try {
    const protocolo = await getProtocol(id);
    if (!protocolo) return Response.json(null, { status: 404 });
    return Response.json(protocolo);
  } catch (err) {
    console.error(err);
    return Response.json(null, { status: 500 });
  }
}
