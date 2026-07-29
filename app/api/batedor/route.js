import { setBatedorAvailable } from '../../../lib/db';
import { requireAdmin } from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

// Recepção liga/desliga a disponibilidade do Leandro.
export async function POST(req) {
  try {
    await requireAdmin();
    const { available } = await req.json();
    await setBatedorAvailable(!!available);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}
