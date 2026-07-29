import { checkIn, getPlayer } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { name } = await req.json();
    const player = await checkIn(name);
    return Response.json({ ok: true, player });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 400 });
  }
}

export async function GET(req) {
  const pid = new URL(req.url).searchParams.get('id');
  return Response.json({ player: pid ? await getPlayer(pid) : null });
}
