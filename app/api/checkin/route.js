import { checkIn, getPlayer } from '../../../lib/db';
import { checkinToken } from '../../../lib/checkinToken';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { name, token } = await req.json();
    if (token !== checkinToken()) {
      const e = new Error('QR inválido. Escaneie o QR na parede do clube para entrar na fila.');
      e.status = 401;
      throw e;
    }
    const player = await checkIn(name);
    return Response.json({ ok: true, player });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}

// Re-hidrata um jogador salvo no aparelho (não precisa do código; já está no clube).
export async function GET(req) {
  const pid = new URL(req.url).searchParams.get('id');
  return Response.json({ player: pid ? await getPlayer(pid) : null });
}
