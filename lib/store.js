// In-memory store (prototype/fallback). Modelo de GRUPOS:
//  - singles: 2 jogadores (1x1), 60 min
//  - doubles: 2 a 4 jogadores, entra na fila com >=2 e adiciona o resto depois, 60 min
//  - batedor: 1 jogador + Leandro (implícito), 30 min, só quando a recepção libera
// Swap por Supabase em produção (lib/supabaseDb.js) — mesma interface.

const LIMIT_DEFAULT = 60;
const LIMIT_BATEDOR = 30;
const TARGET = { singles: 2, doubles: 4, batedor: 1 };

function nowLabel() { return Date.now(); }

function seed() {
  return {
    players: {}, // id -> { id, name, checkedInAt, groupId|null }
    groups: {},  // id -> { id, type, limit, members:[{id,name}], formedAt, status, courtId }
    queue: [],   // ordered array of groupId (status 'queued')
    courts: [
      { id: 'q1', name: 'Quadra 01', surface: 'saibro', status: 'free', groupId: null, playStartedAt: null, calledGroupId: null, lesson: null },
      { id: 'q2', name: 'Quadra 02', surface: 'saibro', status: 'free', groupId: null, playStartedAt: null, calledGroupId: null, lesson: null },
      { id: 'qd', name: 'Quadra Dura', surface: 'rápida', status: 'free', groupId: null, playStartedAt: null, calledGroupId: null, lesson: null },
    ],
    schedule: [],
    events: [],
    batedorAvailable: false,
    seq: 1,
  };
}

function getDB() {
  if (!globalThis.__filaDB) globalThis.__filaDB = seed();
  return globalThis.__filaDB;
}

