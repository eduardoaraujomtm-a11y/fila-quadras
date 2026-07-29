import { formGroup, addMember, disbandGroup } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// Criar grupo (simples / duplas / batedor) ou adicionar jogador a uma dupla.
export async function POST(req) {
  try {
    const body = await req.json();
    if (body.op === 'add') {
      const g = await addMember(body.groupId, body.playerId);
      return Response.json({ ok: true, group: g });
    }
    const g = await formGroup(body.creatorId, body.type, body.partnerIds || []);
    return Response.json({ ok: true, group: g });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}

export async function DELETE(req) {
  try {
    const { groupId } = await req.json();
    await disbandGroup(groupId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: e.status || 400 });
  }
}
