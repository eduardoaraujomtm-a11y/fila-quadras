import { addSchedule, removeSchedule, listSchedule } from '../../../lib/db';
import { requireAdmin } from '../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ schedule: await listSchedule() });
}

export async function POST(req) {
  try {
    await requireAdmin();
    const body = await req.json();
    const s = await addSchedule(body);
    return Response.json({ ok: true, schedule: s });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}

export async function DELETE(req) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    await removeSchedule(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}