function id(prefix) {
  const db = getDB();
  return `${prefix}_${db.seq++}_${Math.random().toString(36).slice(2, 6)}`;
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

// ---- Presence ----

export function checkIn(name) {
  const db = getDB();
  const clean = (name || '').trim();
  if (!clean) throw new Error('Informe um nome.');
  const pid = id('p');
  db.players[pid] = { id: pid, name: clean, checkedInAt: nowLabel(), groupId: null };
  db.events.push({ at: nowLabel() });
  return { id: pid, name: clean, checkedInAt: db.players[pid].checkedInAt, duoId: null };
}

export function getPlayer(pid) {
  const p = getDB().players[pid];
  if (!p) return null;
  return { id: p.id, name: p.name, checkedInAt: p.checkedInAt, duoId: p.groupId };
}

export function presentSingles(excludeId) {
  const db = getDB();
  return Object.values(db.players)
    .filter((p) => !p.groupId && p.id !== excludeId)
    .sort((a, b) => a.checkedInAt - b.checkedInAt)
    .map((p) => ({ id: p.id, name: p.name }));
}

// ---- Batedor (Leandro) ----

function activeBatedor() {
  const db = getDB();
  return Object.values(db.groups).find((g) => g.type === 'batedor' && g.status !== 'done');
}

export function setBatedorAvailable(v) {
  getDB().batedorAvailable = !!v;
}

export function batedorStatus() {
  const db = getDB();
  return { available: !!db.batedorAvailable, busy: !!activeBatedor() };
}

// ---- Groups (duplas / simples / batedor) ----

export function formGroup(creatorId, type, partnerIds = []) {
  const db = getDB();
  if (!['singles', 'doubles', 'batedor'].includes(type)) throw new Error('Tipo de jogo inválido.');
  const creator = db.players[creatorId];
  if (!creator) throw new Error('Faça o check-in primeiro.');
  if (creator.groupId) throw new Error('Você já está em um grupo.');

  let members;
  if (type === 'batedor') {
    if (partnerIds.length) throw new Error('Com o Leandro é individual.');
    if (!db.batedorAvailable) throw new Error('O Leandro não está disponível agora.');
    if (activeBatedor()) throw new Error('O Leandro já está com outra pessoa.');
    members = [creator];
  } else {
    if (type === 'singles' && partnerIds.length !== 1) throw new Error('No jogo simples, escolha 1 parceiro.');
    if (type === 'doubles' && (partnerIds.length < 1 || partnerIds.length > 3)) throw new Error('Nas duplas, escolha de 1 a 3 parceiros.');
    const seen = new Set([creatorId]);
    const partners = partnerIds.map((pid) => {
      if (seen.has(pid)) throw new Error('Jogador repetido.');
      seen.add(pid);
      const p = db.players[pid];
      if (!p) throw new Error('Parceiro não está no clube (sem check-in).');
      if (p.groupId) throw new Error('Um dos parceiros já está em um grupo.');
      return p;
    });
    members = [creator, ...partners];
  }

  const gid = id('g');
  db.groups[gid] = {
    id: gid,
    type,
    limit: type === 'batedor' ? LIMIT_BATEDOR : LIMIT_DEFAULT,
    members: members.map((m) => ({ id: m.id, name: m.name })),
    formedAt: nowLabel(),
    status: 'queued',
    courtId: null,
  };
  members.forEach((m) => { m.groupId = gid; });
  db.queue.push(gid);
  return groupView(gid);
}

export function addMember(groupId, playerId) {
  const db = getDB();
  const g = db.groups[groupId];
  if (!g) throw new Error('Grupo não encontrado.');
  if (g.type !== 'doubles') throw new Error('Só dá para adicionar jogadores nas duplas.');
  if (!['queued', 'called'].includes(g.status)) throw new Error('Não é possível adicionar agora.');
  if (g.members.length >= TARGET.doubles) throw new Error('A dupla já está completa (4).');
  const p = db.players[playerId];
  if (!p) throw new Error('Jogador não está no clube.');
  if (p.groupId) throw new Error('Esse jogador já está em um grupo.');
  g.members.push({ id: p.id, name: p.name });
  p.groupId = groupId;
  return groupView(groupId);
}

export function disbandGroup(groupId) {
  const db = getDB();
  const g = db.groups[groupId];
  if (!g) return;
  if (g.status === 'playing') throw new Error('O grupo está jogando; encerre o jogo pela recepção.');
  g.members.forEach((m) => { if (db.players[m.id]) db.players[m.id].groupId = null; });
  db.queue = db.queue.filter((q) => q !== groupId);
  db.courts.forEach((c) => { if (c.calledGroupId === groupId) c.calledGroupId = null; });
  delete db.groups[groupId];
}

function groupView(gid) {
  const g = getDB().groups[gid];
  if (!g) return null;
  return {
    id: g.id,
    type: g.type,
    limit: g.limit,
    names: g.members.map((m) => m.name),
    initials: g.members.map((m) => initials(m.name)),
    size: g.members.length,
    target: TARGET[g.type],
    formedAt: g.formedAt,
    status: g.status,
    courtId: g.courtId,
  };
}

// ---- Recurring lesson schedule ----

export function addSchedule({ courtId, weekday, startMin, endMin, label }) {
  const db = getDB();
  if (!db.courts.find((c) => c.id === courtId)) throw new Error('Quadra inválida.');
  weekday = Number(weekday); startMin = Number(startMin); endMin = Number(endMin);
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) throw new Error('Dia da semana inválido.');
  if (Number.isNaN(startMin) || Number.isNaN(endMin) || endMin <= startMin) throw new Error('Horário inválido.');
  const sid = id('s');
  db.schedule.push({ id: sid, courtId, weekday, startMin, endMin, label: label || 'Aula' });
  return db.schedule.find((s) => s.id === sid);
}

export function removeSchedule(scheduleId) {
  const db = getDB();
  db.schedule = db.schedule.filter((s) => s.id !== scheduleId);
}

export function listSchedule() {
  return getDB().schedule.slice().sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
}

function activeSchedule(courtId, when = Date.now()) {
  const db = getDB();
  const d = new Date(when);
  const wd = d.getDay();
  const min = d.getHours() * 60 + d.getMinutes();
  const hit = db.schedule.find((s) => s.courtId === courtId && s.weekday === wd && min >= s.startMin && min < s.endMin);
  if (!hit) return null;
  const until = new Date(d); until.setHours(0, hit.endMin, 0, 0);
  return { label: hit.label, until: until.getTime() };
}

// ---- Court / reception controls ----

