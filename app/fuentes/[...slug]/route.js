import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req, { params }) {
  try {
    const parts = Array.isArray(params?.slug) ? params.slug : [];
    if (!parts.length) return new Response('Not Found', { status: 404 });
    // sanitize to avoid path traversal
    const safe = parts.filter(p => p && !p.includes('..') && !p.includes(':'));
    const filePath = path.join(process.cwd(), 'data', 'fuentes', ...safe);
    const ext = path.extname(filePath).toLowerCase();
    const buf = await fs.readFile(filePath);
    const types = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    const contentType = types[ext] || 'application/octet-stream';
    const filename = safe[safe.length - 1] || 'file';
    return new Response(buf, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (e) {
    console.error('Error serving fuente', e);
    return new Response('Not Found', { status: 404 });
  }
}
