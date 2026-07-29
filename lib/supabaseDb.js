// Implementação Supabase/Postgres — mesma interface de lib/store.js (modelo de GRUPOS).
// Acesso só pelo servidor com a SERVICE ROLE KEY. Tabelas com prefixo fila_.
import { createClient } from '@supabase/supabase-js';

const LIMIT_DEFAULT = 60;
const LIMIT_BATEDOR = 30;
const TARGET = { singles: 2, doubles: 4, batedor: 1 };

let _sb;
function sb() {
  if (!_sb) {
    _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _sb;
}

function ms(ts) { return ts ? Date.parse(ts) : null; }
function initials(name) {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
}
function must(error, msg) { if (error) throw new Error(msg || error.message); }
function fail(msg, status = 400) { const e = new Error(msg); e.status = status; return e; }

function gView(d) {
  if (!d) return null;
  const members = d.members || [];
  const type = d.type || 'singles';
  return {
    id: d.id, type, limit: d.limit_min || LIMIT_DEFAULT,
    names: members.map((m) => m.name),
    initials: members.map((m) => initials(m.name)),
    size: members.length, target: TARGET[type] || 2,
    formedAt: ms(d.formed_at), status: d.status, courtId: d.court_id,
  };
}

// ---- Presence ----

export async function checkIn(name) {
  const clean = (name || '').trim();
  if (!clean) throw fail('Informe um nome.');
  const { data, error } = await sb().from('fila_players').insert({ name: clean }).select().single();
  must(error);
  await sb().from('fila_check_in_events').insert({});
  return { id: data.id, name: data.name, checkedInAt: ms(data.checked_in_at), duoId: data.duo_id };
}

export async function getPlayer(pid) {
  if (!pid) return null;
  const { data } = await sb().from('fila_players').select('*').eq('id', pid).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, checkedInAt: ms(data.checked_in_at), duoId: data.duo_id };
}

export async function presentSingles(excludeId) {
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data, error } = await sb().from('fila_players').select('id,name,checked_in_at')
    .is('duo_id', null).gt('checked_in_at', since).order('checked_in_at', { ascending: true });
  must(error);
  return (data || []).filter((p) => p.id !== excludeId).map((p) => ({ id: p.id, name: p.name }));
}

// ---- Batedor ----

async function batedorAvailableFlag() {
  const { data } = await sb().from('fila_settings').select('value').eq('key', 'batedor_available').maybeSingle();
  return data?.value === 'true';
}
async function activeBatedor() {
  const { data } = await sb().from('fila_duos').select('id').eq('type', 'batedor').neq('status', 'done').limit(1);
  return data?.[0] || null;
}
export async function setBatedorAvailable(v) {
  await sb().from('fila_settings').upsert({ key: 'batedor_available', value: v ? 'true' : 'false' });
}
export async function batedorStatus() {
  const [avail, active] = await Promise.all([batedorAvailableFlag(), activeBatedor()]);
  return { available: avail, busy: !!active };
}

// ---- Groups ----

export async function formGroup(creatorId, type, partnerIds = []) {
  if (!['singles', 'doubles', 'batedor'].includes(type)) throw fail('Tipo de jogo inválido.');
  const ids = [creatorId, ...partnerIds];
  const { data: ps, error } = await sb().from('fila_players').select('*').in('id', ids);
  must(error);
  const creator = ps.find((p) => p.id === creatorId);
  if (!creator) throw fail('Faça o check-in primeiro.');
  if (creator.duo_id) throw fail('Você já está em um grupo.');

  let members;
  if (type === 'batedor') {
    if (partnerIds.length) throw fail('Com o Leandro é individual.');
    if (!(await batedorAvailableFlag())) throw fail('O Leandro não está disponível agora.');
    if (await activeBatedor()) throw fail('O Leandro já está com outra pessoa.');
    members = [creator];
  } else {
    if (type === 'singles' && partnerIds.length !== 1) throw fail('No jogo simples, escolha 1 parceiro.');
    if (type === 'doubles' && (partnerIds.length < 1 || partnerIds.length > 3)) throw fail('Nas duplas, escolha de 1 a 3 parceiros.');
    const seen = new Set([creatorId]);
    const partners = partnerIds.map((pid) => {
      if (seen.has(pid)) throw fail('Jogador repetido.');
      seen.add(pid);
      const p = ps.find((x) => x.id === pid);
      if (!p) throw fail('Parceiro não está no clube (sem check-in).');
      if (p.duo_id) throw fail('Um dos parceiros já está em um grupo.');
      return p;
    });
    members = [creator, ...partners];
  }

  const memberJson = members.map((m) => ({ id: m.id, name: m.name }));
  const { data: g, error: e2 } = await sb().from('fila_duos').insert({
    type,
    limit_min: type === 'batedor' ? LIMIT_BATEDOR : LIMIT_DEFAULT,
    members: memberJson,
    name1: members[0].name,
    name2: members[1]?.name || null,
    status: 'queued',
  }).select().single();
  must(e2);
  await sb().from('fila_players').update({ duo_id: g.id }).in('id', members.map((m) => m.id));
  return gView(g);
}