function court(courtId) {
  const c = getDB().courts.find((x) => x.id === courtId);
  if (!c) throw new Error('Quadra não encontrada.');
  return c;
}

export function callNext(courtId) {
  const db = getDB();
  const c = court(courtId);
  if (c.status === 'playing' || c.status === 'lesson') throw new Error('Quadra indisponível.');
  if (activeSchedule(courtId)) throw new Error('Quadra em aula (grade fixa) agora.');
  const nextId = db.queue.shift();
  if (!nextId) throw new Error('Fila vazia.');
  const g = db.groups[nextId];
  g.status = 'called';
  g.courtId = courtId;
  c.status = 'prep';
  c.calledGroupId = nextId;
  c.groupId = null;
  c.playStartedAt = null;
  return c;
}

export function startGame(courtId) {
  const c = court(courtId);
  if (c.status !== 'prep' || !c.calledGroupId) throw new Error('Nenhum grupo em preparo nesta quadra.');
  const db = getDB();
  const g = db.groups[c.calledGroupId];
  g.status = 'playing';
  c.status = 'playing';
  c.groupId = c.calledGroupId;
  c.calledGroupId = null;
  c.playStartedAt = nowLabel();
  return c;
}

export function endGame(courtId) {
  const db = getDB();
  const c = court(courtId);
  if (c.status === 'playing' && c.groupId) {
    const g = db.groups[c.groupId];
    if (g) {
      g.status = 'done';
      g.members.forEach((m) => { if (db.players[m.id]) db.players[m.id].groupId = null; });
    }
  }
  c.groupId = null;
  c.playStartedAt = null;
  const nextId = db.queue.shift();
  if (nextId) {
    const g = db.groups[nextId];
    g.status = 'called';
    g.courtId = courtId;
    c.status = 'prep';
    c.calledGroupId = nextId;
  } else {
    c.status = 'free';
    c.calledGroupId = null;
  }
  return c;
}

export function extendGame(courtId, minutes = 15) {
  const c = court(courtId);
  if (c.status === 'playing' && c.playStartedAt) {
    c.playStartedAt += minutes * 60 * 1000;
  }
  return c;
}

export function blockLesson(courtId, label, minutesUntil = 60) {
  const c = court(courtId);
  if (c.status === 'playing') throw new Error('Encerre o jogo antes de bloquear.');
  c.status = 'lesson';
  c.lesson = { label: label || 'Aula', until: Date.now() + minutesUntil * 60 * 1000 };
  c.groupId = null;
  c.playStartedAt = null;
  c.calledGroupId = null;
  return c;
}

export function unblockLesson(courtId) {
  const c = court(courtId);
  if (c.status !== 'lesson') return c;
  c.status = 'free';
  c.lesson = null;
  return c;
}

// ---- Peak hours ----

const PEAK_FALLBACK = [24, 32, 50, 58, 78, 94, 88, 54, 30];
const PEAK_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export function peakForToday(when = Date.now()) {
  const db = getDB();
  const wd = new Date(when).getDay();
  const byHour = {}; const days = new Set();
  for (const e of db.events) {
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

export function snapshot() {
  const db = getDB();
  const now = Date.now();
  return {
    now,
    limitMinutes: LIMIT_DEFAULT,
    batedor: batedorStatus(),
    courts: db.courts.map((c) => {
      const sched = c.status === 'free' ? activeSchedule(c.id, now) : null;
      const status = sched ? 'lesson' : c.status;
      const lesson = sched ? { label: sched.label, until: sched.until, recurring: true } : c.lesson || null;
      return {
        id: c.id,
        name: c.name,
        surface: c.surface,
        status,
        playStartedAt: c.playStartedAt,
        duo: c.groupId ? groupView(c.groupId) : null,
        called: c.calledGroupId ? groupView(c.calledGroupId) : null,
        lesson,
      };
    }),
    queue: db.queue.map(groupView).filter(Boolean),
    presentCount: Object.values(db.players).filter((p) => !p.groupId).length,
    peak: peakForToday(now),
  };
}

export function resetAll() {
  globalThis.__filaDB = seed();
}

export { LIMIT_DEFAULT, LIMIT_BATEDOR };
