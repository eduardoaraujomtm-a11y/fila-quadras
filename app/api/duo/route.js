import { formDuo, disbandDuo } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { playerId, partnerId } = await req.json();
    const duo = await formDuo(playerId, partnerId);
    return Response.json({ ok: true, duo });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { duoId } = await req.json();
    await disbandDuo(duoId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 400 });
  }
}