export async function addMember(groupId, playerId) {
  const { data: g } = await sb().from('fila_duos').select('*').eq('id', groupId).maybeSingle();
  if (!g) throw fail('Grupo não encontrado.');
  if (g.type !== 'doubles') throw fail('Só dá para adicionar jogadores nas duplas.');
  if (!['queued', 'called'].includes(g.status)) throw fail('Não é possível adicionar agora.');
  const members = g.members || [];
  if (members.length >= TARGET.doubles) throw fail('A dupla já está completa (4).');
  const { data: p } = await sb().from('fila_players').select('*').eq('id', playerId).maybeSingle();
  if (!p) throw fail('Jogador não está no clube.');
  if (p.duo_id) throw fail('Esse jogador já está em um grupo.');
  members.push({ id: p.id, name: p.name });
  await sb().from('fila_duos').update({ members }).eq('id', groupId);
  await sb().from('fila_players').update({ duo_id: groupId }).eq('id', playerId);
  return gView({ ...g, members });
}

export async function disbandGroup(groupId) {
  const { data: g } = await sb().from('fila_duos').select('*').eq('id', groupId).maybeSingle();
  if (!g) return;
  if (g.status === 'playing') throw fail('O grupo está jogando; encerre o jogo pela recepção.');
  const ids = (g.members || []).map((m) => m.id).filter(Boolean);
  if (ids.length) await sb().from('fila_players').update({ duo_id: null }).in('id', ids);
  await sb().from('fila_courts').update({ called_duo_id: null, status: 'free' }).eq('called_duo_id', groupId);
  await sb().from('fila_duos').delete().eq('id', groupId);
}

// ---- Schedule ----

export async function addSchedule({ courtId, weekday, startMin, endMin, label }) {
  weekday = Number(weekday); startMin = Number(startMin); endMin = Number(endMin);
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) throw fail('Dia da semana inválido.');
  if (Number.isNaN(startMin) || Number.isNaN(endMin) || endMin <= startMin) throw fail('Horário inválido.');
  const { data, error } = await sb().from('fila_schedule')
    .insert({ court_id: courtId, weekday, start_min: startMin, end_min: endMin, label: label || 'Aula' })
    .select().single();
  must(error);
  return data;
}
export async function removeSchedule(scheduleId) {
  await sb().from('fila_schedule').delete().eq('id', scheduleId);
}
export async function listSchedule() {
  const { data } = await sb().from('fila_schedule').select('*');
  return (data || []).map((s) => ({ id: s.id, courtId: s.court_id, weekday: s.weekday, startMin: s.start_min, endMin: s.end_min, label: s.label }))
    .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
}
function activeSchedule(rows, courtId, when = Date.now()) {
  const d = new Date(when);
  const wd = d.getDay();
  const min = d.getHours() * 60 + d.getMinutes();
  const hit = (rows || []).find((s) => s.court_id === courtId && s.weekday === wd && min >= s.start_min && min < s.end_min);
  if (!hit) return null;
  const until = new Date(d); until.setHours(0, hit.end_min, 0, 0);
  return { label: hit.label, until: until.getTime() };
}

// ---- Court / reception ----

async function getCourt(courtId) {
  const { data } = await sb().from('fila_courts').select('*').eq('id', courtId).maybeSingle();
  if (!data) throw fail('Quadra não encontrada.');
  return data;
}
async function queueHead() {
  const { data } = await sb().from('fila_duos').select('*').eq('status', 'queued').order('formed_at', { ascending: true }).limit(1);
  return data?.[0] || null;
}

export async function callNext(courtId) {
  const c = await getCourt(courtId);
  if (c.status === 'playing' || c.status === 'lesson') throw fail('Quadra indisponível.');
  const { data: rows } = await sb().from('fila_schedule').select('*').eq('court_id', courtId);
  if (activeSchedule(rows, courtId)) throw fail('Quadra em aula (grade fixa) agora.');
  const head = await queueHead();
  if (!head) throw fail('Fila vazia.');
  await sb().from('fila_duos').update({ status: 'called', court_id: courtId }).eq('id', head.id);
  await sb().from('fila_courts').update({ status: 'prep', called_duo_id: head.id, duo_id: null, play_started_at: null }).eq('id', courtId);
}

export async function startGame(courtId) {
  const c = await getCourt(courtId);
  if (c.status !== 'prep' || !c.called_duo_id) throw fail('Nenhum grupo em preparo nesta quadra.');
  await sb().from('fila_duos').update({ status: 'playing' }).eq('id', c.called_duo_id);
  await sb().from('fila_courts').update({ status: 'playing', duo_id: c.called_duo_id, called_duo_id: null, play_started_at: new Date().toISOString() }).eq('id', courtId);
}

