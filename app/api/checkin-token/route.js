import { requireAdmin } from '../../../lib/adminAuth';
import { checkinToken } from '../../../lib/checkinToken';

export const dynamic = 'force-dynamic';

// Só funcionários (autenticados) podem ver o código, para gerar/imprimir o QR.
export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ token: checkinToken() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 401 });
  }
}
