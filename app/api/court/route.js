import { callNext, startGame, endGame, extendGame, blockLesson, unblockLesson, resetAll } from '../../../lib/db';
import { requireAdmin } from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { action, courtId } = body;
    switch (action) {
      case 'callNext': await callNext(courtId); break;
      case 'startGame': await startGame(courtId); break;
      case 'endGame': await endGame(courtId); break;
      case 'extend': await extendGame(courtId, body.minutes || 15); break;
      case 'block': await blockLesson(courtId, body.label, body.minutes || 60); break;
      case 'unblock': await unblockLesson(courtId); break;
      case 'reset': await resetAll(); break;
      default: throw new Error('Ação inválida.');
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}