export async function endGame(courtId) {
  const c = await getCourt(courtId);
  if (c.status === 'playing' && c.duo_id) {
    const { data: g } = await sb().from('fila_duos').select('*').eq('id', c.duo_id).maybeSingle();
    if (g) {
      await sb().from('fila_duos').update({ status: 'done' }).eq('id', g.id);
      const ids = (g.members || []).map((m) => m.id).filter(Boolean);
      if (ids.length) await sb().from('fila_players').update({ duo_id: null }).in('id', ids);
    }
  }
  const head = await queueHead();
  if (head) {
    await sb().from('fila_duos').update({ status: 'called', court_id: courtId }).eq('id', head.id);
    await sb().from('fila_courts').update({ status: 'prep', called_duo_id: head.id, duo_id: null, play_started_at: null }).eq('id', courtId);
  } else {
    await sb().from('fila_courts').update({ status: 'free', called_duo_id: null, duo_id: null, play_started_at: null }).eq('id', courtId);
  }
}

export async function extendGame(courtId, minutes = 15) {
  const c = await getCourt(courtId);
  if (c.status === 'playing' && c.play_started_at) {
    const next = new Date(ms(c.play_started_at) + minutes * 60000).toISOString();
    await sb().from('fila_courts').update({ play_started_at: next }).eq('id', courtId);
  }
}

export async function blockLesson(courtId, label, minutesUntil = 60) {
  const c = await getCourt(courtId);
  if (c.status === 'playing') throw fail('Encerre o jogo antes de bloquear.');
  const until = new Date(Date.now() + minutesUntil * 60000).toISOString();
  await sb().from('fila_courts').update({ status: 'lesson', lesson_label: label || 'Aula', lesson_until: until, duo_id: null, called_duo_id: null, play_started_at: null }).eq('id', courtId);
}

export async function unblockLesson(courtId) {
  await sb().from('fila_courts').update({ status: 'free', lesson_label: null, lesson_until: null }).eq('id', courtId).eq('status', 'lesson');
}

export async function resetAll() {
  await sb().from('fila_check_in_events').delete().neq('id', 0);
  await sb().from('fila_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await sb().from('fila_players').update({ duo_id: null }).not('id', 'is', null);
  await sb().from('fila_duos').delete().not('id', 'is', null);
  await sb().from('fila_players').delete().not('id', 'is', null);
  await sb().from('fila_courts').update({ status: 'free', duo_id: null, called_duo_id: null, play_started_at: null, lesson_label: null, lesson_until: null }).not('id', 'is', null);
  await sb().from('fila_settings').upsert({ key: 'batedor_available', value: 'false' });
}

// ---- Peak ----

const PEAK_FALLBACK = [24, 32, 50, 58, 78, 94, 88, 54, 30];
const PEAK_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22];
function peakFromEvents(events, when = Date.now()) {
  const wd = new Date(when).getDay();
  const byHour = {}; const days = new Set();
  for (const e of events || []) {
    const d = new Date(e.at);
    if (d.getDay() !== wd) continue;
    days.add(d.toDateString());
    byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
  }
  if (days.size < 2) return { source: 'exemplo', hours: PEAK_HOURS.map((h, i) => ({ h, v: PEAK_FALLBACK[i] })) };
  const avg = PEAK_HOURS.map((h) => (byHour[h] || 0) / days.size);
  const max = Math.max(1, ...avg);
  return { source: 'histórico', hours: PEAK_HOURS.map((h, i) => ({ h, v: Math.round((avg[i] / max) * 100) })) };
}

// ---- Snapshot ----

export async function snapshot() {
  const now = Date.now();
  const [courtsR, duosR, schedR, evR, availFlag] = await Promise.all([
    sb().from('fila_courts').select('*').order('sort', { ascending: true }),
    sb().from('fila_duos').select('*'),
    sb().from('fila_schedule').select('*'),
    sb().from('fila_check_in_events').select('at').gt('at', new Date(now - 21 * 24 * 3600 * 1000).toISOString()),
    batedorAvailableFlag(),
  ]);
  const duos = duosR.data || [];
  const byId = Object.fromEntries(duos.map((d) => [d.id, d]));
  const courts = (courtsR.data || []).map((c) => {
    const sched = c.status === 'free' ? activeSchedule(schedR.data, c.id, now) : null;
    const status = sched ? 'lesson' : c.status;
    const lesson = sched ? { label: sched.label, until: sched.until, recurring: true }
      : (c.status === 'lesson' ? { label: c.lesson_label, until: ms(c.lesson_until) } : null);
    return {
      id: c.id, name: c.name, surface: c.surface, status,
      playStartedAt: ms(c.play_started_at),
      duo: c.duo_id ? gView(byId[c.duo_id]) : null,
      called: c.called_duo_id ? gView(byId[c.called_duo_id]) : null,
      lesson,
    };
  });
  const queue = duos.filter((d) => d.status === 'queued').sort((a, b) => ms(a.formed_at) - ms(b.formed_at)).map(gView);
  const busy = duos.some((d) => d.type === 'batedor' && d.status !== 'done');
  return {
    now, limitMinutes: LIMIT_DEFAULT,
    batedor: { available: availFlag, busy },
    courts, queue,
    presentCount: 0,
    peak: peakFromEvents(evR.data, now),
  };
}

export { LIMIT_DEFAULT, LIMIT_BATEDOR };
