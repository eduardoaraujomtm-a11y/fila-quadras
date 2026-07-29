import { presentSingles } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const exclude = new URL(req.url).searchParams.get('exclude') || '';
  const singles = await presentSingles(exclude);
  return Response.json({ singles: singles.map((p) => ({ id: p.id, name: p.name })) });
}
