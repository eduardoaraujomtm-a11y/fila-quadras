// Implementação Supabase/Postgres — mesma interface de lib/store.js.
// Acesso só pelo servidor com a SERVICE ROLE KEY (ignora RLS).
import { createClient } from '@supabase/supabase-js';

const LIMIT_MINUTES = 60;

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

// ---- Presence & pairing ----

export async function checkIn(name) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('Informe um nome.');
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

export async function formDuo(playerId, partnerId) {
  const { data: ps, error } = await sb().from('fila_players').select('*').in('id', [playerId, partnerId]);
  must(error);
  const me = ps.find((p) => p.id === playerId);
  const partner = ps.find((p) => p.id === partnerId);
  if (!me) throw new Error('Faça o check-in primeiro.');
  if (!partner) throw new Error('Parceiro não está no clube (sem check-in).');
  if (me.duo_id || partner.duo_id) throw new Error('Alguém já está em uma dupla.');
  const { data: duo, error: e2 } = await sb().from('fila_duos')
    .insert({ name1: me.name, name2: partner.name, p1: me.id, p2: partner.id, status: 'queued' })
    .select().single();
  must(e2);
  await sb().from('fila_players').update({ duo_id: duo.id }).in('id', [me.id, partner.id]);
  return { id: duo.id, names: [duo.name1, duo.name2] };
}

export async function disbandDuo(duoId) {
  const { data: duo } = await sb().from('fila_duos').select('*').eq('id', duoId).maybeSingle();
  if (!duo) return;
  if (duo.status === 'playing') throw new Error('A dupla está jogando; encerre o jogo pela recepção.');
  await sb().from('fila_players').update({ duo_id: null }).in('id', [duo.p1, duo.p2].filter(Boolean));
  await sb().from('fila_courts').update({ called_duo_id: null, status: 'free' }).eq('called_duo_id', duoId);
  await sb().from('fila_duos').delete().eq('id', duoId);
}

// ---- Schedule (grade fixa) ----

export async function addSchedule({ courtId, weekday, startMin, endMin, label }) {
  weekday = Number(weekday); startMin = Number(startMin); endMin = Number(endMin);
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) throw new Error('Dia da semana inválido.');
  if (Number.isNaN(startMin) || Number.isNaN(endMin) || endMin <= startMin) throw new Error('Horário inválido.');
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

// ---- Court / reception controls ----

async function getCourt(courtId) {
  const { data } = await sb().from('fila_courts').select('*').eq('id', courtId).maybeSingle();
  if (!data) throw new Error('Quadra não encontrada.');
  return data;
}
async function queueHead() {
  const { data } = await sb().from('fila_duos').select('*').eq('status', 'queued').order('formed_at', { ascending: true }).limit(1);
  return data?.[0] || null;
}

export async function callNext(courtId) {
  const c = await getCourt(courtId);
  if (c.status === 'playing' || c.status === 'lesson') throw new Error('Quadra indisponível.');
  const { data: rows } = await sb().from('fila_schedule').select('*').eq('court_id', courtId);
  if (activeSchedule(rows, courtId)) throw new Error('Quadra em aula (grade fixa) agora.');
  const head = await queueHead();
  if (!head) throw new Error('Fila vazia.');
  await sb().from('fila_duos').update({ status: 'called', court_id: courtId }).eq('id', head.id);
  await sb().from('fila_courts').update({ status: 'prep', called_duo_id: head.id, duo_id: null, play_started_at: null }).eq('id', courtId);
}

export async function startGame(courtId) {
  const c = await getCourt(courtId);
  if (c.status !== 'prep' || !c.called_duo_id) throw new Error('Nenhuma dupla em preparo nesta quadra.');
  await sb().from('fila_duos').update({ status: 'playing' }).eq('id', c.called_duo_id);
  await sb().from('fila_courts').update({ status: 'playing', duo_id: c.called_duo_id, called_duo_id: null, play_started_at: new Date().toISOString() }).eq('id', courtId);
}

export async function endGame(courtId) {
  const c = await getCourt(courtId);
  if (c.status === 'playing' && c.duo_id) {
    const { data: duo } = await sb().from('fila_duos').select('*').eq('id', c.duo_id).maybeSingle();
    if (duo) {
      await sb().from('fila_duos').update({ status: 'done' }).eq('id', duo.id);
      await sb().from('fila_players').update({ duo_id: null }).in('id', [duo.p1, duo.p2].filter(Boolean));
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
  if (c.status === 'playing') throw new Error('Encerre o jogo antes de bloquear.');
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
}

// ---- Peak hours ----

const PEAK_FALLBACK = [24, 32, 50, 58, 78, 94, 88, 54, 30];
const PEAK_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

function peakFromEvents(events, when = Date.now()) {
  const wd = new Date(when).getDay();
  const byHour = {}; const days = new Set();
  for (const e of events || []) {
    const d = new Date(e.at);
    if (d.getDay() !== wd) continue;
    days.add(d.toDateString());
    const h = d.getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  if (days.size < 2) return { source: 'exemplo', hours: PEAK_HOURS.map((h, i) => ({ h, v: PEAK_FALLBACK[i] })) };
  const avg = PEAK_HOURS.map((h) => (byHour[h] || 0) / days.size);
  const max = Math.max(1, ...avg);
  return { source: 'histórico', hours: PEAK_HOURS.map((h, i) => ({ h, v: Math.round((avg[i] / max) * 100) })) };
}

// ---- Snapshot ----

export async function snapshot() {
  const now = Date.now();
  const [courtsR, duosR, schedR, evR] = await Promise.all([
    sb().from('fila_courts').select('*').order('sort', { ascending: true }),
    sb().from('fila_duos').select('*'),
    sb().from('fila_schedule').select('*'),
    sb().from('fila_check_in_events').select('at').gt('at', new Date(now - 21 * 24 * 3600 * 1000).toISOString()),
  ]);
  const duos = duosR.data || [];
  const byId = Object.fromEntries(duos.map((d) => [d.id, d]));
  const duoView = (id) => {
    const d = byId[id]; if (!d) return null;
    return { id: d.id, names: [d.name1, d.name2], initials: [initials(d.name1), initials(d.name2)], formedAt: ms(d.formed_at), status: d.status, courtId: d.court_id };
  };
  const courts = (courtsR.data || []).map((c) => {
    const sched = c.status === 'free' ? activeSchedule(schedR.data, c.id, now) : null;
    const status = sched ? 'lesson' : c.status;
    const lesson = sched ? { label: sched.label, until: sched.until, recurring: true }
      : (c.status === 'lesson' ? { label: c.lesson_label, until: ms(c.lesson_until) } : null);
    return {
      id: c.id, name: c.name, surface: c.surface, status,
      playStartedAt: ms(c.play_started_at),
      duo: c.duo_id ? duoView(c.duo_id) : null,
      called: c.called_duo_id ? duoView(c.called_duo_id) : null,
      lesson,
    };
  });
  const queue = duos.filter((d) => d.status === 'queued').sort((a, b) => ms(a.formed_at) - ms(b.formed_at)).map((d) => duoView(d.id));
  return { now, limitMinutes: LIMIT_MINUTES, courts, queue, presentCount: 0, peak: peakFromEvents(evR.data, now) };
}

export { LIMIT_MINUTES };
