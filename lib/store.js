// In-memory store (prototype). Survives dev HMR via globalThis.
// Swap this module for Supabase/Postgres in production — the API surface stays the same.

const LIMIT_MINUTES = 60; // limite de jogo quando há fila

function nowLabel() {
  return Date.now();
}

function seed() {
  return {
    players: {}, // id -> { id, name, checkedInAt, duoId|null }
    duos: {}, // id -> { id, p1, p2, names:[a,b], formedAt, status: 'queued'|'called'|'playing'|'done', courtId|null }
    queue: [], // ordered array of duoId (status 'queued')
    courts: [
      { id: 'q1', name: 'Quadra 01', surface: 'saibro', status: 'free', duoId: null, playStartedAt: null, calledDuoId: null, lesson: null },
      { id: 'q2', name: 'Quadra 02', surface: 'saibro', status: 'free', duoId: null, playStartedAt: null, calledDuoId: null, lesson: null },
      { id: 'qd', name: 'Quadra Dura', surface: 'rápida', status: 'free', duoId: null, playStartedAt: null, calledDuoId: null, lesson: null },
    ],
    schedule: [], // grade fixa: { id, courtId, weekday(0=dom..6=sáb), startMin, endMin, label }
    events: [],   // histórico de check-ins: { at }
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
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

// ---- Presence & pairing ----

export function checkIn(name) {
  const db = getDB();
  const clean = (name || '').trim();
  if (!clean) throw new Error('Informe um nome.');
  const pid = id('p');
  db.players[pid] = { id: pid, name: clean, checkedInAt: nowLabel(), duoId: null };
  db.events.push({ at: nowLabel() });
  return db.players[pid];
}

export function getPlayer(pid) {
  return getDB().players[pid] || null;
}

// Present players without a duo (available to pair with)
export function presentSingles(excludeId) {
  const db = getDB();
  return Object.values(db.players)
    .filter((p) => !p.duoId && p.id !== excludeId)
    .sort((a, b) => a.checkedInAt - b.checkedInAt);
}

export function formDuo(playerId, partnerId) {
  const db = getDB();
  const me = db.players[playerId];
  const partner = db.players[partnerId];
  if (!me) throw new Error('Faça o check-in primeiro.');
  if (!partner) throw new Error('Parceiro não está no clube (sem check-in).');
  if (me.duoId || partner.duoId) throw new Error('Alguém já está em uma dupla.');
  const did = id('d');
  db.duos[did] = {
    id: did,
    p1: me.id,
    p2: partner.id,
    names: [me.name, partner.name],
    formedAt: nowLabel(),
    status: 'queued',
    courtId: null,
  };
  me.duoId = did;
  partner.duoId = did;
  db.queue.push(did);
  return db.duos[did];
}

export function disbandDuo(duoId) {
  const db = getDB();
  const duo = db.duos[duoId];
  if (!duo) return;
  if (duo.status === 'playing') throw new Error('A dupla está jogando; encerre o jogo pela recepção.');
  [duo.p1, duo.p2].forEach((pid) => {
    if (db.players[pid]) db.players[pid].duoId = null;
  });
  db.queue = db.queue.filter((q) => q !== duoId);
  db.courts.forEach((c) => {
    if (c.calledDuoId === duoId) c.calledDuoId = null;
  });
  delete db.duos[duoId];
}

// ---- Recurring lesson schedule (grade fixa) ----

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

// Active recurring block for a court right now (or null)
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

// Reception calls the head of the queue to a court -> court goes to 'prep'
export function callNext(courtId) {
  const db = getDB();
  const c = court(courtId);
  if (c.status === 'playing' || c.status === 'lesson') throw new Error('Quadra indisponível.');
  if (activeSchedule(courtId)) throw new Error('Quadra em aula (grade fixa) agora.');
  const nextId = db.queue.shift();
  if (!nextId) throw new Error('Fila vazia.');
  const duo = db.duos[nextId];
  duo.status = 'called';
  duo.courtId = courtId;
  c.status = 'prep';
  c.calledDuoId = nextId;
  c.duoId = null;
  c.playStartedAt = null;
  return c;
}

// Reception marks the game as started -> timer begins now (prep time is neutral)
export function startGame(courtId) {
  const c = court(courtId);
  if (c.status !== 'prep' || !c.calledDuoId) throw new Error('Nenhuma dupla em preparo nesta quadra.');
  const db = getDB();
  const duo = db.duos[c.calledDuoId];
  duo.status = 'playing';
  c.status = 'playing';
  c.duoId = c.calledDuoId;
  c.calledDuoId = null;
  c.playStartedAt = nowLabel();
  return c;
}

// Reception ends the current game. Court goes to prep with next duo reserved (if any), else free.
export function endGame(courtId) {
  const db = getDB();
  const c = court(courtId);
  if (c.status === 'playing' && c.duoId) {
    const duo = db.duos[c.duoId];
    if (duo) {
      duo.status = 'done';
      [duo.p1, duo.p2].forEach((pid) => { if (db.players[pid]) db.players[pid].duoId = null; });
    }
  }
  c.duoId = null;
  c.playStartedAt = null;
  // auto-reserve next from queue -> prep, else free
  const nextId = db.queue.shift();
  if (nextId) {
    const nd = db.duos[nextId];
    nd.status = 'called';
    nd.courtId = courtId;
    c.status = 'prep';
    c.calledDuoId = nextId;
  } else {
    c.status = 'free';
    c.calledDuoId = null;
  }
  return c;
}

export function extendGame(courtId, minutes = 15) {
  const c = court(courtId);
  if (c.status === 'playing' && c.playStartedAt) {
    c.playStartedAt += minutes * 60 * 1000; // push start forward = more time left
  }
  return c;
}

export function blockLesson(courtId, label, minutesUntil = 60) {
  const c = court(courtId);
  if (c.status === 'playing') throw new Error('Encerre o jogo antes de bloquear.');
  c.status = 'lesson';
  c.lesson = { label: label || 'Aula', until: Date.now() + minutesUntil * 60 * 1000 };
  c.duoId = null;
  c.playStartedAt = null;
  c.calledDuoId = null;
  return c;
}

export function unblockLesson(courtId) {
  const c = court(courtId);
  if (c.status !== 'lesson') return c;
  c.status = 'free';
  c.lesson = null;
  return c;
}

// ---- Peak hours from real history ----

// Perfil de exemplo usado enquanto há poucos dados reais
const PEAK_FALLBACK = [24, 32, 50, 58, 78, 94, 88, 54, 30];
const PEAK_HOURS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export function peakForToday(when = Date.now()) {
  const db = getDB();
  const wd = new Date(when).getDay();
  // conta check-ins deste dia-da-semana por hora, e nº de dias distintos com dados
  const byHour = {};
  const days = new Set();
  for (const e of db.events) {
    const d = new Date(e.at);
    if (d.getDay() !== wd) continue;
    days.add(d.toDateString());
    const h = d.getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  const nDays = days.size;
  if (nDays < 2) {
    return { source: 'exemplo', hours: PEAK_HOURS.map((h, i) => ({ h, v: PEAK_FALLBACK[i] })) };
  }
  const avg = PEAK_HOURS.map((h) => (byHour[h] || 0) / nDays);
  const max = Math.max(1, ...avg);
  return { source: 'histórico', hours: PEAK_HOURS.map((h, i) => ({ h, v: Math.round((avg[i] / max) * 100) })) };
}

// ---- Snapshot for polling ----

export function snapshot() {
  const db = getDB();
  const now = Date.now();
  const duoView = (did) => {
    const d = db.duos[did];
    if (!d) return null;
    return { id: d.id, names: d.names, initials: d.names.map(initials), formedAt: d.formedAt, status: d.status, courtId: d.courtId };
  };
  return {
    now,
    limitMinutes: LIMIT_MINUTES,
    courts: db.courts.map((c) => {
      // grade fixa sobrepõe uma quadra livre automaticamente
      const sched = c.status === 'free' ? activeSchedule(c.id, now) : null;
      const status = sched ? 'lesson' : c.status;
      const lesson = sched ? { label: sched.label, until: sched.until, recurring: true } : c.lesson || null;
      return {
        id: c.id,
        name: c.name,
        surface: c.surface,
        status,
        playStartedAt: c.playStartedAt,
        duo: c.duoId ? duoView(c.duoId) : null,
        called: c.calledDuoId ? duoView(c.calledDuoId) : null,
        lesson,
      };
    }),
    queue: db.queue.map(duoView).filter(Boolean),
    presentCount: Object.values(db.players).filter((p) => !p.duoId).length,
    peak: peakForToday(now),
  };
}

export function resetAll() {
  globalThis.__filaDB = seed();
}

export { LIMIT_MINUTES };
